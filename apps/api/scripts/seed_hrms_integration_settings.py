"""Seed remote HRMS employee API settings for /organization/users/hrms-api.

Default target: http://172.16.110.15:3000. Pass the key via HRMS_API_KEY.

Usage (from apps/api):
  $env:HRMS_API_KEY = "<key>"
  python -m scripts.seed_hrms_integration_settings
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import SecTenant  # noqa: E402
from modules.foundation.service.hrms_integration_settings_service import (  # noqa: E402
    HrmsIntegrationSettingsService,
)

DEFAULT_BASE_URL = "http://172.16.110.15:3000"
DEFAULT_PATH = "/api/v1/hr/integration/employees"


def main() -> None:
    api_key = (os.environ.get("HRMS_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("Set HRMS_API_KEY in the environment before seeding.")
    db = SessionLocal()
    try:
        tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
        if tenant is None:
            raise RuntimeError("BOOTSTRAP tenant missing. Seed demo data / admin login first.")
        view = HrmsIntegrationSettingsService(db).save(
            tenant_id=tenant.id,
            actor_id=None,
            base_url=DEFAULT_BASE_URL,
            employees_path=DEFAULT_PATH,
            page_size=100,
            api_key=api_key,
        )
        db.commit()
        print("HRMS integration settings saved")
        print(f"  base_url       : {view.base_url}")
        print(f"  employees_path : {view.employees_path}")
        print(f"  page_size      : {view.page_size}")
        print(f"  api_key        : {view.api_key_masked}")
        print("Open: http://localhost:3000/organization/users/hrms-api")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
