import sys

sys.path.insert(0, "src")

from sqlalchemy import create_engine, text

from core.config import settings

e = create_engine(str(settings.database_url))
with e.connect() as c:
    cols = c.execute(
        text(
            """
            select column_name from information_schema.columns
            where table_schema='crm' and table_name='crm_ovf_line'
            order by ordinal_position
            """
        )
    ).fetchall()
    print("columns", [r[0] for r in cols])
    rows = c.execute(
        text(
            """
            select o.ovf_no, ol.side, ol.line_no, ol.product_name,
                   left(coalesce(ol.description, ''), 60) as descr,
                   ol.distributor_name, ol.contact_person, ol.contact_number,
                   ol.qty, ol.unit_price, ol.line_total
            from crm.crm_ovf_line ol
            join crm.crm_ovf o on o.id = ol.ovf_id
            where ol.is_deleted = false and o.is_deleted = false
            order by o.created_at desc, ol.side, ol.line_no
            limit 24
            """
        )
    ).fetchall()
    for r in rows:
        print(dict(r._mapping))
