"""认证与 RBAC 冒烟测试。"""
from .conftest import register_user


def test_register_creates_owner_and_token(client):
    res = client.post("/api/v1/auth/register", json={
        "username": "alice",
        "name": "Alice",
        "email": "alice@example.com",
        "password": "DevLens@2026",
    })
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["token"]
    assert data["role"] == "owner"
    assert data["tenant"]["id"].startswith("tenant-")


def test_register_duplicate_email(client):
    res1 = client.post("/api/v1/auth/register", json={
        "username": "dup01",
        "name": "Dup",
        "email": "dup01@example.com",
        "password": "DevLens@2026",
    })
    assert res1.status_code == 201
    res2 = client.post("/api/v1/auth/register", json={
        "username": "dup02",
        "name": "Dup2",
        "email": "dup01@example.com",
        "password": "DevLens@2026",
    })
    assert res2.status_code == 409


def test_login_wrong_password(client):
    register_user(client)
    res = client.post("/api/v1/auth/login", json={
        "email": "someone-else@example.com",
        "password": "wrong-password",
    })
    assert res.status_code == 401


def test_me_requires_auth(client):
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401


def test_me_with_token(owner_client):
    res = owner_client.get("/api/v1/auth/me")
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["email"]


def test_viewer_cannot_write(owner_client):
    """RBAC：viewer 在目标租户内执行写操作应 403。"""
    me = owner_client.get("/api/v1/auth/me").json()
    owner_tenant_id = me["tenant"]["id"]

    # 注册第二个用户（自带自己的租户）
    member = register_user(owner_client, "member01")

    # owner 邀请 member 进入 owner 租户，角色为 viewer
    res = owner_client.post(
        "/api/v1/tenants/current/members",
        json={"email": member["user"]["email"], "name": "Member", "role": "viewer"},
    )
    assert res.status_code == 201, res.text

    # member 携带自己的 JWT，但通过 X-DevLens-Tenant-Id 声明访问 owner 租户
    res = owner_client.post(
        "/api/v1/projects",
        headers={
            "Authorization": f"Bearer {member['token']}",
            "X-DevLens-Tenant-Id": owner_tenant_id,
        },
        json={
            "name": "RbacTest",
            "repo_url": "https://github.com/acme/rbac-test.git",
            "branch": "main",
            "team_id": "team-rbac",
        },
    )
    assert res.status_code == 403, res.text
