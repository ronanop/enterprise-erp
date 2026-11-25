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

from sqlalchemy import create_engine, text  # noqa: E402

from core.config import settings  # noqa: E402

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


def _already_bootstrapped(engine) -> bool:
    """Cheap check — no ORM imports — so restart does not re-OOM on 512Mi."""
    with engine.connect() as conn:
        ready = conn.execute(
            text(
                """
                SELECT
                  to_regclass('foundation.sec_tenant') IS NOT NULL
                  AND to_regclass('hr.hr_ess_story') IS NOT NULL
                  AND to_regclass('public.alembic_version') IS NOT NULL
                """
            )
        ).scalar()
        if not ready:
            return False
        row = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).fetchone()
        return bool(row and row[0])


def _import_models() -> None:
    # Deferred until we know create_all is required (heavy on memory).
    import modules.foundation.models  # noqa: F401
    import modules.platform.models  # noqa: F401
    import modules.finance.models  # noqa: F401
    import modules.master_data.models  # noqa: F401
    import modules.organization.models  # noqa: F401
    import modules.procurement.models  # noqa: F401
    import modules.inventory.models  # noqa: F401
    import modules.manufacturing.models  # noqa: F401
    import modules.quality.models  # noqa: F401
    import modules.crm.models  # noqa: F401
    import modules.hr.models  # noqa: F401
    import modules.payroll.models  # noqa: F401
    import modules.recruitment.models  # noqa: F401
    import modules.project.models  # noqa: F401
    import modules.asset.models  # noqa: F401
    import modules.service.models  # noqa: F401
    import modules.helpdesk.models  # noqa: F401
    import modules.document.models  # noqa: F401
    import modules.marketing.models  # noqa: F401
    import modules.analytics.models  # noqa: F401
    import modules.ecommerce.models  # noqa: F401


def main() -> None:
    _require_store_review_mode()
    url = str(settings.database_url)
    engine = create_engine(url, pool_pre_ping=True)

    force = os.environ.get("FORCE_STORE_REVIEW_SCHEMA", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    if _already_bootstrapped(engine) and not force:
        print("Store-review schema already present — skipping bootstrap.", flush=True)
        return

    print("Bootstrapping store-review schema (drop → create_all → stamp head)…", flush=True)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS public.alembic_version"))
        for schema in APP_SCHEMAS:
            conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
        for schema in APP_SCHEMAS:
            conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))

    _import_models()
    from alembic import command
    from alembic.config import Config
    from database.base import Base

    Base.metadata.create_all(bind=engine)

    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.stamp(cfg, "head")
    print("Store-review schema bootstrap complete.", flush=True)


if __name__ == "__main__":
    main()
