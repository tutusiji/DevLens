"""DevLens 后端配置：数据库 + LLM（读取本机环境变量）"""
import os
from dataclasses import dataclass


@dataclass
class Settings:
    # PostgreSQL（本机已建 devlens 库；走 Unix socket peer auth，与 psql 一致）
    database_url: str = os.getenv(
        "DATABASE_URL", "postgresql+psycopg2:///devlens"
    )
    # DeepSeek（Anthropic 兼容端点，复用本机 COPILOT_PROVIDER_* 配置）
    llm_base_url: str = os.getenv(
        "COPILOT_PROVIDER_BASE_URL", "https://api.deepseek.com/anthropic"
    )
    llm_api_key: str = os.getenv("COPILOT_PROVIDER_API_KEY", "")
    llm_model: str = os.getenv("COPILOT_MODEL", "deepseek-v4-pro")
    # git clone 缓存目录
    repos_cache: str = os.getenv("DEVLENS_REPOS_CACHE", "/tmp/devlens-repos")
    # 认证：JWT 密钥（生产必须用强随机值固定）、有效期、bootstrap 管理员
    jwt_secret: str = os.getenv("DEVLENS_JWT_SECRET", "devlens-dev-secret-change-me")
    jwt_expire_hours: int = int(os.getenv("DEVLENS_JWT_EXPIRE_HOURS", "168"))
    admin_email: str = os.getenv("DEVLENS_ADMIN_EMAIL", "local-admin@devlens.local")
    admin_password: str = os.getenv("DEVLENS_ADMIN_PASSWORD", "DevLens@2026")


settings = Settings()
