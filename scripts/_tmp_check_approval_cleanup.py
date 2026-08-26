import sys
sys.path.insert(0, "src")
from sqlalchemy import create_engine, text
from core.config import settings

e = create_engine(str(settings.database_url))
with e.connect() as c:
    total = c.execute(text("select count(*) from crm.crm_approval_task")).scalar()
    active = c.execute(text("select count(*) from crm.crm_approval_task where is_deleted=false")).scalar()
    deleted = c.execute(text("select count(*) from crm.crm_approval_task where is_deleted=true")).scalar()
    recent = c.execute(
        text(
            "select count(*) from crm.crm_approval_task "
            "where is_deleted=true and deleted_at > now() - interval '15 minutes'"
        )
    ).scalar()
    sample = c.execute(
        text(
            "select entity_type, count(*) from crm.crm_approval_task "
            "where is_deleted=true and deleted_at > now() - interval '15 minutes' "
            "group by entity_type order by 2 desc"
        )
    ).fetchall()
    print("total", total, "active", active, "deleted", deleted, "deleted_last_15m", recent)
    print("by entity_type", sample)
