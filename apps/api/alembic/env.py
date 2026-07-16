"""Alembic migration environment."""

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from core.config import settings
from database.base import Base
import modules.foundation.models  # noqa: F401 — register ORM metadata
import modules.finance.models  # noqa: F401 — register ORM metadata
import modules.master_data.models  # noqa: F401 — register ORM metadata
import modules.organization.models  # noqa: F401 — register ORM metadata
import modules.procurement.models  # noqa: F401 — register ORM metadata
import modules.sales.models  # noqa: F401 — register ORM metadata
import modules.inventory.models  # noqa: F401 — register ORM metadata
import modules.manufacturing.models  # noqa: F401 — register ORM metadata
import modules.quality.models  # noqa: F401 — register ORM metadata
import modules.crm.models  # noqa: F401 — register ORM metadata
import modules.hr.models  # noqa: F401 — register ORM metadata
import modules.payroll.models  # noqa: F401 — register ORM metadata
import modules.recruitment.models  # noqa: F401 — register ORM metadata
import modules.project.models  # noqa: F401 — register ORM metadata
import modules.asset.models  # noqa: F401 — register ORM metadata
import modules.service.models  # noqa: F401 — register ORM metadata
import modules.helpdesk.models  # noqa: F401 — register ORM metadata
import modules.document.models  # noqa: F401 — register ORM metadata
import modules.grc.models  # noqa: F401 — register ORM metadata
import modules.analytics.models  # noqa: F401 — register ORM metadata
import modules.integration.models  # noqa: F401 — register ORM metadata
import modules.ecommerce.models  # noqa: F401 — register ORM metadata
import modules.portal.models  # noqa: F401 — register ORM metadata

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


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
