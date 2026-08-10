"""Celery 任务：仓库分析 / 开发者评估（供异步队列模式使用）。"""
import os

from .celery_app import celery_app


def _ensure_db_session():
    from .db import SessionLocal
    return SessionLocal()


@celery_app.task(name="devlens.analyze_repository")
def analyze_repository_task(
    project_id: str,
    repo_url: str,
    tenant_id: str,
    name: str,
    branch: str = "",
    access_token_encrypted_b64: str | None = None,
    group_id: str | None = None,
) -> None:
    """与 analyzer.analyze_repository 对齐的 Celery 任务入口。

    access_token 以 base64 字符串传递（Celery broker 需可序列化 bytes）。
    """
    import base64
    from .analyzer import _analyze

    token_bytes = base64.b64decode(access_token_encrypted_b64) if access_token_encrypted_b64 else None
    _analyze(project_id, repo_url, tenant_id, name, branch, token_bytes, group_id)


@celery_app.task(name="devlens.evaluate_developer")
def evaluate_developer_task(evaluation_id: str) -> None:
    from .evaluation import evaluate_developer
    db = _ensure_db_session()
    try:
        evaluate_developer(db, evaluation_id)
    finally:
        db.close()
