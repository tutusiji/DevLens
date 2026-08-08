"""创建独立测试租户（tenant-qa），并填充全部模块的测试数据。

与 seed.py（tenant-test）相互独立：本脚本面向「一键起一个可演示、可验收的全模块
测试组织」，数据规模适中但每个模块都有内容。

覆盖模块：
  组织树(TeamSpace) / 团队聚合(Team) / 开发者(Developer 完整画像) /
  项目(Project 全量详情) / 仓库(Repository) / 洞察/模块风险/修复(Insight/ModuleRisk/FixPriority) /
  身份匹配(IdentityMatch) / 能力缺口(CapabilityGap) / Skill(Source/Skill/Group) /
  能力标准(CapabilityRole/Standard) / Env 盘点(Scan/Entry) / 开发者实测评估(DeveloperEvaluation) /
  组合快照(ProjectAssessmentSnapshot) / 报告导出(ReportExport)

可重复运行：先清理 tenant-qa 的数据，再重建（幂等，不影响其它租户）。
演示登录账号（脚本会为本地管理员设置密码）：
    邮箱 local-admin@devlens.local · 密码 Admin123!
    （登录后右上角切换组织空间 → QA 测试组织 查看本租户全模块数据）
用法：
    cd backend && unset DATABASE_URL && .venv/bin/python -m app.seed_test_tenant
"""
from sqlalchemy import event
from sqlalchemy.orm import Session
import uuid

from .db import SessionLocal, Base, engine
from . import models
from .access import DEFAULT_USER_ID
from .env_scanner import fingerprint


SEED_TENANT = "tenant-qa"
TENANT_NAME = "QA 测试组织"
TENANT_SLUG = "qa-test"


def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _make_seed_session() -> Session:
    """种子专用 session：新插入对象若带 tenant_id 自动挂到 tenant-qa。"""
    db = SessionLocal()

    @event.listens_for(db, "before_flush")
    def _apply_tenant(session, flush_context, instances):
        for obj in session.new:
            if hasattr(obj, "tenant_id") and not obj.tenant_id:
                obj.tenant_id = SEED_TENANT

    return db


def _clear(db: Session) -> None:
    """仅清理 tenant-qa 的旧数据，绝不触碰其它租户。"""
    # 子表按 project 归属清理：先取测试租户的项目 id
    project_ids = [
        pid for (pid,) in db.query(models.Project.id)
        .filter_by(tenant_id=SEED_TENANT).all()
    ]
    if project_ids:
        for t in [models.FixPriority, models.ModuleRisk, models.Insight, models.AnalysisRun,
                  models.EnvInventoryEntry, models.EnvInventoryScan, models.SkillGroupRun]:
            db.query(t).filter(t.project_id.in_(project_ids)).delete(synchronize_session=False)
        db.query(models.ProjectAssessmentSnapshot).filter(
            models.ProjectAssessmentSnapshot.project_id.in_(project_ids)
        ).delete(synchronize_session=False)
    role_ids = [rid for (rid,) in db.query(models.CapabilityRole.id).filter_by(tenant_id=SEED_TENANT).all()]
    if role_ids:
        db.query(models.CapabilityStandard).filter(
            models.CapabilityStandard.role_id.in_(role_ids)
        ).delete(synchronize_session=False)
    # 顺序需遵守 FK：先删引用方再删被引用方。
    #   DeveloperEvaluation → developers / skill_groups / projects
    #   CapabilityRole.skill_group_id → skill_groups；Skill.source_id → skill_sources
    #   TeamGroup.team_id / Developer.team_id → team_spaces（故两者均须先于 TeamSpace）
    for t in [
        models.DeveloperEvaluation, models.ReportExport,
        models.EnvInventorySkill, models.CapabilityRole,
        models.SkillGroup, models.Skill, models.SkillSource,
        models.TeamGroup, models.Developer, models.TeamSpace,
        models.LargeTeam, models.Team, models.IdentityMatch,
        models.CapabilityGap, models.Repository, models.Project,
    ]:
        db.query(t).filter_by(tenant_id=SEED_TENANT).delete(synchronize_session=False)
    db.query(models.TenantMembership).filter_by(tenant_id=SEED_TENANT).delete(synchronize_session=False)
    db.query(models.Tenant).filter_by(id=SEED_TENANT).delete(synchronize_session=False)
    db.commit()


