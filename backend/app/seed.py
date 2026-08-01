"""初始化基础数据 -- 从 frontend/lib/mock-data.ts 移植

JSON 字段统一用 camelCase key（与前端类型一致），Pydantic 读取后原样输出。
"""
from sqlalchemy.orm import Session

from .db import SessionLocal, Base, engine
from . import models


def _clear(db: Session) -> None:
    for t in [
        models.FixPriority, models.ModuleRisk, models.Insight,
        models.AnalysisRun, models.Repository, models.Project,
        models.CapabilityGap, models.IdentityMatch, models.Developer,
        models.Team, models.TeamGroup, models.TeamSpace, models.LargeTeam,
    ]:
        db.query(t).delete()
    db.commit()


# ============ 开发者详情（d1/d2/d3）============
_DEV_DETAILS = {
    "d1": dict(
        capability={"code_quality": 88, "architecture": 92, "stability": 85, "efficiency": 82, "collaboration": 87, "security_aware": 80, "test_coverage": 78, "growth_velocity": 76},
        team_capability_avg={"code_quality": 86, "architecture": 90, "stability": 82, "efficiency": 80, "collaboration": 85, "security_aware": 78, "test_coverage": 75},
        growth_curve=[{"period": "2024 Q1", "composite": 78, "teamAvg": 80}, {"period": "2024 Q2", "composite": 81, "teamAvg": 81}, {"period": "2024 Q3", "composite": 83, "teamAvg": 82}, {"period": "2024 Q4", "composite": 85, "teamAvg": 83}, {"period": "2025 Q1", "composite": 87, "teamAvg": 84}, {"period": "2025 Q2", "composite": 89, "teamAvg": 84}],
        behavior_evidence=[{"label": "提交频率", "value": 8.2, "unit": "次/周", "benchmark": 5.5, "description": "高于组织均值 49%"}, {"label": "节奏规律性", "value": 0.78, "unit": "", "benchmark": 0.62, "description": "工作时间分布稳定"}, {"label": "Revert 比例", "value": 2.1, "unit": "%", "benchmark": 4.8, "description": "远低于均值，代码质量稳定"}, {"label": "Hotfix 比例", "value": 1.5, "unit": "%", "benchmark": 3.2, "description": "紧急修复少，前置质量好"}],
        partners=[{"name": "林涛", "username": "lintao", "sharedCommits": 42, "reviewCount": 28}, {"name": "赵磊", "username": "zhaolei", "sharedCommits": 31, "reviewCount": 22}, {"name": "吴婷", "username": "wuting", "sharedCommits": 18, "reviewCount": 15}],
        modules=[{"module": "auth-service", "commits": 156, "ownership": 72, "complexity": 68}, {"module": "user-core", "commits": 134, "ownership": 65, "complexity": 55}, {"module": "session-mgr", "commits": 89, "ownership": 80, "complexity": 42}, {"module": "permission", "commits": 33, "ownership": 45, "complexity": 38}],
        ai_suggestion="架构能力突出（92 分，团队前 10%），建议参与跨组架构评审会。安全意识（80）略低于架构水平，可补强安全 review 参与度。主导 auth-service 模块（72% 归属），建议培养备份负责人降低 Bus Factor。",
    ),
    "d3": dict(
        capability={"code_quality": 89, "architecture": 88, "stability": 0, "efficiency": 0, "collaboration": 91, "security_aware": 82, "test_coverage": 86, "growth_velocity": 78, "ui_quality": 93, "responsive": 90},
        team_capability_avg={"code_quality": 84, "architecture": 78, "stability": 0, "efficiency": 0, "collaboration": 82, "security_aware": 70, "test_coverage": 52},
        growth_curve=[{"period": "2024 Q1", "composite": 80, "teamAvg": 75}, {"period": "2024 Q2", "composite": 82, "teamAvg": 77}, {"period": "2024 Q3", "composite": 84, "teamAvg": 78}, {"period": "2024 Q4", "composite": 85, "teamAvg": 79}, {"period": "2025 Q1", "composite": 86, "teamAvg": 80}, {"period": "2025 Q2", "composite": 87, "teamAvg": 81}],
        behavior_evidence=[{"label": "提交频率", "value": 7.4, "unit": "次/周", "benchmark": 5.5, "description": "长期稳定投入核心前端模块"}, {"label": "节奏规律性", "value": 0.81, "unit": "", "benchmark": 0.62, "description": "交付节奏稳定，返工较少"}, {"label": "Revert 比例", "value": 1.7, "unit": "%", "benchmark": 4.8, "description": "前端变更稳定性高"}, {"label": "Hotfix 比例", "value": 1.0, "unit": "%", "benchmark": 3.2, "description": "线上紧急修复低于均值"}],
        partners=[{"name": "周杰", "username": "zhoujie", "sharedCommits": 76, "reviewCount": 42}, {"name": "陈思", "username": "chensi", "sharedCommits": 35, "reviewCount": 21}],
        modules=[{"module": "design-system", "commits": 148, "ownership": 78, "complexity": 52}, {"module": "content-renderer", "commits": 121, "ownership": 68, "complexity": 65}, {"module": "mobile-shell", "commits": 86, "ownership": 72, "complexity": 58}],
        ai_suggestion="已达到前端工程师 E3 资深工程师标准。UI 质量（93）和响应式（90）是明显优势，适合主导设计系统和复杂交互。若未来冲刺 D 级高阶能力层，建议加强跨端架构决策、前端安全治理与组织级技术影响力。",
    ),
    "d2": dict(
        capability={"code_quality": 90, "architecture": 88, "stability": 89, "efficiency": 86, "collaboration": 90, "security_aware": 84, "test_coverage": 88, "growth_velocity": 82},
        team_capability_avg={"code_quality": 88, "architecture": 85, "stability": 87, "efficiency": 84, "collaboration": 88, "security_aware": 82, "test_coverage": 86},
        growth_curve=[{"period": "2024 Q1", "composite": 82, "teamAvg": 83}, {"period": "2024 Q2", "composite": 85, "teamAvg": 84}, {"period": "2024 Q3", "composite": 87, "teamAvg": 85}, {"period": "2024 Q4", "composite": 88, "teamAvg": 85}, {"period": "2025 Q1", "composite": 90, "teamAvg": 86}, {"period": "2025 Q2", "composite": 91, "teamAvg": 86}],
        behavior_evidence=[{"label": "提交频率", "value": 10.5, "unit": "次/周", "benchmark": 5.5, "description": "高于组织均值 91%"}, {"label": "节奏规律性", "value": 0.72, "unit": "", "benchmark": 0.62, "description": "分布较稳定"}, {"label": "Revert 比例", "value": 1.8, "unit": "%", "benchmark": 4.8, "description": "代码质量很高"}, {"label": "Hotfix 比例", "value": 1.2, "unit": "%", "benchmark": 3.2, "description": "紧急修复极少"}],
        partners=[{"name": "陈思", "username": "chensi", "sharedCommits": 42, "reviewCount": 35}, {"name": "张敏", "username": "zhangmin", "sharedCommits": 28, "reviewCount": 19}],
        modules=[{"module": "order-core", "commits": 198, "ownership": 68, "complexity": 72}, {"module": "payment-gw", "commits": 142, "ownership": 55, "complexity": 65}, {"module": "inventory", "commits": 88, "ownership": 60, "complexity": 48}],
        ai_suggestion="全面均衡型开发者，7 维均在 84+，协作能力（90）尤为突出。Review 参与度高（198 次），是团队的知识传递者。建议承担新人 mentor 角色。",
    ),
}


