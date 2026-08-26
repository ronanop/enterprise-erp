"""Diagnose SQLAlchemy ANY(:ids) binding against crm_approval_task."""

from __future__ import annotations

import sys

sys.path.insert(0, "src")

from sqlalchemy import create_engine, text, bindparam

from core.config import settings

# Known demo opp from successful run (may be soft-deleted)
DEMO_OPP = "8c904eb5-b9e8-4fe2-a175-82d4ea091305"


def main() -> None:
    engine = create_engine(str(settings.database_url))
    with engine.connect() as conn:
        ids = [DEMO_OPP]
        # Method A: any(:ids) as used in cleanup
        a = conn.execute(
            text(
                "select count(*) from crm.crm_approval_task "
                "where entity_id::text = any(:ids)"
            ),
            {"ids": ids},
        ).scalar()
        print("method A any(:ids) count:", a)

        # Method B: expanding IN
        stmt = text(
            "select count(*) from crm.crm_approval_task "
            "where entity_id::text in :ids"
        ).bindparams(bindparam("ids", expanding=True))
        b = conn.execute(stmt, {"ids": ids}).scalar()
        print("method B expanding IN count:", b)

        # Method C: cast array
        c = conn.execute(
            text(
                "select count(*) from crm.crm_approval_task "
                "where entity_id = any(cast(:ids as uuid[]))"
            ),
            {"ids": ids},
        ).scalar()
        print("method C uuid[] cast count:", c)

        # What does psycopg actually send for any(:ids)?
        # Count all vs matching one literal
        d = conn.execute(
            text(
                "select count(*) from crm.crm_approval_task "
                "where entity_id::text = :one"
            ),
            {"one": DEMO_OPP},
        ).scalar()
        print("method D single eq count:", d)

        total = conn.execute(text("select count(*) from crm.crm_approval_task")).scalar()
        print("total rows:", total)


if __name__ == "__main__":
    main()