# ============ 开发者画像（详情页 JSON）============
_DEV_DETAILS = {
    "qd1": dict(
        capability={"code_quality": 88, "architecture": 91, "stability": 84, "efficiency": 81, "collaboration": 86, "security_aware": 79, "test_coverage": 77, "growth_velocity": 75},
        team_capability_avg={"code_quality": 85, "architecture": 87, "stability": 82, "efficiency": 80, "collaboration": 84, "security_aware": 76, "test_coverage": 74},
        growth_curve=[{"period": "2025 Q3", "composite": 76, "teamAvg": 78}, {"period": "2025 Q4", "composite": 79, "teamAvg": 80}, {"period": "2026 Q1", "composite": 82, "teamAvg": 81}, {"period": "2026 Q2", "composite": 85, "teamAvg": 83}, {"period": "2026 Q3", "composite": 88, "teamAvg": 84}],
        behavior_evidence=[{"label": "提交频率", "value": 8.6, "unit": "次/周", "benchmark": 5.5, "description": "高于组织均值 56%"}, {"label": "节奏规律性", "value": 0.76, "unit": "", "benchmark": 0.62, "description": "工作时间分布稳定"}, {"label": "Revert 比例", "value": 2.0, "unit": "%", "benchmark": 4.8, "description": "远低于均值，代码质量稳定"}, {"label": "Hotfix 比例", "value": 1.4, "unit": "%", "benchmark": 3.2, "description": "紧急修复少"}],
        partners=[{"name": "林涛", "username": "lintao", "sharedCommits": 38, "reviewCount": 26}, {"name": "刘洋", "username": "liuyang", "sharedCommits": 22, "reviewCount": 18}],
        modules=[{"module": "auth-core", "commits": 132, "ownership": 70, "complexity": 66, "projectId": "qp1", "projectName": "用户中心"}, {"module": "gateway-config", "commits": 58, "ownership": 44, "complexity": 30, "projectId": "qp1", "projectName": "用户中心"}],
        ai_suggestion="架构能力突出（91 分，团队前 10%），建议参与跨组架构评审会。主导 auth-core 模块（70% 归属），建议培养备份负责人降低 Bus Factor。",
    ),
    "qd2": dict(
        capability={"code_quality": 89, "architecture": 86, "stability": 88, "efficiency": 85, "collaboration": 89, "security_aware": 83, "test_coverage": 87, "growth_velocity": 81},
        team_capability_avg={"code_quality": 85, "architecture": 87, "stability": 82, "efficiency": 80, "collaboration": 84, "security_aware": 76, "test_coverage": 74},
        growth_curve=[{"period": "2025 Q3", "composite": 79, "teamAvg": 78}, {"period": "2025 Q4", "composite": 82, "teamAvg": 80}, {"period": "2026 Q1", "composite": 85, "teamAvg": 81}, {"period": "2026 Q2", "composite": 87, "teamAvg": 83}, {"period": "2026 Q3", "composite": 89, "teamAvg": 84}],
        behavior_evidence=[{"label": "提交频率", "value": 9.8, "unit": "次/周", "benchmark": 5.5, "description": "高于组织均值 78%"}, {"label": "节奏规律性", "value": 0.74, "unit": "", "benchmark": 0.62, "description": "分布较稳定"}, {"label": "Revert 比例", "value": 1.6, "unit": "%", "benchmark": 4.8, "description": "代码质量很高"}, {"label": "Hotfix 比例", "value": 1.1, "unit": "%", "benchmark": 3.2, "description": "紧急修复极少"}],
        partners=[{"name": "陈思", "username": "chensi", "sharedCommits": 38, "reviewCount": 26}, {"name": "周杰", "username": "zhoujie", "sharedCommits": 24, "reviewCount": 15}],
        modules=[{"module": "order-core", "commits": 178, "ownership": 66, "complexity": 70, "projectId": "qp2", "projectName": "订单系统"}, {"module": "inventory", "commits": 92, "ownership": 58, "complexity": 48, "projectId": "qp2", "projectName": "订单系统"}],
        ai_suggestion="全面均衡型开发者，7 维均在 84+，协作能力（89）尤为突出。Review 参与度高，是团队的知识传递者，建议承担新人 mentor 角色。",
    ),
    "qd3": dict(
        capability={"code_quality": 87, "architecture": 80, "stability": 0, "efficiency": 0, "collaboration": 90, "security_aware": 75, "test_coverage": 78, "growth_velocity": 82, "ui_quality": 92, "responsive": 89},
        team_capability_avg={"code_quality": 84, "architecture": 78, "stability": 0, "efficiency": 0, "collaboration": 83, "security_aware": 70, "test_coverage": 60},
        growth_curve=[{"period": "2025 Q3", "composite": 77, "teamAvg": 76}, {"period": "2025 Q4", "composite": 80, "teamAvg": 78}, {"period": "2026 Q1", "composite": 83, "teamAvg": 80}, {"period": "2026 Q2", "composite": 85, "teamAvg": 81}, {"period": "2026 Q3", "composite": 87, "teamAvg": 82}],
        behavior_evidence=[{"label": "提交频率", "value": 7.6, "unit": "次/周", "benchmark": 5.5, "description": "长期稳定投入核心前端模块"}, {"label": "节奏规律性", "value": 0.80, "unit": "", "benchmark": 0.62, "description": "交付节奏稳定，返工较少"}, {"label": "Revert 比例", "value": 1.8, "unit": "%", "benchmark": 4.8, "description": "前端变更稳定性高"}, {"label": "Hotfix 比例", "value": 1.0, "unit": "%", "benchmark": 3.2, "description": "线上紧急修复低于均值"}],
        partners=[{"name": "周杰", "username": "zhoujie", "sharedCommits": 64, "reviewCount": 38}, {"name": "陈思", "username": "chensi", "sharedCommits": 30, "reviewCount": 19}],
        modules=[{"module": "design-system", "commits": 126, "ownership": 76, "complexity": 50, "projectId": "qp3", "projectName": "内容引擎"}, {"module": "content-renderer", "commits": 98, "ownership": 66, "complexity": 62, "projectId": "qp3", "projectName": "内容引擎"}],
        ai_suggestion="已达到前端工程师 E3 资深工程师标准。UI 质量（92）和响应式（89）是明显优势，适合主导设计系统和复杂交互。",
    ),
    "qd4": dict(
        capability={"code_quality": 84, "architecture": 85, "stability": 80, "efficiency": 82, "collaboration": 85, "security_aware": 78, "test_coverage": 75, "growth_velocity": 80},
        team_capability_avg={"code_quality": 85, "architecture": 87, "stability": 82, "efficiency": 80, "collaboration": 84, "security_aware": 76, "test_coverage": 74},
        growth_curve=[{"period": "2025 Q3", "composite": 74, "teamAvg": 78}, {"period": "2025 Q4", "composite": 77, "teamAvg": 80}, {"period": "2026 Q1", "composite": 80, "teamAvg": 81}, {"period": "2026 Q2", "composite": 82, "teamAvg": 83}, {"period": "2026 Q3", "composite": 84, "teamAvg": 84}],
        behavior_evidence=[{"label": "提交频率", "value": 6.4, "unit": "次/周", "benchmark": 5.5, "description": "稳定输出"}, {"label": "节奏规律性", "value": 0.70, "unit": "", "benchmark": 0.62, "description": "分布正常"}, {"label": "Revert 比例", "value": 2.8, "unit": "%", "benchmark": 4.8, "description": "低于均值"}, {"label": "Hotfix 比例", "value": 1.9, "unit": "%", "benchmark": 3.2, "description": "正常水平"}],
        partners=[{"name": "林涛", "username": "lintao", "sharedCommits": 28, "reviewCount": 17}],
        modules=[{"module": "content-api", "commits": 88, "ownership": 55, "complexity": 46, "projectId": "qp3", "projectName": "内容引擎"}],
        ai_suggestion="成长速度（80）稳定，协作良好。建议补强测试覆盖与安全意识，向资深工程师方向进阶。",
    ),
    "qd5": dict(
        capability={"code_quality": 78, "architecture": 82, "stability": 84, "efficiency": 72, "collaboration": 76, "security_aware": 81, "test_coverage": 68, "growth_velocity": 70},
        team_capability_avg={"code_quality": 80, "architecture": 81, "stability": 83, "efficiency": 76, "collaboration": 80, "security_aware": 80, "test_coverage": 66},
        growth_curve=[{"period": "2025 Q3", "composite": 70, "teamAvg": 72}, {"period": "2025 Q4", "composite": 72, "teamAvg": 74}, {"period": "2026 Q1", "composite": 75, "teamAvg": 76}, {"period": "2026 Q2", "composite": 77, "teamAvg": 78}, {"period": "2026 Q3", "composite": 78, "teamAvg": 79}],
        behavior_evidence=[{"label": "提交频率", "value": 5.8, "unit": "次/周", "benchmark": 5.5, "description": "接近均值"}, {"label": "节奏规律性", "value": 0.66, "unit": "", "benchmark": 0.62, "description": "稳定"}, {"label": "Revert 比例", "value": 2.2, "unit": "%", "benchmark": 4.8, "description": "低于均值"}, {"label": "Hotfix 比例", "value": 1.6, "unit": "%", "benchmark": 3.2, "description": "正常"}],
        partners=[{"name": "陈思", "username": "chensi", "sharedCommits": 22, "reviewCount": 18}],
        modules=[{"module": "deploy-platform", "commits": 96, "ownership": 62, "complexity": 44, "projectId": "qp4", "projectName": "交付平台"}],
        ai_suggestion="稳定性与安全意识（81）突出，适合基础设施与运维治理方向。建议补强测试覆盖，参与自动化工具链建设。",
    ),
    "qd6": dict(
        capability={"code_quality": 86, "architecture": 88, "stability": 82, "efficiency": 84, "collaboration": 80, "security_aware": 74, "test_coverage": 76, "growth_velocity": 84},
        team_capability_avg={"code_quality": 84, "architecture": 83, "stability": 80, "efficiency": 82, "collaboration": 81, "security_aware": 72, "test_coverage": 71},
        growth_curve=[{"period": "2025 Q3", "composite": 75, "teamAvg": 74}, {"period": "2025 Q4", "composite": 78, "teamAvg": 76}, {"period": "2026 Q1", "composite": 81, "teamAvg": 78}, {"period": "2026 Q2", "composite": 83, "teamAvg": 80}, {"period": "2026 Q3", "composite": 86, "teamAvg": 81}],
        behavior_evidence=[{"label": "提交频率", "value": 7.1, "unit": "次/周", "benchmark": 5.5, "description": "高于均值 29%"}, {"label": "节奏规律性", "value": 0.72, "unit": "", "benchmark": 0.62, "description": "正常"}, {"label": "Revert 比例", "value": 2.4, "unit": "%", "benchmark": 4.8, "description": "低于均值"}, {"label": "Hotfix 比例", "value": 1.3, "unit": "%", "benchmark": 3.2, "description": "较低"}],
        partners=[{"name": "吴婷", "username": "wuting", "sharedCommits": 26, "reviewCount": 14}],
        modules=[{"module": "search-index", "commits": 74, "ownership": 58, "complexity": 50, "projectId": "qp5", "projectName": "搜索中台"}],
        ai_suggestion="算法方向成长速度快（84），架构意识良好。建议补强安全意识（74），并增加线上稳定性演练参与。",
    ),
}