def seed() -> None:
    Base.metadata.create_all(engine)
    db = SessionLocal()
    _clear(db)

    # ---- LargeTeams ----
    db.add_all([
        models.LargeTeam(id="lt-tech", name="技术研发中心", description="负责全公司技术基础设施与产品研发"),
        models.LargeTeam(id="lt-data", name="数据智能中心", description="负责数据平台、算法与智能化能力"),
    ])
    db.commit()

    # ---- TeamSpaces ----
    db.add_all([
        models.TeamSpace(id="t1", name="平台架构组", large_team_id="lt-tech", description="负责账户、权限、消息等平台基础能力。", owner_id="d1", owner_name="陈思", status="active", created_at="2025-03-12", updated_at="今天 10:32", member_ids=["d1"], project_ids=["p1", "p8"]),
        models.TeamSpace(id="t2", name="业务中台组", large_team_id="lt-tech", description="负责订单、库存及业务交易核心链路。", owner_id="d2", owner_name="林涛", status="active", created_at="2025-03-18", updated_at="今天 09:12", member_ids=["d2", "d6"], project_ids=["p2"]),
        models.TeamSpace(id="t3", name="前端体验组", large_team_id="lt-tech", description="负责内容体验、设计系统与用户端工程。", owner_id="d3", owner_name="王琳", status="active", created_at="2025-04-02", updated_at="昨天", member_ids=["d3", "d7"], project_ids=["p5"]),
        models.TeamSpace(id="t5", name="基础架构组", large_team_id="lt-tech", description="负责交付平台、稳定性和基础设施。", owner_id="d5", owner_name="刘洋", status="active", created_at="2025-04-22", updated_at="昨天", member_ids=["d5"], project_ids=["p7"]),
        models.TeamSpace(id="t4", name="数据智能组", large_team_id="lt-data", description="负责数据平台、模型服务和智能化能力。", owner_id="d4", owner_name="赵磊", status="active", created_at="2025-04-10", updated_at="3 小时前", member_ids=["d4", "d8"], project_ids=["p3", "p4", "p6"]),
        models.TeamSpace(id="t6", name="安全合规组", large_team_id="lt-tech", description="负责安全基线、风险治理与合规审查。", status="active", created_at="2025-05-08", updated_at="2 天前", member_ids=[], project_ids=[]),
    ])
    db.commit()

    # ---- TeamGroups ----
    db.add_all([
        models.TeamGroup(id="g-platform-core", team_id="t1", name="核心服务小组", lead_id="d1", lead_name="陈思", member_ids=["d1"], project_ids=["p1", "p8"]),
        models.TeamGroup(id="g-business-order", team_id="t2", name="交易服务小组", lead_id="d2", lead_name="林涛", member_ids=["d2", "d6"], project_ids=["p2"]),
        models.TeamGroup(id="g-frontend-content", team_id="t3", name="内容体验小组", lead_id="d3", lead_name="王琳", member_ids=["d3", "d7"], project_ids=["p5"]),
    ])
    db.commit()  # 确保 team_spaces/team_groups 先入库，满足 developers 外键

    # ---- Developers ----
    devs = [
        dict(id="d1", name="陈思", username="chensi", role="架构师", role_type="backend", team="平台架构组", team_id="t1", group_id="g-platform-core", level="E3", overall=89, commits=412, reviews=156, langs=["Go", "Python"], tags=["核心模块贡献者", "偏后端架构"]),
        dict(id="d2", name="林涛", username="lintao", role="技术专家", role_type="backend", team="业务中台组", team_id="t2", group_id="g-business-order", level="D2", overall=91, commits=523, reviews=198, langs=["Java", "Kotlin"], tags=["核心模块贡献者", "架构能力突出"]),
        dict(id="d3", name="王琳", username="wanglin", role="高级工程师", role_type="frontend", team="前端体验组", team_id="t3", group_id="g-frontend-content", level="E3", overall=87, commits=387, reviews=134, langs=["TypeScript", "React"], tags=["核心模块贡献者", "前端专家", "13年经验示例"]),
        dict(id="d4", name="赵磊", username="zhaolei", role="技术专家", role_type="algorithm", team="数据智能组", team_id="t4", level="D3", overall=93, commits=612, reviews=245, langs=["Python", "Rust"], tags=["全栈能力", "成长速度快"]),
        dict(id="d5", name="刘洋", username="liuyang", role="高级工程师", role_type="devops", team="基础架构组", team_id="t5", level="E1", overall=78, commits=298, reviews=87, langs=["Go"], tags=["稳定性强", "运维能力"]),
        dict(id="d6", name="张敏", username="zhangmin", role="工程师", role_type="backend", team="业务中台组", team_id="t2", group_id="g-business-order", level="F2", overall=72, commits=234, reviews=56, langs=["Java"], tags=["成长中", "业务理解"]),
        dict(id="d7", name="周杰", username="zhoujie", role="工程师", role_type="frontend", team="前端体验组", team_id="t3", group_id="g-frontend-content", level="F3", overall=75, commits=267, reviews=78, langs=["TypeScript", "Vue"], tags=["协作能力突出"]),
        dict(id="d8", name="吴婷", username="wuting", role="高级工程师", role_type="algorithm", team="数据智能组", team_id="t4", level="E2", overall=82, commits=341, reviews=112, langs=["Python", "SQL"], tags=["数据建模", "安全意识强"]),
    ]
    for d in devs:
        detail = _DEV_DETAILS.get(d["id"], {})
        db.add(models.Developer(**d, **detail))
    db.commit()

    # ---- Teams ----
    db.add_all([
        models.Team(id="t1", name="平台架构组", members=8, avg_score=84, bus_factor=3, risk_count=1, capability={"code_quality": 86, "architecture": 90, "stability": 82, "efficiency": 80, "collaboration": 85, "security_aware": 78, "test_coverage": 75}),
        models.Team(id="t2", name="业务中台组", members=12, avg_score=86, bus_factor=4, risk_count=0, capability={"code_quality": 88, "architecture": 85, "stability": 87, "efficiency": 84, "collaboration": 88, "security_aware": 82, "test_coverage": 86}),
        models.Team(id="t3", name="前端体验组", members=7, avg_score=81, bus_factor=2, risk_count=2, capability={"code_quality": 84, "architecture": 78, "stability": 80, "efficiency": 85, "collaboration": 82, "security_aware": 70, "test_coverage": 52}),
        models.Team(id="t4", name="数据智能组", members=9, avg_score=83, bus_factor=2, risk_count=3, capability={"code_quality": 85, "architecture": 84, "stability": 78, "efficiency": 88, "collaboration": 80, "security_aware": 58, "test_coverage": 72}),
        models.Team(id="t5", name="基础架构组", members=6, avg_score=76, bus_factor=2, risk_count=2, capability={"code_quality": 78, "architecture": 82, "stability": 80, "efficiency": 72, "collaboration": 75, "security_aware": 81, "test_coverage": 68}),
        models.Team(id="t6", name="安全合规组", members=5, avg_score=79, bus_factor=3, risk_count=1, capability={"code_quality": 75, "architecture": 76, "stability": 85, "efficiency": 70, "collaboration": 82, "security_aware": 92, "test_coverage": 80}),
    ])
    db.commit()

    # ---- Projects（基础）----
    projects = [
        dict(id="p1", name="用户中心", group="平台架构组", team_id="t1", language="Go", score=88, quality=90, security=85, debt=22, status="completed", commits=1847, contributors=4, last_analyzed="2小时前"),
        dict(id="p2", name="订单系统", group="业务中台组", team_id="t2", language="Java", score=90, quality=92, security=88, debt=18, status="completed", commits=3214, contributors=6, last_analyzed="1小时前"),
        dict(id="p3", name="数据网关", group="数据智能组", team_id="t4", language="Python", score=94, quality=95, security=92, debt=12, status="completed", commits=2456, contributors=7, last_analyzed="3小时前"),
        dict(id="p4", name="支付平台", group="数据智能组", team_id="t4", language="Java", score=65, quality=70, security=58, debt=45, status="analyzing", commits=4102, contributors=4, last_analyzed="分析中"),
        dict(id="p5", name="内容引擎", group="前端体验组", team_id="t3", language="TypeScript", score=92, quality=94, security=90, debt=15, status="completed", commits=2891, contributors=5, last_analyzed="4小时前"),
        dict(id="p6", name="搜索中台", group="数据智能组", team_id="t4", language="Python", score=81, quality=83, security=79, debt=28, status="completed", commits=1567, contributors=3, last_analyzed="6小时前"),
        dict(id="p7", name="风控引擎", group="基础架构组", team_id="t5", language="Go", score=79, quality=81, security=82, debt=25, status="completed", commits=2034, contributors=4, last_analyzed="8小时前"),
        dict(id="p8", name="消息推送", group="平台架构组", team_id="t1", language="Go", score=74, quality=76, security=72, debt=32, status="pending", commits=892, contributors=2, last_analyzed="待分析"),
    ]
    for p in projects:
        db.add(models.Project(**p))
    db.commit()  # 确保 projects 先入库，满足 insights/module_risks/fixes 外键

    # ---- 项目详情 p1/p2 ----
    _seed_project_detail_p1(db)
    db.commit()
    _seed_project_detail_p2(db)
    db.commit()

    # ---- Repositories ----
    db.add_all([
        models.Repository(id="r1", name="用户中心", path="/data/repos/user-center", source_type="remote", provider="gitlab", remote_url="https://gitlab.example.com/platform/user-center.git", branch="main", team_id="t1", project_id="p1", status="synced", last_sync="2分钟前", commits=1847, contributors=4),
        models.Repository(id="r2", name="订单系统", path="/data/repos/order-sys", source_type="remote", provider="github", remote_url="https://github.com/acme/order-system.git", branch="main", team_id="t2", project_id="p2", status="synced", last_sync="1小时前", commits=3214, contributors=6),
        models.Repository(id="r3", name="数据网关", path="/data/repos/data-gateway", source_type="local", branch="develop", team_id="t4", project_id="p3", status="synced", last_sync="3小时前", commits=2456, contributors=7),
        models.Repository(id="r4", name="支付平台", path="/data/repos/payment", source_type="remote", provider="gitlab", remote_url="https://gitlab.example.com/data/payment.git", branch="main", team_id="t4", project_id="p4", status="syncing", last_sync="同步中", commits=4102, contributors=4),
        models.Repository(id="r5", name="内容引擎", path="/data/repos/content-engine", source_type="remote", provider="github", remote_url="https://github.com/acme/content-engine.git", branch="main", team_id="t3", project_id="p5", status="synced", last_sync="4小时前", commits=2891, contributors=5),
        models.Repository(id="r6", name="搜索中台", path="/data/repos/search", source_type="local", branch="main", team_id="t4", project_id="p6", status="failed", last_sync="2天前", commits=1567, contributors=3),
    ])

    # ---- IdentityMatches ----
    db.add_all([
        models.IdentityMatch(id="im1", git_name="chensi42", git_email="chensi@company.com", person_name="陈思", department="平台架构组", confidence=1.0, method="email"),
        models.IdentityMatch(id="im2", git_name="Lin Tao", git_email="lintao@github.com", person_name="林涛", department="业务中台组", confidence=0.9, method="employee_id"),
        models.IdentityMatch(id="im3", git_name="wanglin_dev", git_email="wl123@qq.com", person_name="王琳", department="前端体验组", confidence=0.75, method="pinyin"),
        models.IdentityMatch(id="im4", git_name="zhaolei88", git_email="zl88@163.com", person_name="赵磊", department="数据智能组", confidence=0.85, method="fuzzy"),
        models.IdentityMatch(id="im5", git_name="dependabot[bot]", git_email="support@github.com", person_name="-", department="-", confidence=0.0, method="email"),
    ])

    # ---- CapabilityGaps ----
    db.add_all([
        models.CapabilityGap(id="cg1", capability="安全意识", current=58, target=80, owner="数据智能组", action="安全培训 + 代码审查配对"),
        models.CapabilityGap(id="cg2", capability="测试覆盖", current=52, target=75, owner="前端体验组", action="引入覆盖率门禁 + 测试用例补齐"),
        models.CapabilityGap(id="cg3", capability="架构能力", current=76, target=85, owner="前端体验组", action="架构评审会 + 跨组技术分享"),
        models.CapabilityGap(id="cg4", capability="交付效率", current=72, target=80, owner="基础架构组", action="流程优化 + 工具链建设"),
    ])

    db.commit()
    db.close()
    print("✓ seed 完成")


