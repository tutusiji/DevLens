"""pytest fixtures：独立测试数据库 + FastAPI TestClient。

测试使用临时文件 SQLite（内存库对 SQLAlchemy 连接池是每个连接一个库，
会与 app engine 分离），避免污染本地 PostgreSQL。
"""
import os
import tempfile
import uuid

_TMP_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_TMP_DB.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DB.name}"
os.environ["DEVLENS_ALLOW_LOCAL_ADMIN"] = "false"
os.environ["DEVLENS_JWT_SECRET"] = "test-secret-for-pytest"

import pytest
from fastapi.testclient import TestClient

from app.db import Base, SessionLocal, get_db
import app.main as main_module
from app.main import app as fastapi_app

# SQLite 无 split_part 等 PG 函数；迁移与 org-tree 回填属于启动流程，冒烟测试
# 直接 mock 掉，业务逻辑不在其覆盖范围。
main_module.ensure_migrate = lambda: None
main_module._ensure_org_tree = lambda: None


@pytest.fixture()
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def client(db_session):
    def _override():
        yield db_session

    fastapi_app.dependency_overrides[get_db] = _override
    with TestClient(fastapi_app) as c:
        yield c
    fastapi_app.dependency_overrides.clear()


def register_user(client: TestClient, username: str | None = None) -> dict:
    """注册一个 owner 用户并返回登录态 JSON。"""
    uname = username or f"tester{uuid.uuid4().hex[:6]}"
    payload = {
        "username": uname,
        "name": "测试用户",
        "email": f"{uname}@example.com",
        "password": "DevLens@2026",
    }
    return client.post("/api/v1/auth/register", json=payload).json()


@pytest.fixture()
def owner_client(client: TestClient):
    """已注册 owner 的客户端（含 Authorization 头）。"""
    login = register_user(client)
    client.headers.update({"Authorization": f"Bearer {login['token']}"})
    return client
