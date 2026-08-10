"""平台 API 集成：GitHub / GitLab / Gitee 仓库发现与元数据。

只读调用公开或私有 API 拉取组织/用户仓库列表，供「发现并批量导入」使用。
"""
import httpx

from .security import decrypt_value


def _headers(token: str | None, provider: str, base_url: str | None) -> dict:
    headers = {"Accept": "application/json"}
    if token:
        if provider == "github":
            headers["Authorization"] = f"token {token}"
        else:  # gitlab / gitee / gitea：OAuth2 Bearer
            headers["Authorization"] = f"Bearer {token}"
    return headers


def discover_repos(
    provider: str,
    org: str | None = None,
    user: str | None = None,
    access_token_encrypted: bytes | None = None,
    base_url: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """按 provider 发现仓库。返回 [{name, ssh_url, http_url, default_branch, description}]。"""
    token = decrypt_value(access_token_encrypted)
    headers = _headers(token, provider, base_url)
    base = (base_url or "").rstrip("/")

    if provider == "github":
        url = f"https://api.github.com/users/{org or user}/repos" if org or user else "https://api.github.com/user/repos"
        params = {"per_page": limit, "sort": "updated"}
        resp = httpx.get(url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        repos = resp.json()
        return [
            {
                "name": r.get("full_name") or r.get("name", ""),
                "ssh_url": r.get("ssh_url"),
                "http_url": r.get("clone_url"),
                "default_branch": r.get("default_branch") or "main",
                "description": r.get("description") or "",
                "private": r.get("private", False),
            }
            for r in repos[:limit]
        ]

    if provider in ("gitlab", "gitea"):
        host = base or ("https://gitlab.com" if provider == "gitlab" else "https://try.gitea.io")
        path = "projects" if provider == "gitlab" else "repos/search"
        params = {"per_page": limit}
        if provider == "gitlab":
            if org:
                params["owned"] = "true"
                # 通过 group 搜索
                url = f"{host}/api/v4/groups/{org}/projects"
            elif user:
                url = f"{host}/api/v4/users/{user}/projects"
            else:
                url = f"{host}/api/v4/projects"
            resp = httpx.get(url, headers=headers, params=params, timeout=30)
            resp.raise_for_status()
            repos = resp.json()
            return [
                {
                    "name": r.get("path_with_namespace") or r.get("name", ""),
                    "ssh_url": r.get("ssh_url_to_repo"),
                    "http_url": r.get("http_url_to_repo"),
                    "default_branch": r.get("default_branch") or "main",
                    "description": r.get("description") or "",
                    "private": r.get("visibility") == "private",
                }
                for r in repos[:limit]
            ]
        # gitea
        url = f"{host}/api/v1/repos/search"
        params["q"] = org or user or ""
        resp = httpx.get(url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        repos = (resp.json().get("data") or []) if isinstance(resp.json(), dict) else resp.json()
        return [
            {
                "name": r.get("full_name") or r.get("name", ""),
                "ssh_url": r.get("ssh_url"),
                "http_url": r.get("clone_url"),
                "default_branch": r.get("default_branch") or "main",
                "description": r.get("description") or "",
                "private": r.get("private", False),
            }
            for r in repos[:limit]
        ]

    if provider == "gitee":
        host = base or "https://gitee.com/api/v5"
        if org:
            url = f"{host}/orgs/{org}/repos"
        else:
            url = f"{host}/user/repos"
        params = {"per_page": limit, "access_token": token or ""}
        resp = httpx.get(url, params=params, timeout=30)
        resp.raise_for_status()
        repos = resp.json()
        return [
            {
                "name": r.get("full_name") or r.get("name", ""),
                "ssh_url": r.get("ssh_url"),
                "http_url": r.get("html_url"),
                "default_branch": r.get("default_branch") or "master",
                "description": r.get("description") or "",
                "private": r.get("private", False),
            }
            for r in repos[:limit]
        ]

    raise ValueError(f"暂不支持 provider: {provider}")