def _seed_project_detail_p1(db: Session) -> None:
    pid = "p1"
    db.add_all([
        models.Insight(id="ins-jwt-algorithm", project_id=pid, title="JWT 校验未限制签名算法", module="auth-service", type="security", category="security", severity="high", level="warning", risk_score=91, confidence=0.94, status="open", file_path="services/auth/token.ts", symbol="verifyToken", start_line=42, end_line=58, source="SAST + AI Review", first_seen_at="2026-07-18", last_seen_at="2026-07-26", assignee="陈思", evidence="3 处 JWT 校验未检查签名算法", code_excerpt="jwt.verify(token, publicKey, options)", impact="潜在算法混淆攻击，可能绕过身份校验。", action="强制 RS256 算法白名单，并增加拒绝非白名单算法的测试。", verification="安全规则重扫通过，新增算法拒绝单测。"),
        models.Insight(id="ins-user-service", project_id=pid, title="UserService 过度聚合", module="user-core", type="maintainability", category="complexity", severity="medium", level="info", risk_score=68, confidence=0.88, status="acknowledged", file_path="modules/user/UserService.ts", symbol="UserService", start_line=1, end_line=1200, source="Complexity Analyzer + AI Review", first_seen_at="2026-06-12", last_seen_at="2026-07-26", assignee="刘洋", evidence="单文件 1200 行，查询、写入与权限逻辑高度耦合。", code_excerpt="export class UserService { /* 42 public methods */ }", impact="维护成本高，认知负载重，变更回归范围扩大。", action="拆分为 UserQuery、UserCommand 与 PermissionFacade 三个服务。", verification="模块复杂度低于 60，关键 API 回归测试覆盖。"),
        models.Insight(id="ins-redis-pool", project_id=pid, title="Redis 连接未复用", module="session-mgr", type="performance", category="reliability", severity="high", level="warning", risk_score=82, confidence=0.91, status="in_progress", file_path="services/session/redis-client.ts", symbol="getSession", start_line=18, end_line=35, source="Performance Rule + AI Review", first_seen_at="2026-07-03", last_seen_at="2026-07-26", assignee="周杰", evidence="每次请求新建 Redis 客户端，缺少连接池和超时控制。", code_excerpt="const client = createClient({ url: redisUrl })", impact="P99 延迟偏高（180ms），高峰期可能耗尽连接。", action="引入连接池、连接复用、超时和哨兵故障转移策略。", verification="压测 P99 低于 80ms，连接数保持在容量阈值内。"),
        models.Insight(id="ins-env-debug", project_id=pid, title="生产环境允许 Debug 日志", module="gateway-config", type="configuration", category="configuration", severity="medium", level="warning", risk_score=72, confidence=0.79, status="open", file_path="deploy/values-prod.yaml", start_line=24, end_line=24, source="Config Scanner", first_seen_at="2026-07-26", last_seen_at="2026-07-26", evidence="production values 中 LOG_LEVEL 设置为 debug。", code_excerpt="LOG_LEVEL: debug", impact="可能记录敏感请求上下文并增加生产 I/O 开销。", action="生产环境改为 info，并通过 CI 阻止 debug 配置进入发布包。", verification="部署清单重扫无生产 debug 配置。"),
    ])
    db.add_all([
        models.ModuleRisk(id="module-auth", project_id=pid, name="auth-service", path="services/auth", score=84, severity="high", critical_count=0, issue_count=2, complexity=68, debt_load=18, owner="陈思", backup_owner="刘洋", ownership=72, last_changed="2 小时前", categories=[{"category": "security", "count": 1}, {"category": "logic", "count": 1}]),
        models.ModuleRisk(id="module-session", project_id=pid, name="session-mgr", path="services/session", score=78, severity="high", critical_count=0, issue_count=2, complexity=57, debt_load=12, owner="周杰", ownership=48, last_changed="昨天", categories=[{"category": "performance", "count": 1}, {"category": "reliability", "count": 1}]),
        models.ModuleRisk(id="module-user", project_id=pid, name="user-core", path="modules/user", score=65, severity="medium", critical_count=0, issue_count=3, complexity=83, debt_load=10, owner="刘洋", backup_owner="陈思", ownership=65, last_changed="3 天前", categories=[{"category": "complexity", "count": 2}, {"category": "maintainability", "count": 1}]),
        models.ModuleRisk(id="module-gateway", project_id=pid, name="gateway-config", path="deploy", score=58, severity="medium", critical_count=0, issue_count=1, complexity=12, debt_load=4, ownership=0, last_changed="今天", categories=[{"category": "configuration", "count": 1}]),
    ])
    db.add_all([
        models.FixPriority(id="fix-jwt", project_id=pid, insight_id="ins-jwt-algorithm", module="auth-service", title="限制 JWT 签名算法", severity="high", priority="P0", debt=18, effort="3 人日", impact="消除身份校验绕过风险", expected_gain=7, status="open", assignee="陈思", due_date="7 月 31 日"),
        models.FixPriority(id="fix-redis", project_id=pid, insight_id="ins-redis-pool", module="session-mgr", title="引入 Redis 连接池", severity="high", priority="P1", debt=12, effort="2 人日", impact="P99 延迟预计降至 80ms", expected_gain=4, status="in_progress", assignee="周杰", due_date="8 月 2 日"),
        models.FixPriority(id="fix-user-service", project_id=pid, insight_id="ins-user-service", module="user-core", title="拆分 UserService", severity="medium", priority="P2", debt=10, effort="5 人日", impact="降低认知负载和回归范围", expected_gain=3, status="acknowledged", assignee="刘洋", due_date="8 月 16 日"),
    ])
    p = db.query(models.Project).get(pid)
    if p:
        p.dimensions = [
            {"label": "代码质量", "score": 90, "benchmark": 78, "trend": "up", "description": "AI Review 通过率 92%，lint 合规率 96%"},
            {"label": "安全性", "score": 85, "benchmark": 75, "trend": "stable", "description": "无高危漏洞，密钥检测通过"},
            {"label": "测试覆盖", "score": 82, "benchmark": 68, "trend": "up", "description": "行覆盖 82%，分支覆盖 71%"},
            {"label": "技术债", "score": 78, "benchmark": 72, "trend": "down", "description": "复杂度集中在 auth 模块，待重构"},
            {"label": "交付稳定性", "score": 88, "benchmark": 80, "trend": "up", "description": "近 30 天无回滚，MTTR 12 分钟"},
        ]
        p.contributor_list = [
            {"name": "陈思", "username": "chensi", "commits": 156, "reviews": 62, "ownership": 72},
            {"name": "刘洋", "username": "liuyang", "commits": 89, "reviews": 31, "ownership": 38},
            {"name": "周杰", "username": "zhoujie", "commits": 67, "reviews": 18, "ownership": 25},
        ]
        p.debt_trend = [{"month": "2月", "debt": 28, "complexity": 65}, {"month": "3月", "debt": 26, "complexity": 63}, {"month": "4月", "debt": 25, "complexity": 62}, {"month": "5月", "debt": 24, "complexity": 60}, {"month": "6月", "debt": 23, "complexity": 58}, {"month": "7月", "debt": 22, "complexity": 57}]
        p.review_summary = {"total": 8, "critical": 0, "open": 3, "newSinceLastScan": 2, "inProgress": 1, "resolved": 4}
        p.analysis_meta = {"branch": "main", "commit": "7f3a2ce", "analysisVersion": "2026.07", "scannedAt": "今天 10:32", "coverage": 96, "filesScanned": 842, "confidence": 0.91}


