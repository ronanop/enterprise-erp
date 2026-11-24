"""Run alembic upgrade one step at a time; stamp past duplicate-object failures."""

from __future__ import annotations

import re
import subprocess
import sys

DUPLICATE_MARKERS = (
    "DuplicateTable",
    "DuplicateColumn",
    "DuplicateObject",
    "already exists",
    "duplicate key value",
)


def current_revision() -> str:
    out = subprocess.check_output(["alembic", "current"], text=True, stderr=subprocess.STDOUT)
    # e.g. "0495_crm_kyc_record (head)" or just the revision id
    for line in out.splitlines():
        line = line.strip()
        if not line or line.startswith("INFO"):
            continue
        return line.split()[0]
    raise RuntimeError(f"Could not parse alembic current:\n{out}")


def next_revision(cur: str) -> str | None:
    out = subprocess.check_output(
        ["alembic", "history", "-r", f"{cur}:head"],
        text=True,
        stderr=subprocess.STDOUT,
    )
    # Lines look like: "0495_crm_kyc_record -> 0496_sec_user_module, ..."
    for line in out.splitlines():
        m = re.search(rf"{re.escape(cur)}\s*->\s*([^\s,]+)", line)
        if m:
            return m.group(1)
    return None


def main() -> int:
    steps = 0
    stamped = 0
    while True:
        cur = current_revision()
        nxt = next_revision(cur)
        if not nxt:
            print(f"At head: {cur}")
            break
        print(f"Upgrading {cur} -> {nxt} …")
        proc = subprocess.run(
            ["alembic", "upgrade", nxt],
            text=True,
            capture_output=True,
        )
        combined = (proc.stdout or "") + (proc.stderr or "")
        if proc.returncode == 0:
            steps += 1
            print(f"  OK ({steps} applied, {stamped} stamped)")
            continue
        if any(m in combined for m in DUPLICATE_MARKERS):
            print(f"  Duplicate object — stamping {nxt}")
            print(combined[-800:])
            stamp = subprocess.run(["alembic", "stamp", nxt], text=True, capture_output=True)
            if stamp.returncode != 0:
                print(stamp.stdout)
                print(stamp.stderr)
                return 1
            stamped += 1
            continue
        print("Migration failed (not a duplicate):")
        print(combined[-2000:])
        return 1
    print(f"Done. applied={steps} stamped={stamped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
