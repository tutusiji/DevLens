"""项目环境配置盘点路由：把散落在配置文件里的环境信息自动盘点成清单

两种扫描模式：
- full（全量再次更新）：遍历仓库全部配置文件 -> 删除旧条目 -> 重建
- incremental（按此历史更新）：取上次来源文件清单重扫 -> 与现有条目 diff（added/changed/removed）
扫描同步执行（小仓库 <5s），返回 scan 对象含统计。
"""
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from .. import models, schemas
from ..access import TenantContext, require_permission
from ..env_scanner import scan_repo, RawEntry

router = APIRouter()

ENV_LIST = ["dev", "test", "prod", "gray", "common"]
TOOL_LIST = [
    "database", "redis", "nacos", "mq", "kafka", "es", "oss",
    "gateway", "third_party", "other",
]
ENV_SKILL_TOOL_TYPES = set(TOOL_LIST)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve_repo(
    db: Session,
    project_id: str,
    tenant_id: str,
) -> tuple[str | None, models.Project | None]:
    """解析项目本地仓库路径：repo.path -> repos_cache/name -> repos_cache/project.name"""
    p = db.query(models.Project).filter_by(id=project_id, tenant_id=tenant_id).first()
    if not p:
        return None, None
    repo = db.query(models.Repository).filter_by(project_id=project_id, tenant_id=tenant_id).first()
    candidates: list[str] = []
    if repo:
        if repo.path:
            candidates.append(repo.path)
        if repo.name:
            candidates.append(os.path.join(settings.repos_cache, repo.name))
    candidates.append(os.path.join(settings.repos_cache, p.name))
    for c in candidates:
        if c and os.path.isdir(c):
            return c, p
    return None, p


def _clean_values(values: list[str] | None) -> list[str]:
    """规整编辑器输入，避免空字符串/重复项污染规则资产。"""
    output: list[str] = []
    for value in values or []:
        cleaned = str(value or "").strip()
        if cleaned and cleaned not in output:
            output.append(cleaned)
    return output


def _skill_to_scan_config(skill: models.EnvInventorySkill) -> dict:
    """扫描器只接受必要字段，AI 指令仍完整写进本次快照。"""
    return {
        "id": skill.id,
        "slug": skill.slug,
        "name": skill.name,
        "description": skill.description or "",
        "file_patterns": list(skill.file_patterns or []),
        "keywords": list(skill.keywords or []),
        "tool_types": list(skill.tool_types or []),
        "ai_instruction": skill.ai_instruction or "",
        "enabled": int(skill.enabled or 0),
        "built_in": int(skill.built_in or 0),
        "updated_at": skill.updated_at or "",
    }


def _resolve_scan_skills(
    db: Session,
    tenant_id: str,
    requested_ids: list[str] | None,
) -> list[models.EnvInventorySkill]:
    """未指定时采用本租户全部已启用 Skill；指定时仍只接受已启用的本租户规则。"""
    query = db.query(models.EnvInventorySkill).filter_by(tenant_id=tenant_id, enabled=1)
    if requested_ids is not None:
        ids = _clean_values(requested_ids)
        if not ids:
            return []
        query = query.filter(models.EnvInventorySkill.id.in_(ids))
    return query.order_by(models.EnvInventorySkill.created_at, models.EnvInventorySkill.name).all()


# ============ 环境盘点 Skill 资产 ============

@router.get("/env-inventory/skills", response_model=list[schemas.EnvInventorySkillM])
def list_env_inventory_skills(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("rules:read")),
):
    return (
        db.query(models.EnvInventorySkill)
        .filter_by(tenant_id=ctx.tenant_id)
        .order_by(models.EnvInventorySkill.built_in.desc(), models.EnvInventorySkill.created_at)
        .all()
    )


