"""开发者路由：列表 / 详情"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..access import TenantContext, require_permission

router = APIRouter()


@router.get("/developers", response_model=list[schemas.Developer])
def list_developers(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("developer:read")),
):
    return db.query(models.Developer).filter_by(tenant_id=ctx.tenant_id).all()


@router.get("/developers/{did}", response_model=schemas.DeveloperDetail)
def get_developer(
    did: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("developer:read")),
):
    d = db.query(models.Developer).filter_by(id=did, tenant_id=ctx.tenant_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="开发者不存在")
    # 项目参与关系以项目 contributor_list 为事实来源；开发者画像不再孤立地
    # 展示“主导模块”，而是明确其所属项目。后续 Git 贡献聚合可直接写入
    # developer.project_contributions 覆盖/补充这份派生结果。
    projects = db.query(models.Project).filter_by(tenant_id=ctx.tenant_id).all()
    project_map = {project.id: project for project in projects}
    persisted = {
        str(item.get("project_id") or item.get("projectId")): dict(item)
        for item in (d.project_contributions or [])
        if isinstance(item, dict) and (item.get("project_id") or item.get("projectId"))
    }
    for project in projects:
        contributor = next(
            (
                item for item in (project.contributor_list or [])
                if str(item.get("username") or "").lower() == (d.username or "").lower()
            ),
            None,
        )
        if contributor:
            existing = persisted.get(project.id, {})
            persisted[project.id] = {
                **existing,
                "project_id": project.id,
                "commits": int(existing.get("commits", contributor.get("commits", 0)) or 0),
                "reviews": int(existing.get("reviews", contributor.get("reviews", 0)) or 0),
                "ownership": int(existing.get("ownership", contributor.get("ownership", 0)) or 0),
            }

    detail_payload = {
        column.name: getattr(d, column.name)
        for column in d.__table__.columns
    }
    detail_payload.update({
        "capability": d.capability or {},
        "team_capability_avg": d.team_capability_avg or {},
        "growth_curve": d.growth_curve or [],
        "behavior_evidence": d.behavior_evidence or [],
        "partners": d.partners or [],
        "modules": d.modules or [],
        "ai_suggestion": d.ai_suggestion or "",
    })
    detail = schemas.DeveloperDetail.model_validate(detail_payload)
    # 早期或仅列表导入的开发者可能没有完整画像 JSON。ORM 中的 NULL 会覆盖
    # Pydantic 的默认值，因此在派生模块和项目参与关系前统一归一化为空集合。
    detail.capability = detail.capability or {}
    detail.team_capability_avg = detail.team_capability_avg or {}
    detail.growth_curve = detail.growth_curve or []
    detail.behavior_evidence = detail.behavior_evidence or []
    detail.partners = detail.partners or []
    detail.modules = detail.modules or []
    detail.projects = detail.projects or []
    primary_project_id = (
        max(
            persisted.items(),
            key=lambda item: (
                int(item[1].get("commits", 0) or 0) + int(item[1].get("reviews", 0) or 0),
                int(item[1].get("ownership", 0) or 0),
            ),
        )[0]
        if persisted else ""
    )
    for module in detail.modules:
        # 旧数据没有 project_id 时归入该开发者当前贡献量最高的项目；不要仅凭
        # 同名模块跨项目猜测归属，避免“permission”等通用模块名串项目。
        project_id = module.project_id or primary_project_id
        project = project_map.get(project_id)
        module.project_id = project_id or None
        module.project_name = project.name if project else ""

    module_counts: dict[str, int] = {}
    for module in detail.modules:
        if module.project_id:
            module_counts[module.project_id] = module_counts.get(module.project_id, 0) + 1

    detail.projects = [
        schemas.DeveloperProjectContribution(
            project_id=project_id,
            project_name=project_map[project_id].name if project_id in project_map else str(item.get("project_name") or item.get("projectName") or "已归档项目"),
            project_score=int(project_map[project_id].score or 0) if project_id in project_map else 0,
            project_status=str(project_map[project_id].status or "") if project_id in project_map else "",
            role=str(item.get("role") or ("主导贡献" if int(item.get("ownership", 0) or 0) >= 60 else "核心贡献")),
            commits=int(item.get("commits", 0) or 0),
            reviews=int(item.get("reviews", 0) or 0),
            ownership=int(item.get("ownership", 0) or 0),
            module_count=module_counts.get(project_id, int(item.get("module_count", item.get("moduleCount", 0)) or 0)),
            last_active_at=str(item.get("last_active_at") or item.get("lastActiveAt") or ""),
        )
        for project_id, item in persisted.items()
    ]
    detail.projects.sort(key=lambda item: (item.commits + item.reviews, item.ownership), reverse=True)
    return detail