def _seed_org_and_teams(db: Session) -> None:
    db.add_all([
        models.TeamSpace(id="qa-root", name="测试研发中心", description="QA 测试组织的研发总部，负责演示全模块数据", parent_id=None, status="active", created_at="", updated_at="", member_ids=[], project_ids=[]),
        models.TeamSpace(id="qa-test-team", name="测试团队", parent_id="qa-root", description="本组织的主演示团队：测试团队", owner_id="qd1", owner_name="陈思", status="active", created_at="2026-01-10", updated_at="今天 10:32", member_ids=["qd1", "qd2", "qd3", "qd4", "qd5", "qd6"], project_ids=["qp1", "qp2", "qp3", "qp4", "qp5", "qp6"]),
        models.TeamSpace(id="qa-backend", name="后端小组", parent_id="qa-test-team", description="负责账户、订单、风控等后端核心链路", owner_id="qd1", owner_name="陈思", status="active", created_at="2026-01-12", updated_at="今天 09:12", member_ids=["qd1", "qd2"], project_ids=["qp1", "qp2"]),
        models.TeamSpace(id="qa-frontend", name="前端小组", parent_id="qa-test-team", description="负责内容体验、设计系统与用户端工程", owner_id="qd3", owner_name="王琳", status="active", created_at="2026-01-14", updated_at="昨天", member_ids=["qd3", "qd4"], project_ids=["qp3"]),
        models.TeamSpace(id="qa-infra", name="基础设施小组", parent_id="qa-test-team", description="负责交付平台、稳定性和基础设施", owner_id="qd5", owner_name="刘洋", status="active", created_at="2026-02-02", updated_at="3 小时前", member_ids=["qd5"], project_ids=["qp4", "qp5"]),
    ])
    db.commit()

    db.add_all([
        models.Team(id="qa-t1", name="测试团队", members=6, avg_score=86, bus_factor=3, risk_count=1, capability={"code_quality": 87, "architecture": 88, "stability": 84, "efficiency": 82, "collaboration": 85, "security_aware": 78, "test_coverage": 76}),
        models.Team(id="qa-t2", name="后端小组", members=2, avg_score=88, bus_factor=2, risk_count=0, capability={"code_quality": 88, "architecture": 90, "stability": 85, "efficiency": 83, "collaboration": 87, "security_aware": 81, "test_coverage": 82}),
        models.Team(id="qa-t3", name="前端小组", members=2, avg_score=85, bus_factor=1, risk_count=1, capability={"code_quality": 86, "architecture": 82, "stability": 80, "efficiency": 84, "collaboration": 86, "security_aware": 76, "test_coverage": 76}),
        models.Team(id="qa-t4", name="基础设施小组", members=2, avg_score=80, bus_factor=2, risk_count=1, capability={"code_quality": 80, "architecture": 84, "stability": 83, "efficiency": 76, "collaboration": 78, "security_aware": 82, "test_coverage": 70}),
    ])
    db.commit()


def _seed_developers(db: Session) -> None:
    devs = [
        dict(id="qd1", name="陈思", username="chensi", role="架构师", role_type="backend", team="后端小组", team_id="qa-backend", level="E3", overall=88, commits=402, reviews=151, langs=["Go", "Python"], tags=["核心模块贡献者", "偏后端架构"]),
        dict(id="qd2", name="林涛", username="lintao", role="技术专家", role_type="backend", team="后端小组", team_id="qa-backend", level="D2", overall=90, commits=508, reviews=190, langs=["Java", "Kotlin"], tags=["核心模块贡献者", "架构能力突出"]),
        dict(id="qd3", name="王琳", username="wanglin", role="高级工程师", role_type="frontend", team="前端小组", team_id="qa-frontend", level="E3", overall=87, commits=376, reviews=128, langs=["TypeScript", "React"], tags=["核心模块贡献者", "前端专家"]),
        dict(id="qd4", name="周杰", username="zhoujie", role="工程师", role_type="frontend", team="前端小组", team_id="qa-frontend", level="F3", overall=76, commits=258, reviews=72, langs=["TypeScript", "Vue"], tags=["协作能力突出"]),
        dict(id="qd5", name="刘洋", username="liuyang", role="高级工程师", role_type="devops", team="基础设施小组", team_id="qa-infra", level="E1", overall=79, commits=302, reviews=88, langs=["Go"], tags=["稳定性强", "运维能力"]),
        dict(id="qd6", name="赵磊", username="zhaolei", role="技术专家", role_type="algorithm", team="基础设施小组", team_id="qa-infra", level="D3", overall=90, commits=588, reviews=232, langs=["Python", "Rust"], tags=["全栈能力", "成长速度快"]),
    ]
    for d in devs:
        detail = _DEV_DETAILS.get(d["id"], {})
        db.add(models.Developer(**d, **detail))
    db.commit()


def _seed_projects(db: Session) -> None:
    projects = [
        dict(id="qp1", name="用户中心", group="后端小组", team_id="qa-backend", language="Go", score=88, quality=90, security=85, debt=22, status="completed", commits=1847, contributors=3, last_analyzed="2小时前"),
        dict(id="qp2", name="订单系统", group="后端小组", team_id="qa-backend", language="Java", score=90, quality=92, security=88, debt=18, status="completed", commits=3214, contributors=2, last_analyzed="1小时前"),
        dict(id="qp3", name="内容引擎", group="前端小组", team_id="qa-frontend", language="TypeScript", score=92, quality=94, security=90, debt=15, status="completed", commits=2891, contributors=3, last_analyzed="4小时前"),
        dict(id="qp4", name="交付平台", group="基础设施小组", team_id="qa-infra", language="Go", score=79, quality=81, security=82, debt=25, status="completed", commits=2034, contributors=2, last_analyzed="8小时前"),
        dict(id="qp5", name="搜索中台", group="基础设施小组", team_id="qa-infra", language="Python", score=81, quality=83, security=79, debt=28, status="completed", commits=1567, contributors=2, last_analyzed="6小时前"),
        dict(id="qp6", name="消息推送", group="测试团队", team_id="qa-test-team", language="Go", score=74, quality=76, security=72, debt=32, status="pending", commits=892, contributors=1, last_analyzed="待分析"),
    ]
    for p in projects:
        db.add(models.Project(**p))
    db.commit()


