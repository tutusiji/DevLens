"""Skill 驱动的分析规则装配。

核心原则：**每个分析模块的评估规则都是 Skill 资产，不写死在分析代码里**。
- 每个模块（repo_analysis / developer_evaluation / skills_matrix / iceberg /
  swot / hiring_advice / growth_advice / career_path / env_scan）对应一个
  ``analysis_type`` 的 SkillGroup。
- SkillGroup.prompt_template 提供 prompt 骨架（{变量} 占位），组内 skills 的
  rule_content 注入其中。
- 内置默认组由 seed 写入数据库；租户可在「Skill 管理」或各模块的规则抽屉中
  编辑，分析时始终读库，实现"规则可配、默认内置、随处可改"。
"""
import re
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from . import models

# 每个模块的默认 prompt 模板（仅作为 seed 数据源；分析时从数据库读取）
BUILTIN_GROUP_TEMPLATES: dict[str, str] = {
    "swot": (
        "你是组织发展顾问。请基于以下团队数据生成 SWOT 分析：\n"
        "团队：{team_name}\n"
        "团队成员：\n{member_lines}\n"
        "团队能力均值：\n{cap_lines}\n"
        "相关项目健康度：\n{proj_lines}\n"
        "能力缺口：\n{gap_lines}\n"
        "评估规则：\n{rules}\n"
        "请输出严格 JSON（不要多余文字）：\n"
        '{"strengths":["..."],"weaknesses":["..."],"opportunities":["..."],"threats":["..."]}\n'
        "每类 3-4 条，每条一句话，务实具体、基于给定数据，不要编造。"
    ),
    "hiring_advice": (
        "你是研发团队负责人。请基于以下团队情况给出招聘建议：\n"
        "团队：{team_name}\n"
        "团队成员：\n{member_lines}\n"
        "能力缺口：\n{gap_lines}\n"
        "评估规则：\n{rules}\n"
        "请用中文输出，结构：\n"
        "1. 团队现状一句话判断\n"
        "2. 最值得补充的 1-3 个岗位，每个给出：岗位、理由、优先级（高/中/低）\n"
        "3. 若现有成员通过培养即可补齐缺口，说明应优先内部培养的方向\n"
        "控制在 400 字以内，务实具体。"
    ),
    "growth_advice": (
        "你是一名软件研发团队的技术负责人。请为一名开发者生成个性化的成长建议。\n"
        "开发者：{dev_name}（职级 {dev_level}，角色 {dev_role}）\n"
        "最近一次能力实测评分：\n{score_lines}\n"
        "与职级标准的差距：\n{gap_lines}\n"
        "评估规则：\n{rules}\n"
        "请用中文输出，结构为：\n"
        "1. 一句话总评（当前能力定位）\n"
        "2. 最值得优先提升的 2-3 个维度，各给一条可执行行动（具体到做事的动作，而非口号）\n"
        "3. 建议的学习/实践路径（按周划分，最多 3 条）\n"
        "控制在 400 字以内，语气务实、不空泛。"
    ),
    "career_path": (
        "你是研发职级评审专家。请为该开发者推荐合理的晋升路径。\n"
        "开发者：{dev_name}（当前职级 {dev_level}，角色 {dev_role}）\n"
        "能力实测评分：\n{score_lines}\n"
        "与职级标准差距：\n{gap_lines}\n"
        "评估规则：\n{rules}\n"
        "请用中文输出，结构：\n"
        "1. 当前职级定位判断（距离下一职级的整体成熟度 %）\n"
        "2. 达成下一职级最关键的 2-3 个差距点与量化标准\n"
        "3. 建议的时间线（按季度划分，如 Q3 达标 → Q4 申报）\n"
        "4. 需要上级/团队提供的支持（1-2 条）\n"
        "控制在 400 字以内，标准要可衡量。"
    ),
    "skills_matrix": (
        "你是一名研发效能分析师。请基于以下团队技能矩阵数据，输出团队技能诊断：\n"
        "团队：{team_name}\n"
        "成员：{member_count} 人\n"
        "能力维度：{dims}\n"
        "团队均值：\n{team_avg}\n"
        "评估规则：\n{rules}\n"
        "请用中文输出，结构：\n"
        "1. 团队技能分布一句话判断\n"
        "2. 强项维度（≥80）与短板维度（<60）各列 1-2 个\n"
        "3. 建议的技能梯队建设动作（1-2 条）\n"
        "控制在 250 字以内。"
    ),
    "iceberg": (
        "你是一名组织行为分析师。请基于以下团队冰山模型数据（显性能力 + 隐性行为）输出诊断：\n"
        "团队：{team_name}\n"
        "显性能力：\n{explicit_lines}\n"
        "隐性行为：\n{implicit_lines}\n"
        "评估规则：\n{rules}\n"
        "请用中文输出，结构：\n"
        "1. 显性能力均衡性判断\n"
        "2. 隐性特质中值得关注的风险或亮点（提交节奏/稳定性/协作）\n"
        "3. 一条管理建议\n"
        "控制在 250 字以内。"
    ),
}

