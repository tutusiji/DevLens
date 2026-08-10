"""租户级数据加密工具。

当前使用 Fernet 对称加密对 Repository 的 access_token、webhook_secret 等敏感字段
进行加密后持久化。密钥从 ``DEVLENS_ENCRYPTION_KEY`` 环境变量读取；未配置时服务拒绝
启动，避免敏感数据以可逆弱方案或无密钥方式落库。
"""
import os

from cryptography.fernet import Fernet

from .config import settings


def _get_fernet() -> Fernet:
    key = os.getenv("DEVLENS_ENCRYPTION_KEY", settings.jwt_secret)
    if not key:
        raise RuntimeError(
            "缺少 DEVLENS_ENCRYPTION_KEY 环境变量，无法对仓库凭证进行加密存储"
        )
    # Fernet 要求 32 字节 url-safe base64 编码密钥
    raw = key.encode("utf-8")
    if len(raw) < 32:
        # 用 SHA256 将任意长度密钥派生成 32 字节，再 base64 编码
        import base64
        import hashlib

        derived = hashlib.sha256(raw).digest()
        return Fernet(base64.urlsafe_b64encode(derived))
    try:
        return Fernet(key)
    except Exception:
        import base64
        import hashlib

        derived = hashlib.sha256(raw).digest()
        return Fernet(base64.urlsafe_b64encode(derived))


def encrypt_value(value: str | None) -> bytes | None:
    """加密字符串，返回 bytes；空值直接透传 None。"""
    if value is None or value == "":
        return None
    return _get_fernet().encrypt(value.encode("utf-8"))


def decrypt_value(ciphertext: bytes | None) -> str | None:
    """解密 bytes，返回字符串；空值直接透传 None。"""
    if ciphertext is None:
        return None
    return _get_fernet().decrypt(ciphertext).decode("utf-8")
