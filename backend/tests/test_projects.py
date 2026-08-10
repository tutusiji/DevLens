"""项目创建 / 加密存储 / 重新分析 / 删除 冒烟测试。

通过 Mock ``analyze_repository`` 避免真实 clone / LLM 调用。
"""
import pytest

from app import models
from app.security import decrypt_value, encrypt_value


@pytest.fixture()
def mock_analyzer(monkeypatch):
    """替换 analyze_repository 为记录调用参数的桩。"""
    calls = []

    def fake(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr("app.routers.projects.analyze_repository", fake)
    return calls


def test_project_create_rejects_local_path(owner_client):
    """后端已不再接受 repo_path，POST 缺少 repo_url 应 400。"""
    res = owner_client.post("/api/v1/projects", json={
        "name": "NoPath",
        "repo_url": "",
        "branch": "main",
        "team_id": "team-1",
    })
    assert res.status_code == 400, res.text


def test_project_create_remote(owner_client, db_session, mock_analyzer):
    res = owner_client.post("/api/v1/projects", json={
        "name": "RemoteRepo",
        "repo_url": "https://github.com/acme/remote-repo.git",
        "provider": "github",
        "branch": "main",
        "team_id": "team-1",
        "access_token": "ghp_test_secret",
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "queued"
    assert body["sourceType"] == "remote"

    # 触发 analyze_repository 且携带 tenant 与加密 token
    assert mock_analyzer, "analyze_repository 应被调用"
    call = mock_analyzer[-1]
    assert call["repo_url"] == "https://github.com/acme/remote-repo.git"
    assert call["branch"] == "main"
    assert call["access_token_encrypted"] is not None

    # 数据库中的 token 是密文，且可解密还原
    repo = db_session.query(models.Repository).filter_by(project_id=body["projectId"]).first()
    assert repo is not None
    assert repo.source_type == "remote"
    assert decrypt_value(repo.access_token_encrypted) == "ghp_test_secret"


def test_project_delete(owner_client, db_session, mock_analyzer):
    create = owner_client.post("/api/v1/projects", json={
        "name": "ToDelete",
        "repo_url": "https://github.com/acme/to-delete.git",
        "branch": "main",
        "team_id": "team-1",
    })
    project_id = create.json()["projectId"]

    res = owner_client.delete(f"/api/v1/projects/{project_id}")
    assert res.status_code == 200, res.text
    assert db_session.query(models.Project).filter_by(id=project_id).first() is None


def test_reanalyze_uses_stored_token(owner_client, db_session, mock_analyzer):
    create = owner_client.post("/api/v1/projects", json={
        "name": "ReanalyzeMe",
        "repo_url": "https://github.com/acme/reanalyze.git",
        "branch": "develop",
        "team_id": "team-1",
        "access_token": "glpat_private",
    })
    project_id = create.json()["projectId"]

    res = owner_client.post(f"/api/v1/projects/{project_id}/reanalyze")
    assert res.status_code == 200, res.text
    call = mock_analyzer[-1]
    assert call["project_id"] == project_id
    assert call["branch"] == "develop"
    assert decrypt_value(call["access_token_encrypted"]) == "glpat_private"


def test_encrypt_roundtrip():
    value = "sensitive-token-123"
    encrypted = encrypt_value(value)
    assert encrypted != value
    assert decrypt_value(encrypted) == value
    assert encrypt_value(None) is None