# 每个模块默认组内的内置规则（rule_content 注入 prompt）
BUILTIN_GROUP_RULES: dict[str, list[dict]] = {
    "swot": [
        {"name": "基于数据不编造", "category": "quality", "severity": "medium",
         "rule_content": "SWOT 各象限必须基于给定的团队/项目/缺口数据推导，禁止编造成员或项目。"},
        {"name": "四象限完整", "category": "quality", "severity": "low",
         "rule_content": "strengths/weaknesses/opportunities/threats 四类各至少 2 条，每条一句话。"},
    ],
    "hiring_advice": [
        {"name": "岗位务实", "category": "quality", "severity": "medium",
         "rule_content": "招聘岗位建议需与团队能力缺口直接对应，给出优先级（高/中/低）与理由。"},
        {"name": "内外结合", "category": "quality", "severity": "low",
         "rule_content": "先判断能否通过内部培养补齐缺口，再建议外部招聘。"},
    ],
    "growth_advice": [
        {"name": "可执行", "category": "quality", "severity": "high",
         "rule_content": "成长建议必须落到具体可执行的动作（做哪件事、怎么练），禁止空泛口号。"},
        {"name": "基于差距", "category": "quality", "severity": "high",
         "rule_content": "优先提升方向必须来自评估中的真实差距项，而非模板化输出。"},
    ],
    "career_path": [
        {"name": "标准可衡量", "category": "quality", "severity": "high",
         "rule_content": "晋升路径的达标标准必须可量化（评分/交付物/行为指标），禁止模糊表述。"},
        {"name": "时间线明确", "category": "quality", "severity": "medium",
         "rule_content": "必须给出按季度划分的时间线（如 Q3 达标 → Q4 申报）。"},
    ],
    "skills_matrix": [
        {"name": "诊断而非罗列", "category": "quality", "severity": "medium",
         "rule_content": "技能矩阵诊断需指出强项/短板/梯队缺口，输出可执行的技能建设建议。"},
    ],
    "iceberg": [
        {"name": "显隐分层", "category": "quality", "severity": "medium",
         "rule_content": "显性能力看技能水平，隐性特质看行为模式（节奏/稳定性/协作），分层输出诊断。"},
    ],
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_group(db: Session, tenant_id: str, analysis_type: str) -> models.SkillGroup | None:
    """取租户内某分析模块启用的默认 SkillGroup。"""
    return (
        db.query(models.SkillGroup)
        .filter_by(analysis_type=analysis_type, enabled=1, tenant_id=tenant_id)
        .first()
    )


def format_rules(group: models.SkillGroup, db: Session | None = None) -> str:
    """把组内 skills 的 rule_content 组装成可注入的规则文本。"""
    rules: list[str] = []
    for skill_id in group.skill_ids or []:
        skill = None
        if db is not None:
            skill = db.get(models.Skill, skill_id)
        if skill and skill.enabled and skill.rule_content:
            rules.append(f"- [{skill.name}] {skill.rule_content}")
    if not rules:
        rules.append("- 无额外规则，遵循给定要求")
    return "\n".join(rules)


def render_prompt(group: models.SkillGroup, db: Session, **variables: str) -> str:
    """用组内 prompt_template 渲染 prompt；无模板时回退内置模板。"""
    template = group.prompt_template or BUILTIN_GROUP_TEMPLATES.get(group.analysis_type, "")
    variables.setdefault("rules", format_rules(group, db))
    try:
        return template.format(**variables)
    except (KeyError, IndexError):
        # 模板占位符与变量不匹配时：逐个替换已知占位，避免 KeyError
        for key, value in variables.items():
            template = template.replace("{" + key + "}", str(value))
        return template


def seed_module_groups(db: Session, tenant_id: str) -> int:
    """为该租户补齐所有分析模块的默认 SkillGroup（内置 prompt + 规则），幂等。"""
    now = _now()
    created = 0
    for analysis_type, template in BUILTIN_GROUP_TEMPLATES.items():
        existing = db.query(models.SkillGroup).filter_by(
            analysis_type=analysis_type, tenant_id=tenant_id,
        ).first()
        if existing:
            # 首次有旧数据但无模板时回填；不覆盖用户后续编辑
            if not existing.prompt_template:
                existing.prompt_template = template
                existing.updated_at = now
            continue
        # 创建内置 skills（uuid 保证跨进程/跨租户唯一，避免 UNIQUE 冲突）
        skill_ids: list[str] = []
        for rule in BUILTIN_GROUP_RULES.get(analysis_type, []):
            skill = models.Skill(
                id=f"sk-{analysis_type}-{uuid.uuid4().hex[:10]}",
                name=rule["name"],
                description="内置默认规则",
                category=rule["category"],
                severity=rule["severity"],
                check_type="llm",
                rule_content=rule["rule_content"],
                positive_examples=[],
                negative_examples=[],
                enabled=1,
                created_at=now,
                updated_at=now,
                tenant_id=tenant_id,
            )
            db.add(skill)
            skill_ids.append(skill.id)
        db.add(models.SkillGroup(
            id=f"skg-{analysis_type}-{uuid.uuid4().hex[:10]}",
            name=_group_display_name(analysis_type),
            description=_group_display_desc(analysis_type),
            skill_ids=skill_ids,
            analysis_type=analysis_type,
            prompt_template=template,
            enabled=1,
            created_at=now,
            updated_at=now,
            tenant_id=tenant_id,
        ))
        created += 1
    db.commit()
    return created


def _group_display_name(analysis_type: str) -> str:
    return {
        "swot": "SWOT 分析默认组",
        "hiring_advice": "招聘建议默认组",
        "growth_advice": "成长建议默认组",
        "career_path": "晋升路径默认组",
        "skills_matrix": "技能矩阵默认组",
        "iceberg": "冰山模型默认组",
    }.get(analysis_type, analysis_type)


def _group_display_desc(analysis_type: str) -> str:
    return {
        "swot": "团队 SWOT 四象限分析的内置规则与 prompt 模板",
        "hiring_advice": "团队招聘建议生成的内置规则",
        "growth_advice": "开发者个性化成长建议的内置规则",
        "career_path": "开发者晋升路径推荐的内置规则",
        "skills_matrix": "团队技能矩阵诊断的内置规则",
        "iceberg": "团队冰山模型（显性/隐性）诊断的内置规则",
    }.get(analysis_type, "")