def _seed_project_detail_p2(db: Session) -> None:
    pid = "p2"
    db.add_all([
        models.Insight(id="ins-decimal", project_id=pid, title="金额计算使用浮点数", module="payment-gw", type="security", category="logic", severity="high", level="warning", risk_score=79, confidence=0.9, status="open", file_path="payment/MoneyCalculator.java", symbol="calculateFee", start_line=33, end_line=47, source="Logic Rule + AI Review", first_seen_at="2026-07-20", last_seen_at="2026-07-26", assignee="林涛", evidence="金额计算未使用 Decimal/BigDecimal。", code_excerpt="double fee = amount * rate;", impact="浮点精度误差可能导致订单金额不一致。", action="统一使用 BigDecimal，并增加边界金额和舍入方式测试。", verification="金额精度规则通过，边界测试覆盖。"),
        models.Insight(id="ins-state-machine", project_id=pid, title="订单状态机是可复用最佳实践", module="order-core", type="quality", category="quality", severity="info", level="info", risk_score=12, confidence=0.96, status="resolved", file_path="order/OrderStateMachine.kt", symbol="OrderStateMachine", start_line=1, end_line=208, source="AI Review", first_seen_at="2026-07-26", last_seen_at="2026-07-26", evidence="状态转换完整，异常分支和单元测试覆盖充分。", impact="维护成本低，可作为同类领域实现模板。", action="沉淀为团队订单领域建模范式。", verification="架构评审通过并已输出模块文档。"),
    ])
    db.add_all([
        models.ModuleRisk(id="module-payment", project_id=pid, name="payment-gw", path="payment", score=73, severity="high", critical_count=0, issue_count=1, complexity=45, debt_load=14, owner="林涛", backup_owner="张敏", ownership=55, last_changed="5 小时前", categories=[{"category": "logic", "count": 1}]),
        models.ModuleRisk(id="module-order", project_id=pid, name="order-core", path="order", score=24, severity="low", critical_count=0, issue_count=0, complexity=38, debt_load=3, owner="林涛", backup_owner="张敏", ownership=68, last_changed="昨天", categories=[{"category": "quality", "count": 0}]),
        models.ModuleRisk(id="module-inventory", project_id=pid, name="inventory", path="inventory", score=41, severity="medium", critical_count=0, issue_count=1, complexity=51, debt_load=4, owner="张敏", ownership=42, last_changed="6 天前", categories=[{"category": "maintainability", "count": 1}]),
    ])
    db.add_all([
        models.FixPriority(id="fix-decimal", project_id=pid, insight_id="ins-decimal", module="payment-gw", title="替换为 BigDecimal 金额模型", severity="high", priority="P1", debt=14, effort="2 人日", impact="消除金额精度风险", expected_gain=4, status="open", assignee="林涛", due_date="8 月 4 日"),
        models.FixPriority(id="fix-inventory", project_id=pid, module="inventory", title="提取库存规则策略", severity="medium", priority="P2", debt=4, effort="1 人日", impact="提升可读性", expected_gain=1, status="acknowledged", assignee="张敏", due_date="8 月 9 日"),
    ])
    p = db.query(models.Project).get(pid)
    if p:
        p.dimensions = [
            {"label": "代码质量", "score": 92, "benchmark": 78, "trend": "up", "description": "AI Review 通过率 95%"},
            {"label": "安全性", "score": 88, "benchmark": 75, "trend": "up", "description": "CodeQL 零高危"},
            {"label": "测试覆盖", "score": 89, "benchmark": 68, "trend": "up", "description": "行覆盖 89%"},
            {"label": "技术债", "score": 85, "benchmark": 72, "trend": "up", "description": "持续下降"},
            {"label": "交付稳定性", "score": 94, "benchmark": 80, "trend": "up", "description": "零回滚"},
        ]
        p.contributor_list = [
            {"name": "林涛", "username": "lintao", "commits": 198, "reviews": 78, "ownership": 68},
            {"name": "张敏", "username": "zhangmin", "commits": 112, "reviews": 34, "ownership": 42},
        ]
        p.debt_trend = [{"month": "2月", "debt": 22, "complexity": 60}, {"month": "3月", "debt": 20, "complexity": 58}, {"month": "4月", "debt": 19, "complexity": 56}, {"month": "5月", "debt": 18, "complexity": 55}, {"month": "6月", "debt": 18, "complexity": 54}, {"month": "7月", "debt": 18, "complexity": 53}]
        p.review_summary = {"total": 2, "critical": 0, "open": 1, "newSinceLastScan": 1, "inProgress": 0, "resolved": 1}
        p.analysis_meta = {"branch": "main", "commit": "5d92ab1", "analysisVersion": "2026.07", "scannedAt": "今天 09:12", "coverage": 98, "filesScanned": 1264, "confidence": 0.95}


