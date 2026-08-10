"""baseline：应用启动路径（create_all + ensure_migrate）已负责建表与存量补列。

本 revision 将当前 schema 状态标记为 Alembic 管理的 head，upgrade 为 no-op。
后续 schema 变更一律通过 ``alembic revision`` 生成新 revision 管理；
全新部署可在 init 后执行 ``alembic upgrade head``（此处无操作），
或继续依赖启动时的 create_all/ensure_migrate 自举。

Revision ID: 0001
Revises:
Create Date: 2026-08-11
"""
from alembic import op
import sqlalchemy as sa  # noqa: F401

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 表结构由 Base.metadata.create_all / ensure_migrate 在启动时维护。
    # 此处仅确保 alembic_version 表记录 head 版本，不重复建表。
    pass


def downgrade() -> None:
    pass
