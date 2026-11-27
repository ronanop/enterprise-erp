"""Alembic migration environment."""

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from core.config import settings
from database.base import Base
import modules.foundation.models  # noqa: F401 - register ORM metadata
import modules.platform.models  # noqa: F401 - register ORM metadata
import modules.finance.models  # noqa: F401 - register ORM metadata
import modules.master_data.models  # noqa: F401 - register ORM metadata
import modules.organization.models  # noqa: F401 - register ORM metadata
import modules.procurement.models  # noqa: F401 - register ORM metadata
import modules.inventory.models  # noqa: F401 - register ORM metadata
import modules.manufacturing.models  # noqa: F401 - register ORM metadata
import modules.quality.models  # noqa: F401 - register ORM metadata
import modules.crm.models  # noqa: F401 - register ORM metadata
import modules.hr.models  # noqa: F401 - register ORM metadata
import modules.payroll.models  # noqa: F401 - register ORM metadata
import modules.recruitment.models  # noqa: F401 - register ORM metadata
import modules.project.models  # noqa: F401 - register ORM metadata
import modules.asset.models  # noqa: F401 - register ORM metadata
import modules.service.models  # noqa: F401 - register ORM metadata
import modules.helpdesk.models  # noqa: F401 - register ORM metadata
import modules.document.models  # noqa: F401 - register ORM metadata
import modules.marketing.models  # noqa: F401 - register ORM metadata
import modules.analytics.models  # noqa: F401 - register ORM metadata
import modules.ecommerce.models  # noqa: F401 - register ORM metadata

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    return str(settings.database_url)


def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def _ensure_wide_version_column(connection) -> None:
    """Alembic defaults version_num to VARCHAR(32); many ERP revs are longer."""
    from sqlalchemy import text

    exists = connection.execute(
        text(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'alembic_version'
            """
        )
    ).scalar()
    if not exists:
        return
    current = connection.execute(
        text(
            """
            SELECT character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'alembic_version'
              AND column_name = 'version_num'
            """
        )
    ).scalar()
    if current is not None and int(current) >= 128:
        return
    connection.execute(
        text(
            "ALTER TABLE alembic_version "
            "ALTER COLUMN version_num TYPE VARCHAR(128)"
        )
    )
    connection.commit()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        _ensure_wide_version_column(connection)
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # One transaction per revision so a later failure does not wipe
            # earlier schema work on PostgreSQL.
            transaction_per_migration=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
