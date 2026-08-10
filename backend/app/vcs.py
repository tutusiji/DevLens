"""版本控制仓库克隆与凭证注入工具。

所有项目均从远程 Git URL 拉取，不支持本地路径作为分析来源。
缓存目录按 tenant_id/project_id 隔离，避免同名覆盖与跨租户泄漏。
"""
import os
import shutil
import subprocess
from urllib.parse import urlparse

from .config import settings
from .security import decrypt_value

# clone 超时默认 10 分钟，大仓库可通过环境变量调整
CLONE_TIMEOUT = int(os.getenv("DEVLENS_CLONE_TIMEOUT", "600"))


def _is_ssh_url(url: str) -> bool:
    """判断是否为 SSH 格式 git 地址。"""
    return url.startswith("git@") or url.startswith("ssh://")


def _inject_token_into_url(url: str, token: str | None) -> str:
    """将 access token 注入 HTTPS URL，返回可用于 clone 的 URL。

    SSH 格式不注入 token，依赖宿主机的 SSH key；若调用方传了 token 但 URL 是 SSH，
    后续会通过错误提示用户改用 HTTPS 或配置 SSH key。
    """
    if not token or _is_ssh_url(url):
        return url
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return url
    netloc = f"{token}@{parsed.hostname}"
    if parsed.port:
        netloc = f"{netloc}:{parsed.port}"
    return parsed._replace(netloc=netloc).geturl()


def ensure_remote_repo(
    repo_url: str,
    project_id: str,
    tenant_id: str,
    branch: str,
    access_token_encrypted: bytes | None = None,
) -> str:
    """确保远程仓库已 clone 到本地缓存目录，并按需检出指定分支。

    返回本地缓存路径（含 .git）。
    """
    if not repo_url:
        raise ValueError("仓库地址不能为空")
    if os.path.isdir(repo_url) and os.path.isdir(os.path.join(repo_url, ".git")):
        raise ValueError("本地路径已不再作为分析来源，请使用远程 Git 地址")

    cache_root = settings.repos_cache
    local = os.path.join(cache_root, tenant_id, project_id)

    # 清空旧缓存，保证分析基线干净
    shutil.rmtree(local, ignore_errors=True)
    os.makedirs(os.path.dirname(local), exist_ok=True)

    token = decrypt_value(access_token_encrypted)
    clone_url = _inject_token_into_url(repo_url, token)
    clone_branch = (branch or "main").strip()

    env = os.environ.copy()
    # 避免 git 交互式询问凭证
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["GIT_ASKPASS"] = ""

    try:
        subprocess.run(
            [
                "git", "clone", "--quiet",
                "--branch", clone_branch,
                "--single-branch",
                clone_url, local,
            ],
            check=True,
            timeout=CLONE_TIMEOUT,
            env=env,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        err = (e.stderr or "").lower()
        if "authentication" in err or "401" in err or "403" in err:
            raise RuntimeError(
                f"仓库鉴权失败，请检查 access token 是否有拉取权限：{repo_url}"
            ) from e
        if "could not resolve host" in err:
            raise RuntimeError(f"无法解析仓库地址，请检查网络或 URL：{repo_url}") from e
        if _is_ssh_url(repo_url) and ("permission denied" in err or "git@" in err):
            raise RuntimeError(
                f"SSH 仓库拉取失败，请确保本机已配置对应私钥，或改用 HTTPS + access token：{repo_url}"
            ) from e
        raise RuntimeError(f"仓库克隆失败：{(e.stderr or e.stdout or str(e))[:200]}") from e
    except subprocess.TimeoutExpired as e:
        raise RuntimeError(f"仓库克隆超时（{CLONE_TIMEOUT}s），请检查仓库大小或网络：{repo_url}") from e

    return local
