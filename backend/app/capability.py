"""能力标准管理 API 与默认阈值生成规则。"""
from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from . import models, schemas
from .db import get_db


router = APIRouter(tags=["capability-standards"])


# D > E > F > G；同一大级内 3 > 2 > 1。
LEVEL_BASE: dict[str, int] = {
    "D1": 88, "D2": 92, "D3": 96,
    "E1": 72, "E2": 76, "E3": 80,
    "F1": 60, "F2": 64, "F3": 68,
    "G1": 48, "G2": 52, "G3": 56,
}

DIMENSION_OFFSET: dict[str, int] = {
    "code_quality": 5,
    "architecture": 0,
    "stability": 3,
    "efficiency": 2,
    "collaboration": 0,
    "security_aware": 8,
    "test_coverage": -2,
    "growth_velocity": -5,
    "ui_quality": 0,
    "responsive": -3,
    "automation": 0,
    "monitoring": 2,
    "doc_quality": -5,
    "modeling": 0,
    "experiment_efficiency": 3,
    "test_design": 5,
    "coverage": 0,
}

ROLE_DIMENSIONS: dict[str, list[str]] = {
    "frontend": [
        "code_quality", "architecture", "ui_quality", "responsive",
        "collaboration", "security_aware", "test_coverage", "growth_velocity",
    ],
    "backend": [
        "code_quality", "architecture", "stability", "efficiency",
        "collaboration", "security_aware", "test_coverage", "growth_velocity",
    ],
    "devops": [
        "automation", "monitoring", "stability", "efficiency",
        "collaboration", "security_aware", "doc_quality", "growth_velocity",
    ],
    "algorithm": [
        "code_quality", "modeling", "experiment_efficiency", "stability",
        "collaboration", "security_aware", "test_coverage", "growth_velocity",
    ],
    "qa": [
        "code_quality", "test_design", "coverage", "stability",
        "collaboration", "security_aware", "automation", "growth_velocity",
    ],
}

DIMENSION_LABELS: dict[str, str] = {
    "code_quality": "代码质量",
    "architecture": "架构能力",
    "stability": "稳定性",
    "efficiency": "交付效率",
    "collaboration": "协作能力",
    "security_aware": "安全意识",
    "test_coverage": "测试覆盖",
    "growth_velocity": "成长速度",
    "ui_quality": "UI 质量",
    "responsive": "响应式",
    "automation": "自动化",
    "monitoring": "监控",
    "doc_quality": "文档质量",
    "modeling": "建模能力",
    "experiment_efficiency": "实验效率",
    "test_design": "测试设计",
    "coverage": "覆盖率",
}

ALL_LEVELS = [
    "D3", "D2", "D1",
    "E3", "E2", "E1",
    "F3", "F2", "F1",
    "G3", "G2", "G1",
]

