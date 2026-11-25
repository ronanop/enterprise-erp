"""Bootstrap store-review Neon schema from ORM metadata + alembic stamp.

Full ``alembic upgrade head`` from revision 0001 is not reliable on an empty
database: early metadata-driven revisions create *current* foundation tables
(including later FKs like ``hrms_user_profile`` → ``master``) before those
schemas/tables exist.

For ESS App Store / Play review staging only:
  1. Drop known app schemas (empty/partial Neon is expected)
  2. Recreate schemas
  3. ``Base.metadata.create_all``
  4. ``alembic stamp head``

Usage (apps/api):
  ESS_STORE_REVIEW_MODE=true python -m scripts.bootstrap_store_review_schema
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

from core.config import settings  # noqa: E402
from database.base import Base  # noqa: E402

# Register the same ORM surface Alembic env.py uses (+ a few modules env omits).
import modules.foundation.models  # noqa: E402, F401
import modules.platform.models  # noqa: E402, F401
import modules.finance.models  # noqa: E402, F401
import modules.master_data.models  # noqa: E402, F401
import modules.organization.models  # noqa: E402, F401
import modules.procurement.models  # noqa: E402, F401
import modules.inventory.models  # noqa: E402, F401
import modules.manufacturing.models  # noqa: E402, F401
import modules.quality.models  # noqa: E402, F401
import modules.crm.models  # noqa: E402, F401
import modules.hr.models  # noqa: E402, F401
import modules.payroll.models  # noqa: E402, F401
import modules.recruitment.models  # noqa: E402, F401
import modules.project.models  # noqa: E402, F401
import modules.asset.models  # noqa: E402, F401
import modules.service.models  # noqa: E402, F401
import modules.helpdesk.models  # noqa: E402, F401
import modules.document.models  # noqa: E402, F401
import modules.marketing.models  # noqa: E402, F401
import modules.analytics.models  # noqa: E402, F401
import modules.ecommerce.models  # noqa: E402, F401

APP_SCHEMAS = (
    "analytics",
    "asset",
    "audit",
    "config",
    "crm",
    "document",
    "ecommerce",
    "finance",
    "foundation",
    "grc",
    "helpdesk",
    "hr",
    "integration",
    "inventory",
    "manufacturing",
    "marketing",
    "master",
    "organization",
    "payroll",
    "portal",
    "procurement",
    "project",
    "quality",
    "recruitment",
    "sales",
    "service",
)


def _require_store_review_mode() -> None:
    flag = (os.environ.get("ESS_STORE_REVIEW_MODE") or "").strip().lower()
    if flag not in {"1", "true", "yes", "on"}:
        raise SystemExit(
            "Refusing to bootstrap: set ESS_STORE_REVIEW_MODE=true "
            "(destructive schema reset for store-review Neon only)."
        )


def _alembic_config() -> Config:
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", str(settings.database_url))
    return cfg


def _already_bootstrapped(engine) -> bool:
    with engine.connect() as conn:
        tenant = conn.execute(
            text(
                "SELECT to_regclass('foundation.sec_tenant') IS NOT NULL "
                "AND to_regclass('hr.hr_ess_story') IS NOT NULL"
            )
        ).scalar()
        if not tenant:
            return False
        has_version = conn.execute(
            text("SELECT to_regclass('public.alembic_version') IS NOT NULL")
        ).scalar()
        if not has_version:
            return False
        row = conn.execute(text("SELECT version_num FROM alembic_version")).fetchone()
        return bool(row and row[0])


def main() -> None:
    _require_store_review_mode()
    url = str(settings.database_url)
    engine = create_engine(url, pool_pre_ping=True)

    if _already_bootstrapped(engine) and os.environ.get("FORCE_STORE_REVIEW_SCHEMA") != "true":
        print("Store-review schema already present — skipping bootstrap.")
        return

    print("Bootstrapping store-review schema (drop → create_all → stamp head)…")
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS public.alembic_version"))
        for schema in APP_SCHEMAS:
            conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
        for schema in APP_SCHEMAS:
            conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))

    Base.metadata.create_all(bind=engine)
    command.stamp(_alembic_config(), "head")
    print("Store-review schema bootstrap complete.")


if __name__ == "__main__":
    main()