def _seed_project_details(db: Session) -> None:
    details = {
        "qp1": dict(
            project=dict(dimensions=[
                {"label": "代码质量", "score": 90, "benchmark": 78, "trend": "up", "description": "AI Review 通过率 92%"},
                {"label": "安全性", "score": 85, "benchmark": 75, "trend": "stable", "description": "无高危漏洞，密钥检测通过"},
                {"label": "测试覆盖", "score": 82, "benchmark": 68, "trend": "up", "description": "行覆盖 82%，分支覆盖 71%"},
                {"label": "技术债", "score": 78, "benchmark": 72, "trend": "down", "description": "复杂度集中在 auth 模块，待重构"},
                {"label": "交付稳定性", "score": 88, "benchmark": 80, "trend": "up", "description": "近 30 天无回滚，MTTR 12 分钟"},
            ], contributor_list=[
                {"name": "陈思", "username": "chensi", "commits": 156, "reviews": 62, "ownership": 72},
                {"name": "刘洋", "username": "liuyang", "commits": 89, "reviews": 31, "ownership": 38},
            ], debt_trend=[{"month": "3月", "debt": 26, "complexity": 62}, {"month": "4月", "debt": 25, "complexity": 61}, {"month": "5月", "debt": 24, "complexity": 59}, {"month": "6月", "debt": 23, "complexity": 58}, {"month": "7月", "debt": 22, "complexity": 57}],
              review_summary={"total": 4, "critical": 0, "open": 2, "newSinceLastScan": 1, "inProgress": 1, "resolved": 1},
              analysis_meta={"branch": "main", "commit": "7f3a2ce", "analysisVersion": "2026.07", "scannedAt": "今天 10:32", "coverage": 96, "filesScanned": 842, "confidence": 0.91},
              assets={"frameworks": [{"name": "Gin", "version": "1.9.1", "type": "web"}], "dependencies": [{"name": "jwt-go", "version": "4.5.0", "type": "auth"}], "configs": [{"name": "config.yaml", "type": "runtime"}], "deployments": [{"name": "user-center-prod", "type": "k8s"}]},
              graph_edges=[{"source": "services/auth/token.ts", "target": "modules/user/UserService.ts"}, {"source": "services/session/redis-client.ts", "target": "services/auth/token.ts"}]),
            insights=[
                dict(id="qins-1", title="JWT 校验未限制签名算法", module="auth-core", type="security", category="security", severity="high", level="warning", risk_score=91, confidence=0.94, status="open", file_path="services/auth/token.ts", symbol="verifyToken", start_line=42, end_line=58, source="SAST + AI Review", first_seen_at="2026-07-18", last_seen_at="2026-07-26", assignee="陈思", evidence="3 处 JWT 校验未检查签名算法", code_excerpt="jwt.verify(token, publicKey, options)", impact="潜在算法混淆攻击，可能绕过身份校验。", action="强制 RS256 算法白名单，并增加拒绝非白名单算法的测试。", verification="安全规则重扫通过，新增算法拒绝单测。"),
                dict(id="qins-2", title="Redis 连接未复用", module="session-mgr", type="performance", category="reliability", severity="high", level="warning", risk_score=82, confidence=0.91, status="in_progress", file_path="services/session/redis-client.ts", symbol="getSession", start_line=18, end_line=35, source="Performance Rule + AI Review", first_seen_at="2026-07-03", last_seen_at="2026-07-26", assignee="周杰", evidence="每次请求新建 Redis 客户端，缺少连接池", code_excerpt="const client = createClient({ url: redisUrl })", impact="P99 延迟偏高（180ms）", action="引入连接池、超时和故障转移策略。", verification="压测 P99 低于 80ms。"),
                dict(id="qins-3", title="生产环境允许 Debug 日志", module="gateway-config", type="configuration", category="configuration", severity="medium", level="warning", risk_score=72, confidence=0.79, status="open", file_path="deploy/values-prod.yaml", symbol="", start_line=24, end_line=24, source="Config Scanner", first_seen_at="2026-07-26", last_seen_at="2026-07-26", assignee="刘洋", evidence="production values 中 LOG_LEVEL 设置为 debug", code_excerpt="LOG_LEVEL: debug", impact="可能记录敏感请求上下文", action="生产环境改为 info。", verification="部署清单重扫无生产 debug 配置。"),
            ],
            module_risks=[
                dict(id="qmod-1", name="auth-core", path="services/auth", score=84, severity="high", critical_count=0, issue_count=2, complexity=68, debt_load=18, owner="陈思", backup_owner="刘洋", ownership=72, last_changed="2 小时前", categories=[{"category": "security", "count": 1}, {"category": "logic", "count": 1}]),
                dict(id="qmod-2", name="session-mgr", path="services/session", score=78, severity="high", critical_count=0, issue_count=2, complexity=57, debt_load=12, owner="周杰", ownership=48, last_changed="昨天", categories=[{"category": "performance", "count": 1}, {"category": "reliability", "count": 1}]),
                dict(id="qmod-3", name="user-core", path="modules/user", score=65, severity="medium", critical_count=0, issue_count=3, complexity=83, debt_load=10, owner="刘洋", backup_owner="陈思", ownership=65, last_changed="3 天前", categories=[{"category": "complexity", "count": 2}, {"category": "maintainability", "count": 1}]),
            ],
            fixes=[
                dict(id="qfix-1", insight_id="qins-1", module="auth-core", title="限制 JWT 签名算法", severity="high", priority="P0", debt=18, effort="3 人日", impact="消除身份校验绕过风险", expected_gain=7, status="open", assignee="陈思", due_date="8 月 4 日"),
                dict(id="qfix-2", insight_id="qins-2", module="session-mgr", title="引入 Redis 连接池", severity="high", priority="P1", debt=12, effort="2 人日", impact="P99 延迟预计降至 80ms", expected_gain=4, status="in_progress", assignee="周杰", due_date="8 月 9 日"),
            ],
        ),
        "qp2": dict(
            project=dict(dimensions=[
                {"label": "代码质量", "score": 92, "benchmark": 78, "trend": "up", "description": "AI Review 通过率 95%"},
                {"label": "安全性", "score": 88, "benchmark": 75, "trend": "up", "description": "CodeQL 零高危"},
                {"label": "测试覆盖", "score": 89, "benchmark": 68, "trend": "up", "description": "行覆盖 89%"},
                {"label": "技术债", "score": 85, "benchmark": 72, "trend": "up", "description": "持续下降"},
                {"label": "交付稳定性", "score": 94, "benchmark": 80, "trend": "up", "description": "零回滚"},
            ], contributor_list=[
                {"name": "林涛", "username": "lintao", "commits": 198, "reviews": 78, "ownership": 68},
                {"name": "陈思", "username": "chensi", "commits": 62, "reviews": 21, "ownership": 32},
            ], debt_trend=[{"month": "3月", "debt": 22, "complexity": 60}, {"month": "4月", "debt": 20, "complexity": 58}, {"month": "5月", "debt": 19, "complexity": 56}, {"month": "6月", "debt": 18, "complexity": 54}, {"month": "7月", "debt": 18, "complexity": 53}],
              review_summary={"total": 2, "critical": 0, "open": 1, "newSinceLastScan": 1, "inProgress": 0, "resolved": 1},
              analysis_meta={"branch": "main", "commit": "5d92ab1", "analysisVersion": "2026.07", "scannedAt": "今天 09:12", "coverage": 98, "filesScanned": 1264, "confidence": 0.95},
              assets={"frameworks": [{"name": "Spring Boot", "version": "3.2.5", "type": "web"}], "dependencies": [{"name": "mybatis-plus", "version": "3.5.5", "type": "orm"}], "configs": [{"name": "application.yml", "type": "runtime"}], "deployments": [{"name": "order-prod", "type": "k8s"}]},
              graph_edges=[{"source": "order/OrderStateMachine.kt", "target": "payment/MoneyCalculator.java"}]),
            insights=[
                dict(id="qins-4", title="金额计算使用浮点数", module="payment-gw", type="security", category="logic", severity="high", level="warning", risk_score=79, confidence=0.9, status="open", file_path="payment/MoneyCalculator.java", symbol="calculateFee", start_line=33, end_line=47, source="Logic Rule + AI Review", first_seen_at="2026-07-20", last_seen_at="2026-07-26", assignee="林涛", evidence="金额计算未使用 Decimal/BigDecimal", code_excerpt="double fee = amount * rate;", impact="浮点精度误差可能导致订单金额不一致", action="统一使用 BigDecimal", verification="金额精度规则通过"),
                dict(id="qins-5", title="订单状态机是可复用最佳实践", module="order-core", type="quality", category="quality", severity="info", level="info", risk_score=12, confidence=0.96, status="resolved", file_path="order/OrderStateMachine.kt", symbol="OrderStateMachine", start_line=1, end_line=208, source="AI Review", first_seen_at="2026-07-26", last_seen_at="2026-07-26", assignee="林涛", evidence="状态转换完整，测试覆盖充分", impact="维护成本低", action="沉淀为团队订单领域建模范式", verification="架构评审通过"),
            ],
            module_risks=[
                dict(id="qmod-4", name="payment-gw", path="payment", score=73, severity="high", critical_count=0, issue_count=1, complexity=45, debt_load=14, owner="林涛", backup_owner="陈思", ownership=55, last_changed="5 小时前", categories=[{"category": "logic", "count": 1}]),
                dict(id="qmod-5", name="order-core", path="order", score=24, severity="low", critical_count=0, issue_count=0, complexity=38, debt_load=3, owner="林涛", backup_owner="陈思", ownership=68, last_changed="昨天", categories=[{"category": "quality", "count": 0}]),
            ],
            fixes=[
                dict(id="qfix-3", insight_id="qins-4", module="payment-gw", title="替换为 BigDecimal 金额模型", severity="high", priority="P1", debt=14, effort="2 人日", impact="消除金额精度风险", expected_gain=4, status="open", assignee="林涛", due_date="8 月 6 日"),
            ],
        ),
        "qp3": dict(
            project=dict(dimensions=[
                {"label": "代码质量", "score": 94, "benchmark": 78, "trend": "up", "description": "lint 合规率 97%"},
                {"label": "安全性", "score": 90, "benchmark": 75, "trend": "up", "description": "无高危，依赖扫描通过"},
                {"label": "测试覆盖", "score": 84, "benchmark": 68, "trend": "up", "description": "组件级测试覆盖 84%"},
                {"label": "技术债", "score": 88, "benchmark": 72, "trend": "up", "description": "设计系统沉淀降低重复"},
                {"label": "交付稳定性", "score": 91, "benchmark": 80, "trend": "up", "description": "近 30 天 2 次发布零事故"},
            ], contributor_list=[
                {"name": "王琳", "username": "wanglin", "commits": 242, "reviews": 91, "ownership": 78},
                {"name": "周杰", "username": "zhoujie", "commits": 161, "reviews": 52, "ownership": 57},
                {"name": "陈思", "username": "chensi", "commits": 44, "reviews": 18, "ownership": 22},
            ], debt_trend=[{"month": "3月", "debt": 20, "complexity": 55}, {"month": "4月", "debt": 18, "complexity": 53}, {"month": "5月", "debt": 17, "complexity": 52}, {"month": "6月", "debt": 16, "complexity": 50}, {"month": "7月", "debt": 15, "complexity": 49}],
              review_summary={"total": 3, "critical": 0, "open": 1, "newSinceLastScan": 1, "inProgress": 0, "resolved": 2},
              analysis_meta={"branch": "main", "commit": "a91ce77", "analysisVersion": "2026.07", "scannedAt": "今天 08:41", "coverage": 99, "filesScanned": 1188, "confidence": 0.96},
              assets={"frameworks": [{"name": "Next.js", "version": "15", "type": "web"}], "dependencies": [{"name": "react-19", "version": "19.0", "type": "ui"}], "configs": [{"name": "next.config.mjs", "type": "build"}], "deployments": [{"name": "content-prod", "type": "k8s"}]},
              graph_edges=[{"source": "components/charts.tsx", "target": "lib/mock-data.ts"}, {"source": "components/architecture-design-view.tsx", "target": "components/charts.tsx"}]),
            insights=[
                dict(id="qins-6", title="内联样式硬编码颜色", module="design-system", type="maintainability", category="maintainability", severity="low", level="info", risk_score=34, confidence=0.86, status="open", file_path="components/hero/banner.tsx", symbol="Banner", start_line=12, end_line=40, source="Frontend Rule + AI Review", first_seen_at="2026-07-25", last_seen_at="2026-07-26", assignee="周杰", evidence="2 处使用 #1890ff 硬编码颜色", code_excerpt="style={{ color: '#1890ff' }}", impact="视觉不一致，后续换肤成本高", action="替换为设计 token", verification="token 重扫通过"),
            ],
            module_risks=[
                dict(id="qmod-6", name="design-system", path="components", score=58, severity="medium", critical_count=0, issue_count=1, complexity=52, debt_load=8, owner="王琳", backup_owner="周杰", ownership=76, last_changed="今天", categories=[{"category": "maintainability", "count": 1}]),
                dict(id="qmod-7", name="content-renderer", path="renderer", score=44, severity="medium", critical_count=0, issue_count=0, complexity=62, debt_load=5, owner="王琳", backup_owner="周杰", ownership=66, last_changed="昨天", categories=[{"category": "complexity", "count": 0}]),
            ],
            fixes=[
                dict(id="qfix-4", insight_id="qins-6", module="design-system", title="内联样式替换为设计 token", severity="low", priority="P3", debt=8, effort="1 人日", impact="提升视觉一致性与换肤能力", expected_gain=2, status="open", assignee="周杰", due_date="8 月 20 日"),
            ],
        ),
        "qp4": dict(
            project=dict(dimensions=[
                {"label": "代码质量", "score": 81, "benchmark": 78, "trend": "stable", "description": "AI Review 通过率 87%"},
                {"label": "安全性", "score": 82, "benchmark": 75, "trend": "up", "description": "镜像扫描通过"},
                {"label": "测试覆盖", "score": 68, "benchmark": 68, "trend": "stable", "description": "行覆盖 68%，待提升"},
                {"label": "技术债", "score": 75, "benchmark": 72, "trend": "down", "description": "基础设施模块有一定债务"},
                {"label": "交付稳定性", "score": 86, "benchmark": 80, "trend": "up", "description": "发布自动化覆盖 90%"},
            ], contributor_list=[
                {"name": "刘洋", "username": "liuyang", "commits": 194, "reviews": 62, "ownership": 71},
                {"name": "陈思", "username": "chensi", "commits": 78, "reviews": 26, "ownership": 38},
            ], debt_trend=[{"month": "3月", "debt": 30, "complexity": 48}, {"month": "4月", "debt": 29, "complexity": 47}, {"month": "5月", "debt": 27, "complexity": 46}, {"month": "6月", "debt": 26, "complexity": 45}, {"month": "7月", "debt": 25, "complexity": 44}],
              review_summary={"total": 2, "critical": 0, "open": 1, "newSinceLastScan": 0, "inProgress": 1, "resolved": 0},
              analysis_meta={"branch": "main", "commit": "c22f80a", "analysisVersion": "2026.07", "scannedAt": "今天 07:22", "coverage": 88, "filesScanned": 566, "confidence": 0.86},
              assets={"frameworks": [{"name": "Gin", "version": "1.9.1", "type": "web"}], "dependencies": [{"name": "argocd", "version": "2.11", "type": "cd"}], "configs": [{"name": "deploy/values-prod.yaml", "type": "deploy"}], "deployments": [{"name": "delivery-prod", "type": "k8s"}]},
              graph_edges=[]),
            insights=[
                dict(id="qins-7", title="发布流水线缺少门禁", module="deploy-platform", type="reliability", category="reliability", severity="medium", level="warning", risk_score=66, confidence=0.82, status="acknowledged", file_path="deploy/pipeline.yaml", symbol="", start_line=41, end_line=41, source="Delivery Rule + AI Review", first_seen_at="2026-07-15", last_seen_at="2026-07-26", assignee="刘洋", evidence="流水线未配置测试覆盖门禁", code_excerpt="steps: [build, push]", impact="低质量代码可能直接上线", action="增加覆盖率门禁与人工审批", verification="流水线门禁已配置"),
            ],
            module_risks=[
                dict(id="qmod-8", name="deploy-platform", path="deploy", score=62, severity="medium", critical_count=0, issue_count=1, complexity=44, debt_load=10, owner="刘洋", ownership=62, last_changed="2 天前", categories=[{"category": "reliability", "count": 1}]),
            ],
            fixes=[
                dict(id="qfix-5", insight_id="qins-7", module="deploy-platform", title="流水线增加覆盖率门禁", severity="medium", priority="P2", debt=10, effort="2 人日", impact="防止低质量代码上线", expected_gain=3, status="acknowledged", assignee="刘洋", due_date="8 月 14 日"),
            ],
        ),
        "qp5": dict(
            project=dict(dimensions=[
                {"label": "代码质量", "score": 83, "benchmark": 78, "trend": "up", "description": "算法模块评审通过"},
                {"label": "安全性", "score": 79, "benchmark": 75, "trend": "stable", "description": "无高危"},
                {"label": "测试覆盖", "score": 76, "benchmark": 68, "trend": "up", "description": "行覆盖 76%"},
                {"label": "技术债", "score": 72, "benchmark": 72, "trend": "down", "description": "索引复杂度集中"},
                {"label": "交付稳定性", "score": 84, "benchmark": 80, "trend": "up", "description": "稳定运行"},
            ], contributor_list=[
                {"name": "赵磊", "username": "zhaolei", "commits": 188, "reviews": 77, "ownership": 63},
                {"name": "刘洋", "username": "liuyang", "commits": 74, "reviews": 22, "ownership": 34},
            ], debt_trend=[{"month": "3月", "debt": 34, "complexity": 58}, {"month": "4月", "debt": 32, "complexity": 56}, {"month": "5月", "debt": 30, "complexity": 54}, {"month": "6月", "debt": 29, "complexity": 52}, {"month": "7月", "debt": 28, "complexity": 51}],
              review_summary={"total": 1, "critical": 0, "open": 0, "newSinceLastScan": 0, "inProgress": 0, "resolved": 1},
              analysis_meta={"branch": "main", "commit": "e0f3412", "analysisVersion": "2026.07", "scannedAt": "今天 06:30", "coverage": 91, "filesScanned": 712, "confidence": 0.89},
              assets={"frameworks": [{"name": "FastAPI", "version": "0.111", "type": "web"}], "dependencies": [{"name": "qdrant-client", "version": "1.9", "type": "vector"}], "configs": [{"name": "config.py", "type": "runtime"}], "deployments": []},
              graph_edges=[]),
            insights=[],
            module_risks=[
                dict(id="qmod-9", name="search-index", path="indexer", score=71, severity="high", critical_count=0, issue_count=1, complexity=66, debt_load=12, owner="赵磊", backup_owner="刘洋", ownership=63, last_changed="今天", categories=[{"category": "complexity", "count": 1}]),
            ],
            fixes=[],
        ),
        "qp6": dict(
            project=dict(dimensions=[],
              contributor_list=[
                {"name": "陈思", "username": "chensi", "commits": 78, "reviews": 26, "ownership": 38},
            ], debt_trend=[{"month": "3月", "debt": 35, "complexity": 45}, {"month": "4月", "debt": 34, "complexity": 44}, {"month": "5月", "debt": 33, "complexity": 44}, {"month": "6月", "debt": 32, "complexity": 43}, {"month": "7月", "debt": 32, "complexity": 42}],
              review_summary={"total": 0, "critical": 0, "open": 0, "newSinceLastScan": 0, "inProgress": 0, "resolved": 0},
              analysis_meta=None),
            insights=[],
            module_risks=[],
            fixes=[],
        ),
    }
    for pid, spec in details.items():
        project = db.query(models.Project).get(pid)
        if not project:
            continue
        for key, value in spec["project"].items():
            setattr(project, key, value)
        for insight in spec["insights"]:
            db.add(models.Insight(project_id=pid, **insight))
        for risk in spec["module_risks"]:
            db.add(models.ModuleRisk(project_id=pid, **risk))
        for fix in spec["fixes"]:
            db.add(models.FixPriority(project_id=pid, **fix))
    db.commit()


