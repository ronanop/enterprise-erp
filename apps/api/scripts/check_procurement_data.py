import sys

sys.path.insert(0, "src")
from sqlalchemy import create_engine, text
from core.config import settings

e = create_engine(settings.database_url)
with e.connect() as c:
    print("tenant:", c.execute(text("select id from foundation.sec_tenant")).fetchall())
    print("company:", c.execute(text("select id, company_code from organization.org_company")).fetchall())
    print("POs:", c.execute(text("select id, document_number, status, vendor_id, is_deleted from procurement.proc_order_header")).fetchall())
    print("vendors:", c.execute(text("select id, vendor_code, vendor_name from master.master_vendor")).fetchall())
    print("products:", c.execute(text("select id, product_code, product_name from master.master_product limit 15")).fetchall())
    print("uoms:", c.execute(text("select id, uom_code from master.master_uom")).fetchall())
    print("shared ovfs count:", c.execute(text("select count(*) from crm.crm_ovf where shared_to_scm=true")).scalar())
