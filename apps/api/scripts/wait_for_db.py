"""Wait until Postgres accepts connections (use before alembic/seeds).

Usage (from apps/api):
  python -m scripts.wait_for_db
  python -m scripts.wait_for_db --timeout 120
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from sqlalchemy import create_engine, text  # noqa: E402

from core.config import settings  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Wait for DATABASE_URL to be reachable")
    parser.add_argument("--timeout", type=int, default=90, help="Seconds to retry")
    parser.add_argument("--interval", type=float, default=2.0, help="Seconds between tries")
    args = parser.parse_args()

    engine = create_engine(settings.database_url, pool_pre_ping=True)
    deadline = time.monotonic() + args.timeout
    last_err: Exception | None = None

    while time.monotonic() < deadline:
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"Database is ready ({settings.database_url.split('@')[-1]})")
            return
        except Exception as exc:  # noqa: BLE001 — retry any connect failure
            last_err = exc
            time.sleep(args.interval)

    print(
        "Database not reachable. Check DATABASE_URL / Postgres on the configured host.\n"
        f"DATABASE_URL={settings.database_url}\n"
        f"Last error: {last_err}",
        file=sys.stderr,
    )
    raise SystemExit(1)


if __name__ == "__main__":
    main()
