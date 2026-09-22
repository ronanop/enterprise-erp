import sys
sys.path.insert(0, "src")
from sqlalchemy import create_engine, text, inspect
from core.config import settings
from security.password import PasswordHasher

e = create_engine(str(settings.database_url))
insp = inspect(e)
cols = [c["name"] for c in insp.get_columns("sec_user", schema="foundation")]
print("cols", cols)
with e.connect() as c:
    row = c.execute(
        text(
            "select * from foundation.sec_user where email='sales.user@example.com' "
            "and tenant_id='d3dab809-e72f-4bfe-b8f7-9f2762491187'"
        )
    ).mappings().first()
    print(dict(row) if row else None)