def _seed_repos_identity_gaps(db: Session) -> None:
    db.add_all([
        models.Repository(id="qr1", name="用户中心", path="/data/repos/user-center", source_type="remote", provider="gitlab", remote_url="https://gitlab.example.com/qa/user-center.git", branch="main", team_id="qa-backend", project_id="qp1", status="synced", last_sync="2分钟前", commits=1847, contributors=3),
        models.Repository(id="qr2", name="订单系统", path="/data/repos/order-sys", source_type="remote", provider="github", remote_url="https://github.com/acme/order-system.git", branch="main", team_id="qa-backend", project_id="qp2", status="synced", last_sync="1小时前", commits=3214, contributors=2),
        models.Repository(id="qr3", name="内容引擎", path="/data/repos/content-engine", source_type="remote", provider="github", remote_url="https://github.com/acme/content-engine.git", branch="main", team_id="qa-frontend", project_id="qp3", status="synced", last_sync="4小时前", commits=2891, contributors=3),
        models.Repository(id="qr4", name="交付平台", path="/data/repos/delivery-platform", source_type="local", branch="main", team_id="qa-infra", project_id="qp4", status="synced", last_sync="8小时前", commits=2034, contributors=2),
        models.Repository(id="qr5", name="搜索中台", path="/data/repos/search", source_type="local", branch="main", team_id="qa-infra", project_id="qp5", status="failed", last_sync="2天前", commits=1567, contributors=2),
        models.Repository(id="qr6", name="消息推送", path="/data/repos/push", source_type="remote", provider="github", remote_url="https://github.com/acme/push.git", branch="main", team_id="qa-test-team", project_id="qp6", status="syncing", last_sync="同步中", commits=892, contributors=1),
    ])
    db.add_all([
        models.IdentityMatch(id="qim1", git_name="chensi42", git_email="chensi@qa.com", person_name="陈思", department="后端小组", confidence=1.0, method="email"),
        models.IdentityMatch(id="qim2", git_name="Lin Tao", git_email="lintao@github.com", person_name="林涛", department="后端小组", confidence=0.9, method="employee_id"),
        models.IdentityMatch(id="qim3", git_name="wanglin_dev", git_email="wl123@qq.com", person_name="王琳", department="前端小组", confidence=0.75, method="pinyin"),
        models.IdentityMatch(id="qim4", git_name="zhaolei88", git_email="zl88@163.com", person_name="赵磊", department="基础设施小组", confidence=0.85, method="fuzzy"),
    ])
    db.add_all([
        models.CapabilityGap(id="qcg1", capability="安全意识", current=74, target=85, owner="测试团队", action="安全培训 + 代码审查配对"),
        models.CapabilityGap(id="qcg2", capability="测试覆盖", current=76, target=85, owner="前端小组", action="引入覆盖率门禁 + 测试用例补齐"),
        models.CapabilityGap(id="qcg3", capability="架构能力", current=80, target=88, owner="基础设施小组", action="架构评审会 + 跨组技术分享"),
        models.CapabilityGap(id="qcg4", capability="交付效率", current=82, target=88, owner="后端小组", action="流程优化 + 工具链建设"),
    ])
    db.commit()