LEVEL_GROUPS = [
    {"prefix": "D", "label": "稀缺高阶", "range": "D1-D3"},
    {"prefix": "E", "label": "资深", "range": "E1-E3"},
    {"prefix": "F", "label": "中级", "range": "F1-F3"},
    {"prefix": "G", "label": "初级", "range": "G1-G3"},
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clamp(score: int) -> int:
    return max(0, min(100, score))


def _default_thresholds_for_dimensions(dimensions: list[str], level: str) -> dict[str, int]:
    base = LEVEL_BASE.get(level, 60)
    return {
        dimension: _clamp(base + DIMENSION_OFFSET.get(dimension, 0))
        for dimension in dimensions
    }


def default_thresholds(role_key: str, level: str) -> dict[str, int]:
    """根据角色的默认维度与职级基线生成标准分。"""
    return _default_thresholds_for_dimensions(ROLE_DIMENSIONS.get(role_key, []), level)


def _meta() -> dict:
    return {
        "dimensionLabels": DIMENSION_LABELS,
        "allLevels": ALL_LEVELS,
        "levelGroups": LEVEL_GROUPS,
        "defaultDimensions": ROLE_DIMENSIONS,
    }


def _find_role(role_key: str, db: Session) -> models.CapabilityRole:
    role = db.query(models.CapabilityRole).filter_by(key=role_key).first()
    if not role:
        raise HTTPException(status_code=404, detail="能力角色不存在")
    return role


def _validate_dimensions(dimensions: list[str]) -> None:
    if not dimensions:
        raise HTTPException(status_code=422, detail="至少需要保留一个能力维度")
    unknown = [dimension for dimension in dimensions if dimension not in DIMENSION_LABELS]
    if unknown:
        raise HTTPException(status_code=422, detail=f"未知能力维度: {', '.join(unknown)}")
    if len(set(dimensions)) != len(dimensions):
        raise HTTPException(status_code=422, detail="能力维度不能重复")


def _validate_thresholds(
    thresholds: dict[str, int],
    dimensions: list[str],
) -> None:
    unknown = [dimension for dimension in thresholds if dimension not in dimensions]
    if unknown:
        raise HTTPException(status_code=422, detail=f"阈值包含非当前角色维度: {', '.join(unknown)}")
    invalid = [
        dimension
        for dimension, score in thresholds.items()
        if isinstance(score, bool) or not isinstance(score, int) or not 0 <= score <= 100
    ]
    if invalid:
        raise HTTPException(status_code=422, detail=f"阈值必须是 0-100 的整数: {', '.join(invalid)}")


def _validate_skill_group(skill_group_id: str | None, db: Session) -> None:
    if skill_group_id and not db.query(models.SkillGroup).filter_by(id=skill_group_id).first():
        raise HTTPException(status_code=422, detail="关联的 Skill 组不存在")


def _serialize_role(role: models.CapabilityRole, db: Session) -> dict:
    dimensions = list(role.dimensions or ROLE_DIMENSIONS.get(role.key, []))
    rows = (
        db.query(models.CapabilityStandard)
        .filter_by(role_id=role.id)
        .all()
    )
    rows_by_level = {row.level: row for row in rows}
    standards: dict[str, dict[str, int]] = {}
    for level in ALL_LEVELS:
        defaults = _default_thresholds_for_dimensions(dimensions, level)
        saved = (rows_by_level.get(level).thresholds if rows_by_level.get(level) else {}) or {}
        standards[level] = {
            dimension: _clamp(int(saved.get(dimension, defaults[dimension])))
            for dimension in dimensions
        }

    skill_group_name = None
    if role.skill_group_id:
        group = db.query(models.SkillGroup).filter_by(id=role.skill_group_id).first()
        skill_group_name = group.name if group else None

    return {
        "roleKey": role.key,
        "roleName": role.name,
        "dimensions": dimensions,
        "skillGroupId": role.skill_group_id,
        "skillGroupName": skill_group_name,
        "standards": standards,
    }


@router.get("/capability-standards/meta", response_model=schemas.CapabilityMetaM)
def get_capability_meta():
    return _meta()


@router.get("/capability-standards", response_model=schemas.CapabilityStandardsResponse)
def get_capability_standards(db: Session = Depends(get_db)):
    roles = (
        db.query(models.CapabilityRole)
        .filter_by(enabled=1)
        .order_by(models.CapabilityRole.id)
        .all()
    )
    return {"roles": [_serialize_role(role, db) for role in roles], "meta": _meta()}


@router.get("/capability-standards/{role_key}", response_model=schemas.CapabilityRoleM)
def get_capability_role(role_key: str, db: Session = Depends(get_db)):
    return _serialize_role(_find_role(role_key, db), db)


@router.put("/capability-standards/{role_key}", response_model=schemas.CapabilityRoleM)
def save_capability_role(
    role_key: str,
    body: schemas.CapabilitySaveRequest,
    db: Session = Depends(get_db),
):
    """原子替换单角色的维度、12 个职级阈值和关联 Skill Group。"""
    role = _find_role(role_key, db)
    _validate_dimensions(body.dimensions)
    _validate_skill_group(body.skill_group_id, db)

    invalid_levels = [level for level in body.standards if level not in ALL_LEVELS]
    if invalid_levels:
        raise HTTPException(status_code=422, detail=f"未知职级: {', '.join(invalid_levels)}")
    for thresholds in body.standards.values():
        _validate_thresholds(thresholds, body.dimensions)

    now = _now()
    try:
        role.dimensions = body.dimensions
        role.skill_group_id = body.skill_group_id
        role.updated_at = now

        # 全量保存使用替换语义：消除旧维度残留，并为缺失职级补齐公式默认值。
        db.query(models.CapabilityStandard).filter_by(role_id=role.id).delete(
            synchronize_session=False
        )
        for level in ALL_LEVELS:
            defaults = _default_thresholds_for_dimensions(body.dimensions, level)
            supplied = body.standards.get(level, {})
            db.add(models.CapabilityStandard(
                id=f"cstd-{uuid.uuid4().hex[:12]}",
                role_id=role.id,
                level=level,
                thresholds={**defaults, **supplied},
                updated_at=now,
            ))
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(role)
    return _serialize_role(role, db)


@router.patch(
    "/capability-standards/{role_key}/levels/{level}",
    response_model=schemas.CapabilityRoleM,
)
def patch_capability_level(
    role_key: str,
    level: str,
    body: schemas.CapabilityLevelPatchRequest,
    db: Session = Depends(get_db),
):
    """仅更新一个职级的部分维度阈值。"""
    if level not in ALL_LEVELS:
        raise HTTPException(status_code=422, detail="未知职级")
    role = _find_role(role_key, db)
    dimensions = list(role.dimensions or ROLE_DIMENSIONS.get(role.key, []))
    _validate_thresholds(body.thresholds, dimensions)

    standard = (
        db.query(models.CapabilityStandard)
        .filter_by(role_id=role.id, level=level)
        .first()
    )
    defaults = _default_thresholds_for_dimensions(dimensions, level)
    now = _now()
    if standard:
        current = standard.thresholds or {}
        standard.thresholds = {
            dimension: body.thresholds.get(
                dimension,
                current.get(dimension, defaults[dimension]),
            )
            for dimension in dimensions
        }
        standard.updated_at = now
    else:
        standard = models.CapabilityStandard(
            id=f"cstd-{uuid.uuid4().hex[:12]}",
            role_id=role.id,
            level=level,
            thresholds={**defaults, **body.thresholds},
            updated_at=now,
        )
        db.add(standard)

    role.updated_at = now
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(role)
    return _serialize_role(role, db)


@router.post("/capability-standards/reset", response_model=schemas.CapabilityStandardsResponse)
def reset_capability_standards(db: Session = Depends(get_db)):
    """按默认公式重建全部角色的 12 个职级阈值。"""
    roles = db.query(models.CapabilityRole).all()
    now = _now()
    try:
        for role in roles:
            dimensions = ROLE_DIMENSIONS.get(role.key, list(role.dimensions or []))
            role.dimensions = dimensions
            role.updated_at = now
            db.query(models.CapabilityStandard).filter_by(role_id=role.id).delete(
                synchronize_session=False
            )
            for level in ALL_LEVELS:
                db.add(models.CapabilityStandard(
                    id=f"cstd-{uuid.uuid4().hex[:12]}",
                    role_id=role.id,
                    level=level,
                    thresholds=default_thresholds(role.key, level),
                    updated_at=now,
                ))
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"roles": [_serialize_role(role, db) for role in roles], "meta": _meta()}