def seed_config() -> None:
    """初始化 LLM/向量配置（真实 deepseek 配置 + 向量库 mock 状态）"""
    Base.metadata.create_all(engine)
    db = SessionLocal()
    if db.query(models.ModelProvider).count() > 0:
        db.close()
        return
    db.add_all([
        models.ModelProvider(id="mp-deepseek", key="deepseek", name="DeepSeek", api_key="sk-****...****600e4", base_url="https://api.deepseek.com/anthropic", status="connected", models=["deepseek-v4-pro", "deepseek-v4-flash"]),
        models.ModelProvider(id="mp-volcengine", key="volcengine", name="火山方舟", api_key="ark-****", base_url="https://ark.cn-beijing.volces.com/api/v3", status="unconfigured", models=[]),
    ])
    db.add_all([
        models.TaskRoute(id="tr-1", task="项目分析", provider="DeepSeek", model="deepseek-v4-pro", desc="git 采集 + 代码结构化评估 + 健康度评分"),
        models.TaskRoute(id="tr-2", task="AI Review", provider="DeepSeek", model="deepseek-v4-pro", desc="代码风险洞察 + 影响分析 + 修复建议"),
        models.TaskRoute(id="tr-3", task="代码审查", provider="DeepSeek", model="deepseek-v4-pro", desc="PR diff 语义复核 + 5 维评分"),
        models.TaskRoute(id="tr-4", task="文档生成", provider="DeepSeek", model="deepseek-v4-pro", desc="模块文档 + 类 DeepWiki"),
    ])
    db.add_all([
        models.VectorCollection(id="vc-1", name="forest-code", vectors=8432, size="96 MB", dimension=1024),
        models.VectorCollection(id="vc-2", name="calendar-code", vectors=2156, size="28 MB", dimension=1024),
        models.VectorCollection(id="vc-3", name="user-center-code", vectors=18432, size="128 MB", dimension=1024),
    ])
    db.add_all([
        models.EmbeddingModel(id="em-1", name="bge-m3 (本地)", dimension=1024, status="active"),
        models.EmbeddingModel(id="em-2", name="text-embedding-3-large (OpenAI)", dimension=3072, status="inactive"),
    ])
    db.commit()
    db.close()
    print("✓ seed_config 完成")


