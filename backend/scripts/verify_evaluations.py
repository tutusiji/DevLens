"""不启动 HTTP 服务的开发者能力实测评估静态验证脚本。

运行：
    cd backend && .venv/bin/python scripts/verify_evaluations.py
"""
from pathlib import Path
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import models  # noqa: E402
from app.db import Base  # noqa: E402
from app.evaluation import _judge_level, build_evaluation_prompt  # noqa: E402
from app.git_collect import collect_author_code  # noqa: E402
from app.main import app  # noqa: E402
from app.routers.evaluations import read_git_authors  # noqa: E402


def verify_schema_and_routes() -> None:
    expected_columns = {
        "id", "developer_id", "role_key", "skill_group_id", "repo_path", "git_author",
        "scores", "evidence", "achieved_level", "best_level", "gaps", "summary",
        "status", "error", "created_at", "updated_at",
    }
    columns = set(models.DeveloperEvaluation.__table__.columns.keys())
    assert expected_columns.issubset(columns), columns

    paths = app.openapi()["paths"]
    expected_paths = {
        "/api/v1/developers/{did}/evaluations",
        "/api/v1/developers/{did}/evaluations/latest",
        "/api/v1/developers/{did}/evaluations/{eid}",
        "/api/v1/git-authors",
    }
    assert expected_paths.issubset(paths), paths.keys()
    assert {"get", "post"} == set(paths["/api/v1/developers/{did}/evaluations"])


def verify_judge_and_prompt() -> None:
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, future=True)()
    try:
        dimensions = [
            "code_quality", "architecture", "stability", "efficiency",
            "collaboration", "security_aware", "test_coverage", "growth_velocity",
        ]
        session.add(models.CapabilityRole(
            id="cr-verify-backend",
            key="backend",
            name="后端工程师",
            dimensions=dimensions,
        ))
        session.commit()

        achieved, best, gaps = _judge_level(
            {dimension: 100 for dimension in dimensions},
            "backend",
            session,
        )
        assert (achieved, best, gaps) == ("D3", "D3", [])

        prompt = build_evaluation_prompt(
            role_name="后端工程师",
            dimensions=dimensions,
            group=None,
            git_author="验证作者",
            commits=1,
            samples=[{"path": "src/example.py", "content": "def hello(): return 'ok'"}],
        )
        assert "输出严格 JSON" in prompt
        assert "验证作者" in prompt
        assert "code_quality" in prompt
    finally:
        session.close()
        engine.dispose()


def verify_git_helpers() -> None:
    author_result = read_git_authors(str(PROJECT_DIR))
    assert author_result, "当前项目 git log 未返回作者"
    sample = collect_author_code(str(PROJECT_DIR), author_result[0], max_files=2, max_bytes=120)
    assert sample["author"] == author_result[0]
    assert sample["commits"] > 0
    assert len(sample["files"]) <= 2


if __name__ == "__main__":
    verify_schema_and_routes()
    verify_judge_and_prompt()
    verify_git_helpers()
    print("开发者能力实测评估后端验证通过：模型、路由、判定、prompt、git 采样均正常。")
