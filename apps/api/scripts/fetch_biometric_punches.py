#!/usr/bin/env python
"""Always-on biometric punch fetcher.

Pulls attendance from every active ZK/K40 device every 60 seconds and writes
rows into HR attendance (source=biometric). Use this when Celery beat is not
running locally, or as a dedicated process next to the API.

From apps/api:

  python scripts/fetch_biometric_punches.py
  python scripts/fetch_biometric_punches.py --once
  python scripts/fetch_biometric_punches.py --interval 60
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

# Allow `python scripts/fetch_biometric_punches.py` from apps/api
_API_ROOT = Path(__file__).resolve().parents[1]
_SRC = _API_ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))


def _run_once() -> dict:
    from database.session import SessionLocal
    from modules.hr.service.compoff_bio_service import BiometricDeviceService

    db = SessionLocal()
    try:
        summary = BiometricDeviceService.fetch_punches_all_active(db)
        db.commit()
        return {"status": "ok", **summary}
    except Exception as exc:
        db.rollback()
        return {"status": "error", "message": str(exc)}
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch biometric punches on a loop")
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run a single fetch pass and exit",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=60,
        help="Seconds between fetch passes (default: 60)",
    )
    args = parser.parse_args()
    interval = max(15, int(args.interval or 60))

    if args.once:
        result = _run_once()
        print(result, flush=True)
        return 0 if result.get("status") == "ok" else 1

    print(
        f"Biometric punch fetcher started — every {interval}s. Ctrl+C to stop.",
        flush=True,
    )
    while True:
        started = time.monotonic()
        result = _run_once()
        status = result.get("status")
        if status == "ok":
            print(
                f"[fetch] devices={result.get('devices')} ok={result.get('ok')} "
                f"failed={result.get('failed')} logs={result.get('logs_read')} "
                f"saved={(result.get('created') or 0) + (result.get('updated') or 0)}",
                flush=True,
            )
            for err in result.get("errors") or []:
                print(f"  ! {err}", flush=True)
        else:
            print(f"[fetch] error: {result.get('message')}", flush=True)

        elapsed = time.monotonic() - started
        sleep_for = max(1.0, interval - elapsed)
        try:
            time.sleep(sleep_for)
        except KeyboardInterrupt:
            print("Stopped.", flush=True)
            return 0


if __name__ == "__main__":
    raise SystemExit(main())
