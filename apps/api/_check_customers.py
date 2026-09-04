import sys
sys.path.insert(0, "src")
from sqlalchemy import text
from database.session import engine

with engine.connect() as c:
    branches = c.execute(
        text(
            "SELECT id, company_id, tenant_id, branch_name "
            "FROM organization.org_branch WHERE is_deleted = false LIMIT 5"
        )
    ).fetchall()
    print("branches:", branches)
    customers = c.execute(
        text(
            "SELECT customer_name, status FROM master.master_customer "
            "WHERE is_deleted = false ORDER BY customer_name LIMIT 20"
        )
    ).fetchall()
    print("customers:", customers)
