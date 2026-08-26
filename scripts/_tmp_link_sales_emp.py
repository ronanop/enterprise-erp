import sys
sys.path.insert(0, "src")
from sqlalchemy import create_engine, text
from core.config import settings

e = create_engine(str(settings.database_url))
with e.begin() as c:
    emp = c.execute(
        text(
            "select id from master.master_employee "
            "where tenant_id='d3dab809-e72f-4bfe-b8f7-9f2762491187' "
            "and employee_code='EMP-001' and is_deleted=false"
        )
    ).scalar()
    print("emp", emp)
    n = c.execute(
        text(
            "update foundation.sec_user set employee_id=:emp "
            "where id='d2a4e44d-9668-4791-9318-0039ae728904'"
        ),
        {"emp": emp},
    ).rowcount
    print("linked user", n)
    c.execute(
        text(
            "update master.master_employee set user_id='d2a4e44d-9668-4791-9318-0039ae728904' "
            "where id=:emp"
        ),
        {"emp": emp},
    )
print("done")
