"""开发者能力实测评估引擎：git 作者代码采样 → LLM 打分 → 职级判定。"""
from datetime import datetime, timezone
import json
from typing import Any

from . import models
from .analyzer import _load_group_rules
from .capability import (
    ALL_LEVELS,
    DIMENSION_LABELS,
    ROLE_DIMENSIONS,
    ROLE_NAMES,
    default_thresholds,
)
from .git_collect import collect_author_code
from .llm import chat_json
from .vcs import ensure_remote_repo


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clamp(value: int) -> int:
    return max(0, min(100, value))


def _to_score(value: Any, default: int = 60) -> int:
    """将 LLM 返回值容错转换为 0-100 整数。"""
    if isinstance(value, bool):
        return default
    try:
        return _clamp(int(value))
    except (TypeError, ValueError, OverflowError):
        try:
            return _clamp(int(float(value)))
        except (TypeError, ValueError, OverflowError):
            return default


def _role_dimensions(
    db,
    role_key: str,
    tenant_id: str | None = None,
) -> tuple[list[str], models.CapabilityRole | None]:
    query = db.query(models.CapabilityRole).filter_by(key=role_key)
    if tenant_id:
        query = query.filter_by(tenant_id=tenant_id)
    role = query.first()
    dimensions = list(role.dimensions or []) if role else []
    return dimensions or list(ROLE_DIMENSIONS.get(role_key, [])), role


def build_evaluation_prompt(
    *,
    role_name: str,
    dimensions: list[str],
    group: dict | None,
    git_author: str,
    commits: int,
    samples: list[dict],
) -> str:
    """构建中文评估 prompt，并让 LLM 只返回可解析的 JSON 对象。"""
    dimension_lines = "\n".join(
        f"- {dimension}（{DIMENSION_LABELS.get(dimension, dimension)}）"
        for dimension in dimensions
    )
    score_template = {dimension: 0 for dimension in dimensions}

    rules_section = ""
    rules = group.get("skills", []) if group else []
    if rules:
        rule_lines = "\n".join(
            f"- [{rule.get('severity', 'medium')}] {rule.get('name', '未命名规则')}："
            f"{rule.get('rule_content', '')}"
            for rule in rules
        )
        rules_section = f"\n【编码规范规则】（必须逐条检查代码是否命中）\n{rule_lines}\n"

    code = "\n\n".join(
        f"--- {sample.get('path', 'unknown')} ---\n{sample.get('content', '')}"
        for sample in samples
    ) or "（未采样到当前可读取的代码文件，请基于提交信息谨慎给出保守评分。）"
    evidence_template = [
        {
            "dimension": dimension,
            "summary": "打分依据一句话",
            "rules": [{"rule": "规则名", "hit": False, "note": "命中/未命中说明"}],
        }
        for dimension in dimensions
    ]

    return f"""你是资深{role_name}面试官，依据以下评估维度与编码规范规则，对一名开发者的真实代码贡献进行能力评分。

【评估维度】（每维 0-100 整数分）
{dimension_lines}
{rules_section}
【该开发者代码样本】（git 作者 {git_author}，共 {commits} 次提交，采样 {len(samples)} 个文件）
{code}

输出严格 JSON（不要 markdown 代码块、不要解释）：
{json.dumps({"scores": score_template, "evidence": evidence_template, "summary": "整体评价 2-3 句话"}, ensure_ascii=False)}

要求：
- scores 每维必须是纯数字 0-100，禁止描述文字
- evidence 必须覆盖每个维度（数组长度 == 维度数）
- rules 里每条规则都要出现（hit 表示代码中是否命中该规则风险）
- 只输出 JSON 对象"""


def _thresholds_by_level(
    db,
    role_key: str,
    dimensions: list[str],
    role: models.CapabilityRole | None = None,
    tenant_id: str | None = None,
) -> dict[str, dict[str, int]]:
    """读取持久化阈值，缺失的职级或维度均回退到 capability 默认公式。"""
    if role is None:
        query = db.query(models.CapabilityRole).filter_by(key=role_key)
        if tenant_id:
            query = query.filter_by(tenant_id=tenant_id)
        role = query.first()
    stored: dict[str, dict] = {}
    if role:
        for standard in db.query(models.CapabilityStandard).filter_by(role_id=role.id).all():
            stored[standard.level] = standard.thresholds or {}

    thresholds_by_level: dict[str, dict[str, int]] = {}
    for level in ALL_LEVELS:
        defaults = default_thresholds(role_key, level)
        current = stored.get(level, {})
        thresholds_by_level[level] = {
            dimension: _to_score(current.get(dimension, defaults.get(dimension, 60)))
            for dimension in dimensions
        }
    return thresholds_by_level


