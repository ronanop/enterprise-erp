"""HRMS standalone baseline — create kept schemas from ORM metadata.

Revision ID: 0001_hrms_standalone
Revises:
Create Date: 2026-11-19

Fresh empty database only. Do NOT run against a full-ERP database.
See docs/05_ARCHITECTURE_LOCK/HRMS_Standalone_Addendum_v1.3.md.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from database.base import Base

# Ensure metadata is populated for kept modules.
import modules.foundation.models  # noqa: F401
import modules.platform.models  # noqa: F401
import modules.master_data.models  # noqa: F401
import modules.organization.models  # noqa: F401
import modules.hr.models  # noqa: F401
import modules.payroll.models  # noqa: F401
import modules.recruitment.models  # noqa: F401

revision: str = "0001_hrms_standalone"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SCHEMAS = (
    "foundation",
    "organization",
    "master",
    "platform",
    "hr",
    "payroll",
    "recruitment",
    "analytics",  # platform read models
    "audit",
    "config",
)


def upgrade() -> None:
    bind = op.get_bind()
    for schema in _SCHEMAS:
        op.execute(sa.text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
    for schema in reversed(_SCHEMAS):
        op.execute(sa.text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