def seed_skills() -> None:
    """初始化 Skill 管理模块种子数据：2 来源 + 8 规则 + 2 编组（仅当 skills 表为空时调用）"""
    Base.metadata.create_all(engine)
    db = SessionLocal()
    if db.query(models.Skill).count() > 0:
        db.close()
        return
    now = "2026-08-01T00:00:00+00:00"

    # ---- 2 个示例来源 ----
    db.add_all([
        models.SkillSource(
            id="sk-src-java", name="示例-Java编码规范", doc_type="markdown",
            source_lang="java", description="Java 后端服务编码规范示例（安全/事务/SQL/日志）",
            status="extracted", created_at=now, updated_at=now,
            content="""# Java 编码规范（示例）

## 安全
- 禁止在源码中硬编码密钥、口令、Token，必须从配置中心或环境变量读取。
- SQL 必须使用参数化查询（PreparedStatement），禁止字符串拼接。
- 敏感日志（密码、身份证号）必须脱敏输出。

## 事务
- 写操作必须显式提交或回滚，禁止依赖自动提交。
- 事务范围应尽量小，禁止在事务中调用远程接口。

## 复杂度
- 单个方法圈复杂度不超过 10，超过需拆分。

## 日志
- 日志必须包含上下文（traceId、业务主键），禁止裸打印变量。
- 异常日志必须打印完整堆栈，禁止只打印 message。
""",
        ),
        models.SkillSource(
            id="sk-src-fe", name="示例-前端编码规范", doc_type="markdown",
            source_lang="frontend", description="前端工程编码规范示例（调试/样式/接口）",
            status="extracted", created_at=now, updated_at=now,
            content="""# 前端编码规范（示例）

## 调试
- 禁止将 console.log / debugger 提交到主分支。
- 调试代码必须在使用后清理。

## 样式
- 禁止内联样式硬编码颜色与间距，必须使用设计 token。

## 接口
- API 请求必须处理错误态（网络异常/业务错误），禁止静默失败。
- 异步请求需有 loading 与超时处理。
""",
        ),
    ])
    db.commit()

    # ---- 8 条示例 Skill ----
    skills = [
        dict(id="sk-seed-1", source_id="sk-src-java", name="禁止硬编码密钥",
             description="源码中不得出现明文密钥、口令、Token", category="security", severity="critical",
             rule_content="检查代码中是否存在硬编码的密钥、口令、Token 等敏感凭证。此类凭证必须从配置中心或环境变量读取，禁止以明文形式出现在源码、注释或测试用例中。",
             positive_examples=[{"desc": "从环境变量读取", "code": "String apiKey = System.getenv(\"API_KEY\");"}],
             negative_examples=[{"desc": "硬编码密钥", "code": "String apiKey = \"sk-abc123\";"}]),
        dict(id="sk-seed-2", source_id="sk-src-java", name="SQL 禁止字符串拼接",
             description="SQL 必须参数化查询", category="security", severity="high",
             rule_content="检查 SQL 查询是否使用参数化查询（PreparedStatement / 占位符）。禁止通过字符串拼接构造 SQL，以防止 SQL 注入风险。",
             positive_examples=[{"desc": "参数化查询", "code": "PreparedStatement ps = conn.prepareStatement(\"SELECT * FROM user WHERE id = ?\"); ps.setString(1, id);"}],
             negative_examples=[{"desc": "字符串拼接", "code": "String sql = \"SELECT * FROM user WHERE id = \" + id;"}]),
        dict(id="sk-seed-3", source_id="sk-src-java", name="事务必须显式提交/回滚",
             description="写操作禁止依赖自动提交", category="reliability", severity="high",
             rule_content="检查数据库写操作是否在显式事务中，且明确调用 commit 或 rollback。禁止依赖数据库自动提交，异常时必须回滚以保证数据一致性。",
             positive_examples=[{"desc": "显式事务", "code": "try { conn.setAutoCommit(false); ... conn.commit(); } catch { conn.rollback(); }"}],
             negative_examples=[{"desc": "无事务控制", "code": "stmt.executeUpdate(\"UPDATE ...\");"}]),
        dict(id="sk-seed-4", source_id="sk-src-java", name="循环复杂度≤10",
             description="单方法圈复杂度上限", category="complexity", severity="medium",
             rule_content="检查单个方法的圈复杂度（分支、循环、条件嵌套）是否超过 10。超过阈值的方法应拆分为多个职责单一的小方法，以降低维护成本与缺陷概率。",
             positive_examples=[{"desc": "拆分小方法", "code": "void process() { validate(); transform(); persist(); }"}],
             negative_examples=[{"desc": "巨型方法", "code": "void process() { if..else if..else if.. (15 层分支) }"}]),
        dict(id="sk-seed-5", source_id="sk-src-java", name="日志必须包含上下文",
             description="禁止裸打印变量", category="maintainability", severity="medium",
             rule_content="检查日志输出是否包含上下文信息（traceId、业务主键等）。禁止仅打印裸变量，异常日志必须打印完整堆栈，禁止只输出 message。",
             positive_examples=[{"desc": "带上下文", "code": "log.error(\"createOrder failed, orderId={}\", orderId, e);"}],
             negative_examples=[{"desc": "裸打印", "code": "log.info(orderId);"}]),
        dict(id="sk-seed-6", source_id="sk-src-fe", name="禁止 console.log 提交",
             description="调试代码不得入主分支", category="quality", severity="medium",
             rule_content="检查代码中是否残留 console.log / debugger / 调试用的打印语句。此类调试代码禁止提交到主分支，必须在合并前清理。",
             positive_examples=[{"desc": "使用专业日志库", "code": "logger.info('loaded', { module });"}],
             negative_examples=[{"desc": "残留调试代码", "code": "console.log('here', data); debugger;"}]),
        dict(id="sk-seed-7", source_id="sk-src-fe", name="禁止内联样式硬编码",
             description="颜色间距走设计 token", category="maintainability", severity="low",
             rule_content="检查组件是否使用内联样式硬编码颜色、间距、字号等视觉值。此类值必须引用设计 token（CSS 变量 / 主题常量），以保证视觉一致性与可维护性。",
             positive_examples=[{"desc": "使用 token", "code": "<div style={{ color: 'var(--color-primary)' }} />"}],
             negative_examples=[{"desc": "硬编码颜色", "code": "<div style={{ color: '#1890ff' }} />"}]),
        dict(id="sk-seed-8", source_id="sk-src-fe", name="API 请求必须处理错误态",
             description="禁止静默失败", category="reliability", severity="high",
             rule_content="检查 API 请求是否处理了错误态（网络异常、业务错误码）。禁止请求失败时静默吞掉错误，必须向用户给出明确反馈或降级处理。",
             positive_examples=[{"desc": "catch 并提示", "code": "try { await api(); } catch (e) { toast.error('加载失败'); }"}],
             negative_examples=[{"desc": "静默失败", "code": "api().then(setData); // 无 catch"}]),
    ]
    for s in skills:
        db.add(models.Skill(
            id=s["id"], source_id=s["source_id"], name=s["name"], description=s["description"],
            category=s["category"], severity=s["severity"], check_type="llm",
            rule_content=s["rule_content"],
            positive_examples=s["positive_examples"], negative_examples=s["negative_examples"],
            enabled=1, created_at=now, updated_at=now,
        ))
    db.commit()

    # ---- 2 个示例组（开箱即用，enabled=1）----
    db.add_all([
        models.SkillGroup(
            id="skg-seed-java", name="Java 后端规范组",
            description="Java 后端服务默认评估编组（安全/事务/SQL/日志）",
            skill_ids=["sk-seed-1", "sk-seed-2", "sk-seed-3", "sk-seed-5"],
            analysis_type="repo_analysis", enabled=1, created_at=now, updated_at=now,
        ),
        models.SkillGroup(
            id="skg-seed-fe", name="前端规范组",
            description="前端工程默认评估编组（调试/样式/接口）",
            skill_ids=["sk-seed-6", "sk-seed-7", "sk-seed-8"],
            analysis_type="repo_analysis", enabled=1, created_at=now, updated_at=now,
        ),
    ])
    db.commit()
    db.close()
    print("✓ seed_skills 完成")


