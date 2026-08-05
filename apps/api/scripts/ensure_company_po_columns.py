"""Ensure company_po_number / entity_code columns exist."""

from pathlib import Path

from sqlalchemy import create_engine, text


def load_database_url() -> str:
    for candidate in (Path(".env"), Path("../../.env"), Path("../../../.env")):
        if not candidate.exists():
            continue
        for line in candidate.read_text(encoding="utf-8").splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip("\"'")
    raise SystemExit("DATABASE_URL not found")


def main() -> None:
    url = load_database_url()
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE procurement.proc_order_header
                  ADD COLUMN IF NOT EXISTS company_po_number VARCHAR(50)
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE procurement.proc_order_header
                  ADD COLUMN IF NOT EXISTS entity_code VARCHAR(10)
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_proc_oh_company_po_number
                  ON procurement.proc_order_header (company_po_number)
                """
            )
        )
    print("company_po_number / entity_code ready")


if __name__ == "__main__":
    main()
