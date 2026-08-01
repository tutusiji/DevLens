"""Skill 管理路由：规范来源 / 规则库 / 编组 / 分析绑定

把「评估规则」从代码中解放出来，变成可管理的资产：
规范文档 -> AI 抽取 -> 规则库 -> 编组 -> 注入 LLM 分析。
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..llm import chat_json

router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============ 规范来源 skill_sources ============

@router.get("/skill-sources", response_model=list[schemas.SkillSourceM])
def list_skill_sources(db: Session = Depends(get_db)):
    return db.query(models.SkillSource).order_by(models.SkillSource.created_at.desc()).all()


@router.post("/skill-sources", response_model=schemas.SkillSourceM)
def create_skill_source(body: schemas.SkillSourceCreateRequest, db: Session = Depends(get_db)):
    now = _now()
    src = models.SkillSource(
        id=f"sk-src-{uuid.uuid4().hex[:8]}",
        name=body.name, doc_type=body.doc_type, content=body.content,
        source_lang=body.source_lang, description=body.description,
        status="imported", created_at=now, updated_at=now,
    )
    db.add(src)
    db.commit()
    db.refresh(src)
    return src


@router.get("/skill-sources/{src_id}", response_model=schemas.SkillSourceM)
def get_skill_source(src_id: str, db: Session = Depends(get_db)):
    src = db.query(models.SkillSource).filter_by(id=src_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="规范来源不存在")
    return src


@router.delete("/skill-sources/{src_id}")
def delete_skill_source(src_id: str, db: Session = Depends(get_db)):
    src = db.query(models.SkillSource).filter_by(id=src_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="规范来源不存在")
    # 级联不删 skills，仅置 source_id 为 null（规则可能已手工复用）
    db.query(models.Skill).filter_by(source_id=src_id).update({"source_id": None})
    db.delete(src)
    db.commit()
    return {"ok": True, "id": src_id}


@router.post("/skill-sources/{src_id}/extract", response_model=schemas.ExtractResult)
def extract_skills(src_id: str, db: Session = Depends(get_db)):
    """LLM 抽取：调 LLM 从规范 content 生成 skills 草稿并入库（status=extracted）"""
    src = db.query(models.SkillSource).filter_by(id=src_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="规范来源不存在")
    if not src.content or not src.content.strip():
        raise HTTPException(status_code=400, detail="规范内容为空，无法抽取")

    prompt = f"""你是资深代码规范专家。下面是一份编码规范文档，请抽取其中的【可自动审查规则】，
输出严格 JSON（不要 markdown 代码块、不要解释）。

要求：
1. 只抽取"能在代码审查中客观判断"的规则（命名、异常处理、事务、SQL、安全、性能等）；
   跳过纯流程/管理类条款（如"代码需经过评审"）。
2. 每条规则输出字段：
   - name: 规则名（≤30字）
   - category: quality|security|performance|architecture|maintainability|reliability|logic|complexity|configuration|dependency|testing|delivery 之一
   - severity: critical|high|medium|low|info
   - ruleContent: 规则正文（可直接作为 LLM 审查指令的完整句子，≤200字）
   - positiveExample: {{"desc":string,"code":string}} 合规示例（如无则 code 为空字符串）
   - negativeExample: {{"desc":string,"code":string}} 违规示例
3. 抽取 5~30 条，宁缺毋滥。

规范文档：
{src.content}