def seed_env_inventory() -> None:
    """初始化环境配置盘点种子数据：为 p1 用户中心造结构化连接配置示例

    仅当 env_inventory_entries 表为空时调用。造一份 dev/prod 双环境、
    database/redis/nacos 三类工具的示例条目 + 1 条全量扫描记录。
    """
    Base.metadata.create_all(engine)
    db = SessionLocal()
    if db.query(models.EnvInventoryEntry).count() > 0:
        db.close()
        return
    now = "2026-08-01T08:00:00+00:00"
    scan_id = "einv-scan-seed-p1"
    db.add(models.EnvInventoryScan(
        id=scan_id, project_id="p1", scan_type="full", status="completed",
        trigger="auto", started_at="2026-08-01T07:58:00+00:00", finished_at=now,
        files_scanned=4, entries_found=5, added=0, changed=0, removed=0, unchanged=0,
        message="首次全量扫描",
    ))
    db.commit()  # 先提交 scan，满足 entries.scan_id 外键

    from .env_scanner import fingerprint

    entries = [
        # ---- prod 环境 ----
        dict(env="prod", tool_type="database", tool_name="mysql", key="spring.datasource.url",
             value="jdbc:mysql://10.0.1.20:3306/user_center?useSSL=true", is_secret=1,
             host="10.0.1.20", port="3306", username="uc_app", database="user_center",
             source_file="src/main/resources/application-prod.yml", source_line=12, detail={}),
        dict(env="prod", tool_type="redis", tool_name="redis", key="spring.redis.host",
             value="10.0.1.21:6379 · db=0 · password=r***d(len=9)", is_secret=1,
             host="10.0.1.21", port="6379", username="", database="0",
             source_file="src/main/resources/application-prod.yml", source_line=22, detail={}),
        dict(env="prod", tool_type="nacos", tool_name="nacos", key="spring.cloud.nacos.server-addr",
             value="nacos-prod:8848 · user=nacos", is_secret=0,
             host="nacos-prod", port="8848", username="nacos", database="",
             source_file="src/main/resources/application-prod.yml", source_line=31,
             detail={"namespace": "prod", "group": "DEFAULT_GROUP"}),
        # ---- dev 环境 ----
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
            id=f"einv-seed-{i}", project_id="p1", scan_id=scan_id,
            **entry,
            fingerprint=fingerprint(
                entry["tool_name"], entry["env"], entry["host"], entry["port"],
                entry["database"], entry["source_file"],
            ),
            file_mtime=now,
            first_seen_at=now, updated_at=now, status="active",
        ))
    db.commit()
    db.close()
    print("✓ seed_env_inventory 完成")


if __name__ == "__main__":
    seed()
