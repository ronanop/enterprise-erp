"""Ensure ast_asset_disposal has columns required by the ORM + simplified dispose UI.

Safe to re-run (IF NOT EXISTS). Use when alembic history cannot upgrade cleanly.
"""
from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import create_engine, text


DDL = [
    "ALTER TABLE asset.ast_asset_disposal ADD COLUMN IF NOT EXISTS remarks TEXT",
    "ALTER TABLE asset.ast_asset_disposal ADD COLUMN IF NOT EXISTS management_approved BOOLEAN",
    "ALTER TABLE asset.ast_asset_disposal ADD COLUMN IF NOT EXISTS ceo_instruction TEXT",
    "ALTER TABLE asset.ast_asset_disposal ADD COLUMN IF NOT EXISTS rejection_reason TEXT",
    "ALTER TABLE asset.ast_asset_disposal ADD COLUMN IF NOT EXISTS previous_operational_status VARCHAR(40)",
    "ALTER TABLE asset.ast_asset_disposal ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ",
    "ALTER TABLE asset.ast_asset_disposal ADD COLUMN IF NOT EXISTS approved_by UUID",
    "ALTER TABLE asset.ast_asset_disposal ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ",
    "ALTER TABLE asset.ast_asset_disposal ADD COLUMN IF NOT EXISTS completed_by UUID",
]

BACKFILL_OPS = """
UPDATE asset.ast_asset
SET operational_status = 'READY_TO_MOVE',
    updated_at = NOW()
WHERE is_deleted IS FALSE
  AND operational_status IN ('RETIRED', 'PENDING_DISPOSAL')
  AND LOWER(COALESCE(status, '')) NOT IN ('disposed', 'written_off', 'cancelled')
"""


def main() -> None:
    root = Path(__file__).resolve().parents[3]
    env_path = root / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))

    url = os.environ.get("DATABASE_URL") or os.environ.get("SQLALCHEMY_DATABASE_URI")
    if not url:
        raise SystemExit("DATABASE_URL not set")

    engine = create_engine(url)
    with engine.begin() as conn:
        for stmt in DDL:
            conn.execute(text(stmt))
        conn.execute(text(BACKFILL_OPS))
    print("ast_asset_disposal columns ensured")


if __name__ == "__main__":
    main()