def _seed_skills(db: Session) -> None:
    now = "2026-08-01T00:00:00+00:00"
    db.add_all([
        models.SkillSource(
            id="qsrc-1", name="测试-Java编码规范", doc_type="markdown",
            source_lang="java", description="Java 后端服务编码规范测试示例",
            status="extracted", created_at=now, updated_at=now,
            content="# Java 编码规范\n\n- SQL 必须使用参数化查询。\n- 金额计算必须使用 BigDecimal。",
        ),
        models.SkillSource(
            id="qsrc-2", name="测试-前端编码规范", doc_type="markdown",
            source_lang="frontend", description="前端工程编码规范测试示例",
            status="extracted", created_at=now, updated_at=now,
            content="# 前端编码规范\n\n- 禁止提交 console.log。\n- 颜色必须使用设计 token。",
        ),
    ])
    db.commit()
    skills = [
        dict(id="qsk-1", source_id="qsrc-1", name="SQL 禁止字符串拼接", description="SQL 必须参数化查询", category="security", severity="high",
             rule_content="检查 SQL 查询是否使用参数化查询，禁止字符串拼接构造 SQL。",
             positive_examples=[{"desc": "参数化查询", "code": "ps.setString(1, id);"}], negative_examples=[{"desc": "拼接", "code": "String sql = \"...\" + id;"}]),
        dict(id="qsk-2", source_id="qsrc-1", name="金额使用 BigDecimal", description="金额计算禁止浮点", category="security", severity="high",
             rule_content="检查金额计算是否使用 BigDecimal 而非 float/double。",
             positive_examples=[{"desc": "Decimal", "code": "new BigDecimal(amount)"}], negative_examples=[{"desc": "浮点", "code": "double fee = amount * rate;"}]),
        dict(id="qsk-3", source_id="qsrc-2", name="禁止 console.log 提交", description="调试代码不得入主分支", category="quality", severity="medium",
             rule_content="检查代码中是否残留 console.log / debugger，禁止提交到主分支。",
             positive_examples=[{"desc": "日志库", "code": "logger.info('loaded')"}], negative_examples=[{"desc": "残留", "code": "console.log('here')"}]),
        dict(id="qsk-4", source_id="qsrc-2", name="禁止内联样式硬编码", description="颜色间距走设计 token", category="maintainability", severity="low",
             rule_content="检查组件是否使用内联样式硬编码颜色/间距，应使用设计 token。",
             positive_examples=[{"desc": "token", "code": "var(--color-primary)"}], negative_examples=[{"desc": "硬编码", "code": "'#1890ff'"}]),
    ]
    for s in skills:
        db.add(models.Skill(id=s["id"], source_id=s["source_id"], name=s["name"], description=s["description"],
                            category=s["category"], severity=s["severity"], check_type="llm",
                            rule_content=s["rule_content"], positive_examples=s["positive_examples"],
                            negative_examples=s["negative_examples"], enabled=1, created_at=now, updated_at=now))
    db.commit()
    db.add_all([
        models.SkillGroup(id="qskg-1", name="后端规范组", description="Java 后端默认评估编组",
                          skill_ids=["qsk-1", "qsk-2"], analysis_type="repo_analysis", enabled=1,
                          created_at=now, updated_at=now),
        models.SkillGroup(id="qskg-2", name="前端规范组", description="前端工程默认评估编组",
                          skill_ids=["qsk-3", "qsk-4"], analysis_type="repo_analysis", enabled=1,
                          created_at=now, updated_at=now),
    ])
    db.commit()