输出 JSON schema:
{{"skills":[{{"name":string,"category":string,"severity":string,"ruleContent":string,
"positiveExample":{{"desc":string,"code":string}},"negativeExample":{{"desc":string,"code":string}}}}]}}"""

    try:
        data = chat_json([{"role": "user", "content": prompt}], 12000)
    except Exception as e:
        src.status = "failed"
        src.updated_at = _now()
        db.commit()
        return schemas.ExtractResult(
            source_id=src_id, status="failed", extracted=0,
            message=f"LLM 抽取失败: {str(e)[:200]}",
        )

    raw_skills = data.get("skills", []) if isinstance(data, dict) else []
    now = _now()
    count = 0
    for item in raw_skills:
        name = (item.get("name") or "").strip()
        rule_content = (item.get("ruleContent") or item.get("rule_content") or "").strip()
        if not name or not rule_content:
            continue  # 宁缺毋滥：缺关键字段跳过
        db.add(models.Skill(
            id=f"sk-{uuid.uuid4().hex[:8]}",
            source_id=src.id, name=name,
            description=item.get("description", "") or name,
            category=item.get("category", "quality"),
            severity=item.get("severity", "medium"),
            check_type="llm", rule_content=rule_content,
            positive_examples=[item.get("positiveExample") or item.get("positive_example") or {}],
            negative_examples=[item.get("negativeExample") or item.get("negative_example") or {}],
            enabled=1, created_at=now, updated_at=now,
        ))
        count += 1

    src.status = "extracted"
    src.updated_at = now
    db.commit()
    return schemas.ExtractResult(
        source_id=src_id, status="extracted", extracted=count,
        message=f"成功抽取 {count} 条规则",
    )


# ============ 规则库 skills ============

@router.get("/skills", response_model=list[schemas.SkillM])
def list_skills(
    source_id: str | None = Query(default=None),
    category: str | None = Query(default=None),
    enabled: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Skill)
    if source_id:
        q = q.filter_by(source_id=source_id)
    if category:
        q = q.filter_by(category=category)
    if enabled is not None:
        q = q.filter_by(enabled=enabled)
    return q.order_by(models.Skill.created_at.desc()).all()


@router.post("/skills", response_model=schemas.SkillM)
def create_skill(body: schemas.SkillCreateRequest, db: Session = Depends(get_db)):
    now = _now()
    skill = models.Skill(
        id=f"sk-{uuid.uuid4().hex[:8]}",
        source_id=body.source_id, name=body.name, description=body.description,
        category=body.category, severity=body.severity, check_type=body.check_type,
        rule_content=body.rule_content,
        positive_examples=[e.model_dump() for e in body.positive_examples],
        negative_examples=[e.model_dump() for e in body.negative_examples],
        enabled=body.enabled, created_at=now, updated_at=now,
    )
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


@router.patch("/skills/{skill_id}", response_model=schemas.SkillM)
def update_skill(skill_id: str, body: dict = Body(...), db: Session = Depends(get_db)):
    skill = db.query(models.Skill).filter_by(id=skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="规则不存在")
    allowed = {
        "name", "description", "category", "severity", "check_type",
        "rule_content", "enabled", "source_id",
        "positive_examples", "negative_examples",
    }
    for k, v in body.items():
        if k in allowed:
            setattr(skill, k, v)
    skill.updated_at = _now()
    db.commit()
    db.refresh(skill)
    return skill


@router.delete("/skills/{skill_id}")
def delete_skill(skill_id: str, db: Session = Depends(get_db)):
    skill = db.query(models.Skill).filter_by(id=skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="规则不存在")
    db.delete(skill)
    db.commit()
    return {"ok": True, "id": skill_id}


# ============ 编组 skill_groups ============

@router.get("/skill-groups", response_model=list[schemas.SkillGroupM])
def list_skill_groups(db: Session = Depends(get_db)):
    return db.query(models.SkillGroup).order_by(models.SkillGroup.created_at.desc()).all()


@router.post("/skill-groups", response_model=schemas.SkillGroupM)
def create_skill_group(body: schemas.SkillGroupCreateRequest, db: Session = Depends(get_db)):
    now = _now()
    group = models.SkillGroup(
        id=f"skg-{uuid.uuid4().hex[:8]}",
        name=body.name, description=body.description,
        skill_ids=body.skill_ids, analysis_type=body.analysis_type,
        enabled=body.enabled, created_at=now, updated_at=now,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@router.patch("/skill-groups/{group_id}", response_model=schemas.SkillGroupM)
def update_skill_group(group_id: str, body: dict = Body(...), db: Session = Depends(get_db)):
    group = db.query(models.SkillGroup).filter_by(id=group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="编组不存在")
    allowed = {"name", "description", "skill_ids", "analysis_type", "enabled"}
    for k, v in body.items():
        if k in allowed:
            setattr(group, k, v)
    group.updated_at = _now()
    db.commit()
    db.refresh(group)
    return group


@router.delete("/skill-groups/{group_id}")
def delete_skill_group(group_id: str, db: Session = Depends(get_db)):
    group = db.query(models.SkillGroup).filter_by(id=group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="编组不存在")
    db.delete(group)
    db.commit()
    return {"ok": True, "id": group_id}


@router.get("/skill-groups/{group_id}/preview")
def preview_skill_group(group_id: str, db: Session = Depends(get_db)):
    """组内规则预览：返回组 + 规则明细，用于评估前确认"""
    group = db.query(models.SkillGroup).filter_by(id=group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="编组不存在")
    skills = (
        db.query(models.Skill)
        .filter(models.Skill.id.in_(group.skill_ids or []))
        .all()
    )
    # 保持 skill_ids 顺序
    skill_map = {s.id: s for s in skills}
    ordered = [skill_map[sid] for sid in (group.skill_ids or []) if sid in skill_map]
    return {
        "id": group.id, "name": group.name, "description": group.description,
        "analysisType": group.analysis_type, "enabled": group.enabled,
        "skillIds": group.skill_ids or [],
        "skills": [schemas.SkillM.model_validate(s).model_dump(by_alias=True) for s in ordered],
    }


# ============ 分析运行绑定 Skill Group ============

@router.post("/analysis-runs/{run_id}/bind-group", response_model=schemas.AnalysisRun)
def bind_group(run_id: str, body: schemas.BindGroupRequest, db: Session = Depends(get_db)):
    run = db.query(models.AnalysisRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="分析运行不存在")
    group = db.query(models.SkillGroup).filter_by(id=body.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="编组不存在")
    run.skill_group_id = body.group_id
    run.updated_at = _now()
    db.commit()
    db.refresh(run)
    return run
