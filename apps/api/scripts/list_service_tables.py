"""List Service Management tables in PostgreSQL (pgAdmin view)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from sqlalchemy import create_engine, text

from core.config import settings


def main() -> None:
    engine = create_engine(settings.database_url)
    with engine.connect() as conn:
        tables = conn.execute(
            text(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'service'
                  AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """
            )
        ).fetchall()
        print(f"PostgreSQL schema: service ({len(tables)} tables)")
        for (name,) in tables:
            count = conn.execute(text(f'SELECT COUNT(*) FROM service."{name}"')).scalar()
            print(f"  service.{name}  rows={count}")


if __name__ == "__main__":
    main()