def _judge_level(
    scores: dict,
    role_key: str,
    db,
    tenant_id: str | None = None,
) -> tuple[str | None, str, list[dict]]:
    """返回（达标职级、最接近参考职级、目标职级未达标维度差距）。"""
    dimensions, role = _role_dimensions(db, role_key, tenant_id)
    if not dimensions:
        raise ValueError(f"角色 {role_key} 未配置能力维度")

    normalized_scores = {
        dimension: _to_score(scores.get(dimension), 60)
        for dimension in dimensions
    }
    thresholds_by_level = _thresholds_by_level(db, role_key, dimensions, role, tenant_id)

    achieved_level = next(
        (
            level
            for level in ALL_LEVELS
            if all(
                normalized_scores[dimension] >= thresholds_by_level[level][dimension]
                for dimension in dimensions
            )
        ),
        None,
    )
    best_level = min(
        ALL_LEVELS,
        key=lambda level: sum(
            (normalized_scores[dimension] - thresholds_by_level[level][dimension]) ** 2
            for dimension in dimensions
        ),
    )

    # 已达标时展示下一档作为持续成长目标；尚未达标时展示最接近的参考职级。
    target_level = best_level
    if achieved_level:
        achieved_index = ALL_LEVELS.index(achieved_level)
        if achieved_index + 1 < len(ALL_LEVELS):
            target_level = ALL_LEVELS[achieved_index + 1]
    gaps = [
        {
            "dimension": dimension,
            "current": normalized_scores[dimension],
            "target": thresholds_by_level[target_level][dimension],
            "gap": thresholds_by_level[target_level][dimension] - normalized_scores[dimension],
        }
        for dimension in dimensions
        if thresholds_by_level[target_level][dimension] > normalized_scores[dimension]
    ]
    return achieved_level, best_level, gaps


def _normalize_evidence(raw_evidence: Any) -> list[dict]:
    """容错保留 LLM 的证据列表；非列表返回空列表。"""
    if not isinstance(raw_evidence, list):
        return []
    return [item for item in raw_evidence if isinstance(item, dict)]


def evaluate_developer(db, evaluation_id: str) -> None:
    """后台线程入口：完成一条 developer_evaluations 记录的完整实测。"""
    evaluation = db.query(models.DeveloperEvaluation).filter_by(id=evaluation_id).first()
    if not evaluation:
        return

    try:
        developer = db.query(models.Developer).filter_by(id=evaluation.developer_id).first()
        if not developer:
            raise ValueError("开发者不存在")

        dimensions, role = _role_dimensions(db, evaluation.role_key, evaluation.tenant_id)
        if not dimensions:
            raise ValueError(f"角色 {evaluation.role_key} 未配置能力维度")

        repo = db.query(models.Repository).filter_by(
            project_id=evaluation.project_id, tenant_id=evaluation.tenant_id,
        ).first()
        if not repo or not repo.remote_url:
            raise ValueError("评估目标项目缺少远程仓库配置")

        repo_path = ensure_remote_repo(
            repo_url=repo.remote_url,
            project_id=repo.project_id,
            tenant_id=evaluation.tenant_id,
            branch=evaluation.branch or repo.branch or "main",
            access_token_encrypted=repo.access_token_encrypted,
        )
        evaluation.repo_path = repo_path
        db.commit()

        collected = collect_author_code(repo_path, evaluation.git_author, branch=evaluation.branch or repo.branch)
        if collected["commits"] == 0:
            raise ValueError("git 作者无提交记录")

        group = _load_group_rules(db, evaluation.skill_group_id, evaluation.tenant_id)
        if group:
            # 规则是资产：评估记录永久保留本次实际投入模型的规则快照，
            # 后续规则编辑不会改变历史评分的审计依据。
            evaluation.rule_snapshot = group
        role_name = role.name if role else ROLE_NAMES.get(evaluation.role_key, evaluation.role_key)
        prompt = build_evaluation_prompt(
            role_name=role_name,
            dimensions=dimensions,
            group=group,
            git_author=evaluation.git_author,
            commits=collected["commits"],
            samples=collected["samples"],
        )
        result = chat_json([{"role": "user", "content": prompt}], 8000)
        result = result if isinstance(result, dict) else {}
        raw_scores = result.get("scores")
        raw_scores = raw_scores if isinstance(raw_scores, dict) else {}
        scores = {
            dimension: _to_score(raw_scores.get(dimension), 60)
            for dimension in dimensions
        }
        achieved_level, best_level, gaps = _judge_level(
            scores, evaluation.role_key, db, evaluation.tenant_id,
        )

        summary = result.get("summary")
        evaluation.scores = scores
        evaluation.evidence = _normalize_evidence(result.get("evidence"))
        evaluation.achieved_level = achieved_level
        evaluation.best_level = best_level
        evaluation.gaps = gaps
        evaluation.summary = summary[:2000] if isinstance(summary, str) else ""
        evaluation.status = "completed"
        evaluation.error = ""
        evaluation.updated_at = _now()
        db.commit()
    except Exception as exc:
        db.rollback()
        failed = db.query(models.DeveloperEvaluation).filter_by(id=evaluation_id).first()
        if failed:
            failed.status = "failed"
            failed.error = str(exc)[:200]
            failed.updated_at = _now()
            db.commit()
