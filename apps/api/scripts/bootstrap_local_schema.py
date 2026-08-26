"""One-shot local bootstrap: create missing tables from ORM, stamp alembic heads."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from alembic.config import Config
from alembic import command
from sqlalchemy import create_engine, text

from core.config import settings
from database.base import Base

import modules.foundation.models  # noqa: F401
import modules.finance.models  # noqa: F401
import modules.master_data.models  # noqa: F401
import modules.organization.models  # noqa: F401
import modules.procurement.models  # noqa: F401
import modules.sales.models  # noqa: F401
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
import modules.grc.models  # noqa: F401
import modules.analytics.models  # noqa: F401
import modules.integration.models  # noqa: F401
import modules.ecommerce.models  # noqa: F401
import modules.portal.models  # noqa: F401


def main() -> None:
    engine = create_engine(str(settings.database_url))
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE IF EXISTS alembic_version ALTER COLUMN version_num TYPE VARCHAR(128)"))
    Base.metadata.create_all(bind=engine)
    print("ORM create_all complete")

    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", str(settings.database_url))
    command.stamp(cfg, "heads")
    print("alembic stamp heads complete")


if __name__ == "__main__":
    main()
