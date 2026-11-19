import pathlib
import re
import sys

sys.path.insert(0, "src")
from sqlalchemy import create_engine, text
from core.config import settings

e = create_engine(settings.database_url)
with e.connect() as c:
    ver = c.execute(text("select version_num from alembic_version")).fetchall()
    print("alembic_version:", ver)
    tbl = c.execute(
        text(
            "select exists (select 1 from information_schema.tables "
            "where table_schema='procurement' and table_name='proc_order_receipt_batch')"
        )
    ).scalar()
    print("proc_order_receipt_batch exists:", tbl)
    col = c.execute(
        text(
            "select character_maximum_length from information_schema.columns "
            "where table_name='alembic_version' and column_name='version_num'"
        )
    ).scalar()
    print("version_num max length:", col)

long = []
for p in pathlib.Path("alembic/versions").glob("*.py"):
    m = re.search(r'revision: str = "([^"]+)"', p.read_text(encoding="utf-8"))
    if m and len(m.group(1)) > 32:
        long.append((len(m.group(1)), m.group(1), p.name))
print("revisions >32 chars:", len(long))
for length, rev, name in sorted(long):
    print(f"  {length} {rev} ({name})")
