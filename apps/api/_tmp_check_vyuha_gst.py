from sqlalchemy import create_engine, text
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(r"D:/ERP") / ".env")
engine = create_engine(os.environ["DATABASE_URL"])
with engine.connect() as conn:
    rows = conn.execute(
        text(
            """
            SELECT entity_code, entity_name, entity_gst
            FROM crm.crm_selling_entity
            WHERE lower(entity_name) LIKE '%vyuha%'
              AND coalesce(is_deleted, false) IS FALSE
            """
        )
    ).fetchall()
    for row in rows:
        print(row)
