import sys
sys.path.insert(0, "src")
from sqlalchemy import create_engine, text
from core.config import settings

e = create_engine(str(settings.database_url))
with e.begin() as c:
    rows = c.execute(
        text(
            "select id::text, email, tenant_id::text from foundation.sec_user "
            "where email in ('sales.user@example.com','presales.user@example.com',"
            "'management.user@example.com','accounts.user@example.com') "
            "and is_deleted=false order by email, tenant_id"
        )
    ).fetchall()
    print("before", rows)
    # Prefer CRM tenant (d3dab809...) — rename empty-tenant duplicates so login resolves correctly
    updated = c.execute(
        text(
            "update foundation.sec_user set email = email || '.empty-tenant' "
            "where tenant_id = '697a30b3-e5a2-40e7-924d-0928a4de35d2' "
            "and email in ('sales.user@example.com','presales.user@example.com',"
            "'management.user@example.com','accounts.user@example.com') "
            "and is_deleted=false"
        )
    )
    print("renamed", updated.rowcount)
    rows2 = c.execute(
        text(
            "select id::text, email, tenant_id::text from foundation.sec_user "
            "where email like 'sales.user%' or email like 'presales.user%' "
            "or email like 'management.user%' order by email"
        )
    ).fetchall()
    print("after", rows2)