def _seed_capability(db: Session) -> None:
    from .capability import ALL_LEVELS, ROLE_DIMENSIONS, ROLE_NAMES, default_thresholds
    now = "2026-08-01T00:00:00+00:00"
    for role_key, dimensions in ROLE_DIMENSIONS.items():
        role = models.CapabilityRole(
            id=f"qcr-{role_key}", key=role_key, name=ROLE_NAMES[role_key],
            dimensions=list(dimensions), enabled=1, created_at=now, updated_at=now,
            skill_group_id="qskg-1" if role_key == "backend" else ("qskg-2" if role_key == "frontend" else None),
        )
        db.add(role)
        for level in ALL_LEVELS:
            db.add(models.CapabilityStandard(
                id=f"qcstd-{role_key}-{level.lower()}", role_id=role.id, level=level,
                thresholds=default_thresholds(role_key, level), updated_at=now,
            ))
    db.commit()


def _seed_env_inventory(db: Session) -> None:
    now = _now()
    scan_id = "qeinv-scan-1"
    db.add(models.EnvInventoryScan(
        id=scan_id, project_id="qp1", scan_type="full", status="completed",
        trigger="auto", started_at=now, finished_at=now,
        files_scanned=4, entries_found=5, added=0, changed=0, removed=0, unchanged=0,
        message="首次全量扫描",
    ))
    db.commit()
    entries = [
        dict(env="prod", tool_type="database", tool_name="mysql", key="spring.datasource.url",
             value="jdbc:mysql://10.0.1.20:3306/user_center?useSSL=true", is_secret=1,
             host="10.0.1.20", port="3306", username="uc_app", database="user_center",
             source_file="src/main/resources/application-prod.yml", source_line=12, detail={}),
        dict(env="prod", tool_type="redis", tool_name="redis", key="spring.redis.host",
             value="10.0.1.21:6379 · db=0", is_secret=0,
             host="10.0.1.21", port="6379", username="", database="0",
             source_file="src/main/resources/application-prod.yml", source_line=22, detail={}),
        dict(env="prod", tool_type="nacos", tool_name="nacos", key="spring.cloud.nacos.server-addr",
             value="nacos-prod:8848 · user=nacos", is_secret=0,
             host="nacos-prod", port="8848", username="nacos", database="",
             source_file="src/main/resources/application-prod.yml", source_line=31,
             detail={"namespace": "prod", "group": "DEFAULT_GROUP"}),
        dict(env="dev", tool_type="database", tool_name="mysql", key="spring.datasource.url",
             value="jdbc:mysql://127.0.0.1:3306/user_center_dev?useSSL=false", is_secret=1,
             host="127.0.0.1", port="3306", username="dev_app", database="user_center_dev",
             source_file="src/main/resources/application-dev.yml", source_line=12, detail={}),
        dict(env="dev", tool_type="redis", tool_name="redis", key="spring.redis.host",
             value="127.0.0.1:6379 · db=0", is_secret=0,
             host="127.0.0.1", port="6379", username="", database="0",
             source_file="src/main/resources/application-dev.yml", source_line=22, detail={}),
    ]
    for i, entry in enumerate(entries, start=1):
        db.add(models.EnvInventoryEntry(
            id=f"qeinv-{i}", project_id="qp1", scan_id=scan_id, **entry,
            fingerprint=fingerprint(entry["tool_name"], entry["env"], entry["host"], entry["port"],
                                    entry["database"], entry["source_file"]),
            file_mtime=now, first_seen_at=now, updated_at=now, status="active",
        ))
    db.commit()
    # 环境盘点规则：与其它租户一致补齐内置默认规则（仅当缺 slug 时插入）
    from .seed import ensure_default_env_inventory_skills
    ensure_default_env_inventory_skills(db, SEED_TENANT)
    db.commit()


