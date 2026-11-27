"""Ensure alembic_version.version_num fits long revision ids (>32 chars).

Coolify / Postgres default alembic_version.version_num is VARCHAR(32).
Many ERP revisions exceed that and fail with:
  StringDataRightTruncation: value too long for type character varying(32)

Run before `alembic upgrade head`.
"""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from core.config import settings  # noqa: E402

TARGET_LEN = 128


def main() -> None:
    engine = create_engine(str(settings.database_url))
    with engine.begin() as conn:
        exists = conn.execute(
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
            # Create with a wide column so the first Alembic stamp/insert fits.
            conn.execute(
                text(
                    f"""
                    CREATE TABLE alembic_version (
                        version_num VARCHAR({TARGET_LEN}) NOT NULL PRIMARY KEY
                    )
                    """
                )
            )
            print(f"Created alembic_version.version_num VARCHAR({TARGET_LEN})")
            return

        current = conn.execute(
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
        if current is not None and int(current) >= TARGET_LEN:
            print(f"alembic_version.version_num already VARCHAR({current})")
            return

        conn.execute(
            text(
                f"""
                ALTER TABLE alembic_version
                ALTER COLUMN version_num TYPE VARCHAR({TARGET_LEN})
                """
            )
        )
        print(
            f"Widened alembic_version.version_num "
            f"from VARCHAR({current}) to VARCHAR({TARGET_LEN})"
        )


if __name__ == "__main__":
    main()
