"""Celery 异步任务骨架（可选后台队列）。

当前默认分析路径仍为进程内 daemon thread（见 analyzer.analyze_repository），
Celery 用于需要持久任务队列/横向扩容的部署。启用方式：

1. 安装依赖：uv add celery redis
2. 配置 REDIS_URL 环境变量
3. 启动 worker：uv run celery -A app.celery_app worker --loglevel=info
4. 在分析入口处将 daemon thread 替换为 apply_async
"""
import os

from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")

celery_app = Celery(
    "devlens",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    broker_connection_retry_on_startup=True,
)