@router.post("/env-inventory/skills", response_model=schemas.EnvInventorySkillM)
def create_env_inventory_skill(
    body: schemas.EnvInventorySkillCreateRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("rules:write")),
):
    name = body.name.strip()
    patterns = _clean_values(body.file_patterns)
    if not name:
        raise HTTPException(status_code=422, detail="Skill 名称不能为空")
    if not patterns:
        raise HTTPException(status_code=422, detail="请至少配置一个文件模式")
    now = _now()
    skill = models.EnvInventorySkill(
        id=f"eisk-{uuid.uuid4().hex[:10]}",
        slug=f"custom-{uuid.uuid4().hex[:8]}",
        name=name,
        description=(body.description or "").strip(),
        file_patterns=patterns,
        keywords=_clean_values(body.keywords),
        tool_types=[tool for tool in _clean_values(body.tool_types) if tool in ENV_SKILL_TOOL_TYPES],
        ai_instruction=(body.ai_instruction or "").strip(),
        enabled=1 if body.enabled else 0,
        built_in=0,
        created_by=ctx.user_id,
        created_at=now,
        updated_at=now,
        tenant_id=ctx.tenant_id,
    )
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


@router.patch("/env-inventory/skills/{skill_id}", response_model=schemas.EnvInventorySkillM)
def update_env_inventory_skill(
    skill_id: str,
    body: schemas.EnvInventorySkillUpdateRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("rules:write")),
):
    skill = db.query(models.EnvInventorySkill).filter_by(
        id=skill_id, tenant_id=ctx.tenant_id,
    ).first()
    if not skill:
        raise HTTPException(status_code=404, detail="环境盘点 Skill 不存在")
    changes = body.model_dump(exclude_unset=True)
    if "name" in changes:
        name = (changes["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=422, detail="Skill 名称不能为空")
        skill.name = name
    if "description" in changes:
        skill.description = (changes["description"] or "").strip()
    if "file_patterns" in changes:
        patterns = _clean_values(changes["file_patterns"])
        if not patterns:
            raise HTTPException(status_code=422, detail="请至少配置一个文件模式")
        skill.file_patterns = patterns
    if "keywords" in changes:
        skill.keywords = _clean_values(changes["keywords"])
    if "tool_types" in changes:
        skill.tool_types = [tool for tool in _clean_values(changes["tool_types"]) if tool in ENV_SKILL_TOOL_TYPES]
    if "ai_instruction" in changes:
        skill.ai_instruction = (changes["ai_instruction"] or "").strip()
    if "enabled" in changes:
        skill.enabled = 1 if changes["enabled"] else 0
    skill.updated_at = _now()
    db.commit()
    db.refresh(skill)
    return skill


@router.delete("/env-inventory/skills/{skill_id}")
def delete_env_inventory_skill(
    skill_id: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("rules:write")),
):
    skill = db.query(models.EnvInventorySkill).filter_by(
        id=skill_id, tenant_id=ctx.tenant_id,
    ).first()
    if not skill:
        raise HTTPException(status_code=404, detail="环境盘点 Skill 不存在")
    if skill.built_in:
        raise HTTPException(status_code=400, detail="默认 Skill 不可删除，可停用或编辑")
    db.delete(skill)
    db.commit()
    return {"ok": True, "id": skill_id}


def _mask_secret_value(value: str) -> str:
    """对标记为敏感的值进行脱敏展示。"""
    if not value:
        return ""
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}****{value[-2:]}"


# ============ 条目列表 ============

