import sys
sys.path.insert(0, "src")
from sqlalchemy import create_engine, text
from core.config import settings

CRM_TENANT = "d3dab809-e72f-4bfe-b8f7-9f2762491187"
e = create_engine(str(settings.database_url))
with e.connect() as c:
    users = c.execute(
        text(
            "select id::text, email, status, user_type from foundation.sec_user "
            "where tenant_id=:t and is_deleted=false order by email"
        ),
        {"t": CRM_TENANT},
    ).fetchall()
    print("CRM tenant users:")
    for u in users:
        print(" ", u)
    emps = c.execute(
        text(
            "select id::text, employee_code, first_name, last_name, company_id::text "
            "from master.master_employee where tenant_id=:t and is_deleted=false limit 10"
        ),
        {"t": CRM_TENANT},
    ).fetchall()
    print("employees", emps)
