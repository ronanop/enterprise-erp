import sys
sys.path.insert(0, "src")
from sqlalchemy import inspect
from database.session import engine
insp = inspect(engine)
cols = [c["name"] for c in insp.get_columns("prj_site_installation", schema="project")]
needed = ["document_number", "delivery_type", "workflow_stage", "circle", "cloud_name", "site_name"]
print("has needed:", all(n in cols for n in needed))
print("cols:", ", ".join(cols))