@router.get("/projects/{pid}/env-inventory", response_model=list[schemas.EnvInventoryEntryM])
def list_env_inventory(
    pid: str,
    env: str | None = Query(default=None),
    toolType: str | None = Query(default=None),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    if not db.query(models.Project).filter_by(id=pid, tenant_id=ctx.tenant_id).first():
        raise HTTPException(status_code=404, detail="项目不存在")
    query = db.query(models.EnvInventoryEntry).filter_by(project_id=pid)
    if env:
        query = query.filter(models.EnvInventoryEntry.env == env)
    if toolType:
        query = query.filter(models.EnvInventoryEntry.tool_type == toolType)
    if status:
        query = query.filter(models.EnvInventoryEntry.status == status)
    entries = query.order_by(
        models.EnvInventoryEntry.env,
        models.EnvInventoryEntry.tool_type,
        models.EnvInventoryEntry.source_file,
        models.EnvInventoryEntry.key,
    ).all()
    if q:
        ql = q.lower()
        entries = [
            e for e in entries
            if ql in (e.key or "").lower()
            or ql in (e.value or "").lower()
            or ql in (e.source_file or "").lower()
            or ql in (e.tool_name or "").lower()
            or ql in (e.host or "").lower()
            or ql in (e.username or "").lower()
            or ql in (e.database or "").lower()
        ]
    # 敏感值脱敏，防止密钥泄露
    for e in entries:
        if e.is_secret and e.value:
            e.value = _mask_secret_value(e.value)
        if e.is_secret and e.previous_value:
            e.previous_value = _mask_secret_value(e.previous_value)
    return entries


# ============ 概览 ============

@router.get("/projects/{pid}/env-inventory/summary", response_model=schemas.EnvInventorySummaryM)
def env_inventory_summary(
    pid: str, db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    if not db.query(models.Project).filter_by(id=pid, tenant_id=ctx.tenant_id).first():
        raise HTTPException(status_code=404, detail="项目不存在")
    # 仅统计非 removed 的条目（removed 为历史失效项）
    entries = (
        db.query(models.EnvInventoryEntry)
        .filter_by(project_id=pid)
        .filter(models.EnvInventoryEntry.status != "removed")
        .all()
    )
    by_env = {e: 0 for e in ENV_LIST}
    by_tool = {t: 0 for t in TOOL_LIST}
    for e in entries:
        by_env[e.env] = by_env.get(e.env, 0) + 1
        by_tool[e.tool_type] = by_tool.get(e.tool_type, 0) + 1
    last = (
        db.query(models.EnvInventoryScan)
        .filter_by(project_id=pid, status="completed")
        .order_by(models.EnvInventoryScan.started_at.desc())
        .first()
    )
    return schemas.EnvInventorySummaryM(
        project_id=pid,
        total=len(entries),
        by_env=by_env,
        by_tool_type=by_tool,
        last_scan_at=last.finished_at or last.started_at if last else "",
        last_scan_type=last.scan_type if last else "",
    )


# ============ 触发扫描 ============

@router.post("/projects/{pid}/env-inventory/scan", response_model=schemas.EnvInventoryScanM)
def trigger_scan(
    pid: str, body: schemas.EnvInventoryScanRequest, db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:write")),
):
    p = db.query(models.Project).filter_by(id=pid, tenant_id=ctx.tenant_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="项目不存在")
    repo_path, _ = _resolve_repo(db, pid, ctx.tenant_id)
    if not repo_path:
        raise HTTPException(
            status_code=400,
            detail=f"未找到项目本地仓库路径（repos_cache={settings.repos_cache}）",
        )

    scan_type = body.scan_type if body.scan_type in ("full", "incremental") else "full"
    scan_skills = _resolve_scan_skills(db, ctx.tenant_id, body.skill_ids)
    if not scan_skills:
        raise HTTPException(status_code=422, detail="请至少启用一条环境盘点 Skill 后再发起扫描")
    skill_configs = [_skill_to_scan_config(skill) for skill in scan_skills]
    now = _now()
    scan = models.EnvInventoryScan(
        id=f"einv-scan-{uuid.uuid4().hex[:8]}",
        project_id=pid, scan_type=scan_type, status="scanning",
        trigger="manual", started_at=now,
        skill_ids=[skill.id for skill in scan_skills],
        skill_snapshot={skill.id: config for skill, config in zip(scan_skills, skill_configs)},
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    try:
        if scan_type == "full":
            stats = _run_full(db, pid, scan.id, repo_path, now, skill_configs)
        else:
            stats = _run_incremental(db, pid, scan.id, repo_path, now, skill_configs)
        scan.status = "completed"
        scan.finished_at = _now()
        for k, v in stats.items():
            setattr(scan, k, v)
        db.commit()
        db.refresh(scan)
    except Exception as e:
        scan.status = "failed"
        scan.finished_at = _now()
        scan.message = f"扫描失败: {str(e)[:200]}"
        db.commit()
        db.refresh(scan)
    return scan


def _entry_from_raw(raw: RawEntry, pid: str, scan_id: str, now: str, status: str = "active") -> models.EnvInventoryEntry:
    return models.EnvInventoryEntry(
        id=f"einv-{uuid.uuid4().hex[:10]}",
        project_id=pid, scan_id=scan_id,
        env=raw.env, tool_type=raw.tool_type, tool_name=raw.tool_name,
        key=raw.key, value=raw.value, is_secret=raw.is_secret,
        host=raw.host, port=raw.port, username=raw.username, database=raw.database,
        fingerprint=raw.fingerprint, detail=raw.detail,
        source_file=raw.source_file, source_line=raw.source_line, file_mtime=raw.file_mtime,
        first_seen_at=now, updated_at=now, status=status,
    )


def _run_full(
    db: Session, pid: str, scan_id: str, repo_path: str, now: str,
    scan_skills: list[dict],
) -> dict:
    """全量：删除旧条目，重建全部新条目（status=active）"""
    files_scanned, raw_entries = scan_repo(repo_path, scan_skills=scan_skills)
    db.query(models.EnvInventoryEntry).filter_by(project_id=pid).delete()
    db.commit()
    for raw in raw_entries:
        db.add(_entry_from_raw(raw, pid, scan_id, now, status="active"))
    db.commit()
    return {
        "files_scanned": files_scanned,
        "entries_found": len(raw_entries),
        "added": 0, "changed": 0, "removed": 0, "unchanged": 0,
    }


def _run_incremental(
    db: Session, pid: str, scan_id: str, repo_path: str, now: str,
    scan_skills: list[dict],
) -> dict:
    """增量：取上次来源文件清单重扫 -> 与现有条目 diff

    - 文件删除/条目消失 -> status=removed
    - key 相同、value 变化 -> status=changed，previous_value 存旧值
    - 新出现的 key -> status=added
    - 无变化 -> 保持 active
    """
    current = db.query(models.EnvInventoryEntry).filter_by(project_id=pid).all()
    # 历史来源文件清单（仍存在的才重扫）
    history_files = {e.source_file for e in current if e.status != "removed"}
    files_scanned, raw_entries = scan_repo(
        repo_path, only_files=history_files or None, scan_skills=scan_skills,
    )

    # 现有条目按 (source_file, key, source_line) 索引
    # （含 source_line：URL 内嵌提取会产生同文件多个 key="url" 条目，需按行区分）
    old_map: dict[tuple[str, str, int], models.EnvInventoryEntry] = {
        (e.source_file, e.key, e.source_line): e for e in current
    }
    new_map: dict[tuple[str, str, int], RawEntry] = {
        (r.source_file, r.key, r.source_line): r for r in raw_entries
    }

    added = changed = removed = unchanged = 0
    now_ts = now

    # 1. 处理已存在条目：changed / unchanged / removed
    for key, old in old_map.items():
        if key in new_map:
            raw = new_map[key]
            if old.value != raw.value:
                old.status = "changed"
                old.previous_value = old.value
                old.value = raw.value
                old.is_secret = raw.is_secret
                old.tool_type = raw.tool_type
                old.tool_name = raw.tool_name
                old.host = raw.host
                old.port = raw.port
                old.username = raw.username
                old.database = raw.database
                old.fingerprint = raw.fingerprint
                old.detail = raw.detail
                old.scan_id = scan_id
                old.source_line = raw.source_line
                old.file_mtime = raw.file_mtime
                old.updated_at = now_ts
                changed += 1
            else:
                old.status = "active"
                old.previous_value = ""
                old.tool_type = raw.tool_type
                old.tool_name = raw.tool_name
                old.is_secret = raw.is_secret
                old.host = raw.host
                old.port = raw.port
                old.username = raw.username
                old.database = raw.database
                old.fingerprint = raw.fingerprint
                old.detail = raw.detail
                old.scan_id = scan_id
                old.file_mtime = raw.file_mtime
                old.updated_at = now_ts
                unchanged += 1
        else:
            # 条目消失 -> removed
            if old.status != "removed":
                old.status = "removed"
                old.scan_id = scan_id
                old.updated_at = now_ts
                removed += 1
            else:
                # 之前已是 removed，仍未出现 -> 保持
                unchanged += 1

    # 2. 新出现的 key -> added
    for key, raw in new_map.items():
        if key not in old_map:
            entry = _entry_from_raw(raw, pid, scan_id, now_ts, status="added")
            db.add(entry)
            added += 1

    db.commit()
    return {
        "files_scanned": files_scanned,
        "entries_found": len(raw_entries),
        "added": added, "changed": changed, "removed": removed, "unchanged": unchanged,
    }


# ============ 扫描历史 ============

@router.get("/projects/{pid}/env-inventory/scans", response_model=list[schemas.EnvInventoryScanM])
def list_scans(
    pid: str, db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    if not db.query(models.Project).filter_by(id=pid, tenant_id=ctx.tenant_id).first():
        raise HTTPException(status_code=404, detail="项目不存在")
    return (
        db.query(models.EnvInventoryScan)
        .filter_by(project_id=pid)
        .order_by(models.EnvInventoryScan.started_at.desc())
        .all()
    )


@router.get("/projects/{pid}/env-inventory/scans/{scan_id}")
def get_scan_detail(
    pid: str, scan_id: str, db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    if not db.query(models.Project).filter_by(id=pid, tenant_id=ctx.tenant_id).first():
        raise HTTPException(status_code=404, detail="项目不存在")
    scan = db.query(models.EnvInventoryScan).filter_by(id=scan_id, project_id=pid).first()
    if not scan:
        raise HTTPException(status_code=404, detail="扫描记录不存在")
    # 该次扫描产生/更新的条目（按 scan_id 关联；增量扫描变更项可能 scan_id 为旧值，补充状态过滤）
    entries = (
        db.query(models.EnvInventoryEntry)
        .filter_by(project_id=pid)
        .filter(
            (models.EnvInventoryEntry.scan_id == scan_id)
            | (models.EnvInventoryEntry.status.in_(["added", "changed", "removed"]))
        )
        .order_by(models.EnvInventoryEntry.source_file, models.EnvInventoryEntry.key)
        .all()
    )
    # 敏感值脱敏
    for e in entries:
        if e.is_secret and e.value:
            e.value = _mask_secret_value(e.value)
        if e.is_secret and e.previous_value:
            e.previous_value = _mask_secret_value(e.previous_value)
    return {
        "scan": schemas.EnvInventoryScanM.model_validate(scan).model_dump(by_alias=True),
        "entries": [
            schemas.EnvInventoryEntryM.model_validate(e).model_dump(by_alias=True)
            for e in entries
        ],
    }


# ============ 条目更新（P0 留空实现：仅备注类）============

@router.patch("/projects/{pid}/env-inventory/entries/{eid}", response_model=schemas.EnvInventoryEntryM)
def update_entry(
    pid: str, eid: str, body: dict = Body(...), db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:write")),
):
    if not db.query(models.Project).filter_by(id=pid, tenant_id=ctx.tenant_id).first():
        raise HTTPException(status_code=404, detail="项目不存在")
    entry = db.query(models.EnvInventoryEntry).filter_by(id=eid, project_id=pid).first()
    if not entry:
        raise HTTPException(status_code=404, detail="配置条目不存在")
    # P0 仅允许更新 status（备注类），其余字段只读
    if "status" in body:
        entry.status = body["status"]
    entry.updated_at = _now()
    db.commit()
    db.refresh(entry)
    return entry
