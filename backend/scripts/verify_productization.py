"""可售化能力静态验证：租户模型、项目快照/对比、报告 HTML 与 API 路由。

运行：
    cd backend && .venv/bin/python scripts/verify_productization.py
"""
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import models  # noqa: E402
from app.access import TenantContext  # noqa: E402
from app.architecture import build_project_code_graph, derive_architecture_design  # noqa: E402
from app.db import Base  # noqa: E402
from app.git_collect import _parse_imports  # noqa: E402
from app.main import app  # noqa: E402
from app.routers.portfolio import comparison_data  # noqa: E402
from app.routers.reports import render_project_comparison_html  # noqa: E402


def verify_models_and_comparison() -> None:
    engine = create_engine("sqlite:///:memory:", future=True)
    session = sessionmaker(bind=engine, future=True)()
    Base.metadata.create_all(engine)
    try:
        session.add(models.Tenant(
            id="tenant-a", name="Tenant A", slug="tenant-a",
            status="active", created_at="2026-08-02T00:00:00Z", updated_at="2026-08-02T00:00:00Z",
        ))
        session.add_all([
            models.Project(
                id="p-a", tenant_id="tenant-a", name="项目 A", language="Python",
                score=82, quality=84, security=80, debt=25, contributors=3, commits=120,
                last_analyzed="刚刚",
                debt_trend=[{"month": "6月", "debt": 30}, {"month": "7月", "debt": 25}],
            ),
            # 不同租户的项目绝不能出现在 Tenant A 的组合中。
            models.Project(
                id="p-b", tenant_id="tenant-b", name="项目 B", language="Go",
                score=99, quality=99, security=99, debt=1, contributors=1, commits=1,
            ),
        ])
        session.commit()

        items = comparison_data(session, "tenant-a")
        assert len(items) == 1 and items[0]["project_id"] == "p-a", items
        snapshots = session.query(models.ProjectAssessmentSnapshot).filter_by(
            tenant_id="tenant-a", project_id="p-a",
        ).all()
        assert len(snapshots) == 2, snapshots
        assert "项目 A" in render_project_comparison_html("验证报告", items)
    finally:
        session.close()
        engine.dispose()


def verify_rbac_and_routes() -> None:
    assert TenantContext("tenant-a", "u-owner", "owner").allows("tenant:manage")
    assert TenantContext("tenant-a", "u-viewer", "viewer").allows("project:read")
    assert not TenantContext("tenant-a", "u-viewer", "viewer").allows("report:export")

    paths = app.openapi()["paths"]
    expected = {
        "/api/v1/projects/{pid}/graph",
        "/api/v1/projects/{pid}/architecture-design",
        "/api/v1/architecture-designs",
        "/api/v1/graph",
        "/api/v1/project-comparisons",
        "/api/v1/projects/{pid}/trend",
        "/api/v1/reports/project-comparison",
        "/api/v1/developers/{did}/evaluations/{eid}/report",
        "/api/v1/auth/me",
        "/api/v1/tenants/current/members",
        "/api/v1/tenants",
    }
    assert expected.issubset(paths), expected - set(paths)
    assert app.openapi()["paths"]["/api/v1/graph"]["get"]["deprecated"] is True


def verify_project_graph_and_architecture_design() -> None:
    """确保项目图谱拒绝外部包/语法碎片，架构方案保持项目级且可解释。"""
    project = models.Project(
        id="architecture-a",
        tenant_id="tenant-a",
        name="架构验证项目",
        language="TypeScript",
        analysis_meta={"branch": "main", "commit": "abc123", "scannedAt": "2026-08-02T00:00:00Z"},
        assets={
            "frameworks": [{"name": "next"}],
            "dependencies": [{"manager": "npm", "count": 6}],
            "configs": [],
            "deployments": [{"name": "deploy", "type": "docker"}],
        },
        graph_edges=[
            {"source": "frontend/app/page.tsx", "target": "frontend/services/user.ts"},
            {"source": "frontend/app/page.tsx", "target": "axios,"},
            {"source": "frontend/app/page.tsx", "target": "{"},
            {"source": "React,", "target": "frontend/services/user.ts"},
        ],
    )
    project.module_risks = [
        models.ModuleRisk(
            id="module-a", project_id=project.id, name="页面入口",
            path="frontend/app/page.tsx", score=20, severity="high", issue_count=2,
        ),
        models.ModuleRisk(
            id="module-b", project_id=project.id, name="部署编排",
            path="deploy", score=5, severity="low", issue_count=0,
        ),
    ]

    graph = build_project_code_graph(project)
    node_ids = {node["id"] for node in graph["nodes"]}
    assert "frontend/app/page.tsx" in node_ids
    assert "frontend/services/user.ts" in node_ids
    assert "deploy" in node_ids
    assert not node_ids.intersection({"axios,", "{", "React,"}), node_ids
    assert graph["edges"] == [{"source": "frontend/app/page.tsx", "target": "frontend/services/user.ts"}]

    design = derive_architecture_design(project)
    assert design["extraction_version"] == 2
    assert design["analysis_status"] == "ready"
    assert any(layer["key"] == "infra" for layer in design["layers"]), design["layers"]
    assert all(component["id"] in node_ids for component in design["components"])
    assert design["branch"] == "main" and design["commit"] == "abc123"

    pending = derive_architecture_design(models.Project(
        id="architecture-pending", tenant_id="tenant-a", name="待分析项目", language="Go",
    ))
    assert pending["analysis_status"] == "pending", pending


def verify_internal_import_parser() -> None:
    """内部 import 应映射到项目相对文件路径，外部包不应进入 graph_edges。"""
    with TemporaryDirectory() as temp_dir:
        repo = Path(temp_dir)
        (repo / "src").mkdir()
        (repo / "src" / "page.tsx").write_text(
            "import { getUser } from './services/user';\nimport axios from 'axios';\n",
            encoding="utf-8",
        )
        (repo / "src" / "services").mkdir()
        (repo / "src" / "services" / "user.ts").write_text("export const getUser = () => null;\n", encoding="utf-8")
        (repo / "app").mkdir()
        (repo / "app" / "__init__.py").write_text("", encoding="utf-8")
        (repo / "app" / "views.py").write_text("from .services import user\nimport requests\n", encoding="utf-8")
        (repo / "app" / "services.py").write_text("user = object()\n", encoding="utf-8")

        edges = _parse_imports(str(repo), [
            "src/page.tsx", "src/services/user.ts",
            "app/__init__.py", "app/views.py", "app/services.py",
        ])
        edge_set = {(edge["source"], edge["target"]) for edge in edges}
        assert ("src/page.tsx", "src/services/user.ts") in edge_set, edge_set
        assert ("app/views.py", "app/services.py") in edge_set, edge_set
        assert not any("axios" in edge or "requests" in edge for pair in edge_set for edge in pair), edge_set


if __name__ == "__main__":
    verify_models_and_comparison()
    verify_rbac_and_routes()
    verify_project_graph_and_architecture_design()
    verify_internal_import_parser()
    print("可售化验证通过：租户隔离、RBAC、项目组合快照、报告、项目代码图谱与架构设计方案均正常。")