def _seed_evaluations(db: Session) -> None:
    now = _now()
    def snapshot(group_name: str, group_id: str, skill_ids: list[str], skill_names: list[str]) -> dict:
        return {
            "group_name": group_name, "group_id": group_id, "skill_ids": skill_ids,
            "skills": [{"id": sid, "name": name, "category": "security", "severity": "high",
                        "rule_content": "测试规则快照", "positive_examples": [], "negative_examples": []}
                       for sid, name in zip(skill_ids, skill_names)],
        }
    db.add_all([
        models.DeveloperEvaluation(
            id="qdeval-1", developer_id="qd1", role_key="backend", skill_group_id="qskg-1",
            project_id="qp1", repo_path="/data/repos/user-center", git_author="陈思",
            scores={"code_quality": 88, "architecture": 91, "stability": 84, "efficiency": 81,
                    "collaboration": 86, "security_aware": 79, "test_coverage": 77, "growth_velocity": 75},
            evidence=[{"dimension": "architecture", "summary": "auth-core 模块设计良好", "rules": ["架构评审通过"]}],
            rule_snapshot=snapshot("后端规范组", "qskg-1", ["qsk-1", "qsk-2"], ["SQL 禁止字符串拼接", "金额使用 BigDecimal"]),
            achieved_level="E3", best_level="E3",
            gaps=[{"dimension": "security_aware", "current": 79, "target": 84, "gap": 5}],
            summary="后端架构师，架构能力突出，达到 E3 标准。",
            status="completed", error="", created_at=now, updated_at=now,
        ),
        models.DeveloperEvaluation(
            id="qdeval-2", developer_id="qd3", role_key="frontend", skill_group_id="qskg-2",
            project_id="qp3", repo_path="/data/repos/content-engine", git_author="王琳",
            scores={"code_quality": 87, "architecture": 80, "ui_quality": 92, "responsive": 89,
                    "collaboration": 90, "security_aware": 75, "test_coverage": 78, "growth_velocity": 82},
            evidence=[{"dimension": "ui_quality", "summary": "设计系统沉淀优秀", "rules": ["UI 评审通过"]}],
            rule_snapshot=snapshot("前端规范组", "qskg-2", ["qsk-3", "qsk-4"], ["禁止 console.log 提交", "禁止内联样式硬编码"]),
            achieved_level="E3", best_level="E3",
            gaps=[{"dimension": "security_aware", "current": 75, "target": 82, "gap": 7}],
            summary="前端资深工程师，UI 质量突出，达到 E3 标准。",
            status="completed", error="", created_at=now, updated_at=now,
        ),
    ])
    db.commit()


def _seed_portfolio_and_reports(db: Session) -> None:
    # 组合对比快照：每个项目几条历史趋势
    snapshots = [
        dict(pid="qp1", score=84, quality=86, security=83, debt=26, recorded_at="2026-05-01T00:00:00+00:00"),
        dict(pid="qp1", score=86, quality=88, security=84, debt=24, recorded_at="2026-06-01T00:00:00+00:00"),
        dict(pid="qp1", score=88, quality=90, security=85, debt=22, recorded_at="2026-07-01T00:00:00+00:00"),
        dict(pid="qp2", score=88, quality=90, security=87, debt=20, recorded_at="2026-05-01T00:00:00+00:00"),
        dict(pid="qp2", score=89, quality=91, security=88, debt=19, recorded_at="2026-06-01T00:00:00+00:00"),
        dict(pid="qp2", score=90, quality=92, security=88, debt=18, recorded_at="2026-07-01T00:00:00+00:00"),
        dict(pid="qp3", score=90, quality=92, security=89, debt=17, recorded_at="2026-05-01T00:00:00+00:00"),
        dict(pid="qp3", score=91, quality=93, security=90, debt=16, recorded_at="2026-06-01T00:00:00+00:00"),
        dict(pid="qp3", score=92, quality=94, security=90, debt=15, recorded_at="2026-07-01T00:00:00+00:00"),
    ]
    projects = {p.id: p for p in db.query(models.Project).filter_by(tenant_id=SEED_TENANT).all()}
    for i, s in enumerate(snapshots, start=1):
        p = projects.get(s["pid"])
        if not p:
            continue
        db.add(models.ProjectAssessmentSnapshot(
            id=f"qpsnap-{i}", project_id=s["pid"], score=s["score"], quality=s["quality"],
            security=s["security"], debt=s["debt"], contributors=p.contributors or 0,
            commits=p.commits or 0, recorded_at=s["recorded_at"], source="analysis",
        ))
    db.commit()
    # 报告导出记录
    db.add_all([
        models.ReportExport(id="qrpt-1", report_type="project_comparison", format="html",
                            subject_ids=["qp1", "qp2", "qp3"], requested_by=DEFAULT_USER_ID,
                            created_at=_now()),
        models.ReportExport(id="qrpt-2", report_type="developer_evaluation", format="pdf",
                            subject_ids=["qd1", "qdeval-1"], requested_by=DEFAULT_USER_ID,
                            created_at=_now()),
    ])
    db.commit()


def _seed_tenant_and_membership(db: Session) -> None:
    now = _now()
    # 保证本地管理员用户存在（幂等）
    user = db.query(models.AccountUser).filter_by(id=DEFAULT_USER_ID).first()
    if not user:
        db.add(models.AccountUser(
            id=DEFAULT_USER_ID, email="local-admin@devlens.local", name="本地管理员",
            status="active", created_at=now, updated_at=now,
        ))
        db.flush()
    # 租户
    db.add(models.Tenant(
        id=SEED_TENANT, name=TENANT_NAME, slug=TENANT_SLUG,
        status="active", created_at=now, updated_at=now,
    ))
    db.add(models.TenantMembership(
        id="qtmem-owner", tenant_id=SEED_TENANT, user_id=DEFAULT_USER_ID,
        role="owner", created_at=now, updated_at=now,
    ))
    db.commit()


def _seed_demo_login(db: Session) -> None:
    """为本地管理员账号设置演示密码，保证前端登录可用。

    前端 app-shell 强制登录（无 token 跳 /login）；本地管理员账号默认
    password_hash 为空无法密码登录，这里补一个可记忆的演示密码。幂等：
    每次重跑都重置为该密码。
    """
    from .auth import hash_password

    user = db.query(models.AccountUser).filter_by(id=DEFAULT_USER_ID).first()
    if not user:
        user = models.AccountUser(
            id=DEFAULT_USER_ID, email="local-admin@devlens.local", name="本地管理员",
            status="active", created_at=_now(), updated_at=_now(),
        )
        db.add(user)
        db.flush()
    user.password_hash = hash_password("Admin123!")
    db.commit()


def seed_test_tenant() -> None:
    Base.metadata.create_all(engine)
    db = _make_seed_session()
    _clear(db)
    _seed_tenant_and_membership(db)
    _seed_demo_login(db)
    _seed_org_and_teams(db)
    _seed_developers(db)
    _seed_projects(db)
    _seed_project_details(db)
    _seed_repos_identity_gaps(db)
    _seed_skills(db)
    _seed_capability(db)
    _seed_env_inventory(db)
    _seed_evaluations(db)
    _seed_portfolio_and_reports(db)
    db.close()
    print("✓ 测试租户 seed 完成")


if __name__ == "__main__":
    seed_test_tenant()
