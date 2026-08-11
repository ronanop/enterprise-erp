"""Ensure GRN receipt columns and proc_order_receipt_batch tables exist (Alembic bypass)."""

from pathlib import Path

from sqlalchemy import create_engine, text


def load_database_url() -> str:
    for candidate in (
        Path(".env"),
        Path("../../.env"),
        Path("../../../.env"),
        Path(__file__).resolve().parents[3] / ".env",
        Path(__file__).resolve().parents[2] / ".env",
    ):
        if not candidate.exists():
            continue
        for line in candidate.read_text(encoding="utf-8").splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip("\"'")
    return "postgresql+psycopg://erp:erp_dev_password@localhost:5433/erp"


def main() -> None:
    url = load_database_url()
    print("using", url.split("@")[-1])
    engine = create_engine(url)
    stmts = [
        """
        ALTER TABLE procurement.proc_order_header
          ADD COLUMN IF NOT EXISTS current_receipt_batch_id UUID
        """,
        """
        ALTER TABLE procurement.proc_order_header
          ADD COLUMN IF NOT EXISTS current_receipt_batch_at TIMESTAMPTZ
        """,
        """
        ALTER TABLE procurement.proc_order_header
          ADD COLUMN IF NOT EXISTS grn_sequence INTEGER NOT NULL DEFAULT 0
        """,
        """
        ALTER TABLE procurement.proc_order_header
          ADD COLUMN IF NOT EXISTS current_grn_number VARCHAR(80)
        """,
        """
        ALTER TABLE procurement.proc_order_header
          ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(255)
        """,
        """
        ALTER TABLE procurement.proc_order_line
          ADD COLUMN IF NOT EXISTS last_receipt_qty NUMERIC(18, 4) NOT NULL DEFAULT 0
        """,
        """
        ALTER TABLE procurement.proc_order_line
          ADD COLUMN IF NOT EXISTS last_receipt_at TIMESTAMPTZ
        """,
        """
        ALTER TABLE procurement.proc_order_line
          ADD COLUMN IF NOT EXISTS last_receipt_batch_id UUID
        """,
        """
        ALTER TABLE procurement.proc_order_line
          ADD COLUMN IF NOT EXISTS last_receipt_serial_numbers JSONB
        """,
        """
        ALTER TABLE procurement.proc_order_receipt_batch_line
          ADD COLUMN IF NOT EXISTS serial_numbers JSONB
        """,
        """
        CREATE TABLE IF NOT EXISTS procurement.proc_order_receipt_batch (
          id UUID PRIMARY KEY,
          order_header_id UUID NOT NULL
            REFERENCES procurement.proc_order_header (id) ON DELETE RESTRICT,
          sequence INTEGER NOT NULL,
          grn_number VARCHAR(80) NOT NULL,
          receipt_at TIMESTAMPTZ NOT NULL,
          tenant_id UUID NOT NULL,
          company_id UUID NOT NULL,
          branch_id UUID NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by UUID,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by UUID,
          version INTEGER NOT NULL DEFAULT 0,
          is_deleted BOOLEAN NOT NULL DEFAULT false,
          CONSTRAINT uk_proc_orb_header_seq UNIQUE (order_header_id, sequence)
        )
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_proc_order_receipt_batch_order_header_id
          ON procurement.proc_order_receipt_batch (order_header_id)
        """,
        """
        CREATE TABLE IF NOT EXISTS procurement.proc_order_receipt_batch_line (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          receipt_batch_id UUID NOT NULL
            REFERENCES procurement.proc_order_receipt_batch (id) ON DELETE RESTRICT,
          order_line_id UUID NOT NULL
            REFERENCES procurement.proc_order_line (id) ON DELETE RESTRICT,
          quantity NUMERIC(18, 4) NOT NULL,
          tenant_id UUID NOT NULL,
          company_id UUID NOT NULL,
          branch_id UUID NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by UUID,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by UUID,
          version INTEGER NOT NULL DEFAULT 0,
          is_deleted BOOLEAN NOT NULL DEFAULT false,
          CONSTRAINT uk_proc_orbl_batch_line UNIQUE (receipt_batch_id, order_line_id)
        )
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_proc_order_receipt_batch_line_receipt_batch_id
          ON procurement.proc_order_receipt_batch_line (receipt_batch_id)
        """,
        """
        ALTER TABLE procurement.proc_order_receipt_batch
          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
        """,
        """
        ALTER TABLE procurement.proc_order_receipt_batch
          ADD COLUMN IF NOT EXISTS deleted_by UUID
        """,
        """
        ALTER TABLE procurement.proc_order_receipt_batch_line
          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
        """,
        """
        ALTER TABLE procurement.proc_order_receipt_batch_line
          ADD COLUMN IF NOT EXISTS deleted_by UUID
        """,
        """
        CREATE TABLE IF NOT EXISTS procurement.proc_inventory_import_line (
          id UUID PRIMARY KEY,
          product_name VARCHAR(255) NOT NULL,
          serial_number VARCHAR(120) NOT NULL,
          order_header_id UUID REFERENCES procurement.proc_order_header (id) ON DELETE RESTRICT,
          company_po_number VARCHAR(50),
          tenant_id UUID NOT NULL,
          company_id UUID NOT NULL,
          branch_id UUID NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by UUID,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by UUID,
          version INTEGER NOT NULL DEFAULT 0,
          is_deleted BOOLEAN NOT NULL DEFAULT false,
          deleted_at TIMESTAMPTZ,
          deleted_by UUID
        )
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_proc_inventory_import_line_order_header_id
          ON procurement.proc_inventory_import_line (order_header_id)
        """,
        """
        ALTER TABLE procurement.proc_order_receipt_batch
          ADD COLUMN IF NOT EXISTS vendor_invoice_number VARCHAR(80)
        """,
        """
        ALTER TABLE procurement.proc_order_receipt_batch
          ADD COLUMN IF NOT EXISTS vendor_invoice_date DATE
        """,
        """
        ALTER TABLE procurement.proc_order_receipt_batch
          ADD COLUMN IF NOT EXISTS vendor_invoice_quantity NUMERIC(18, 4)
        """,
        """
        ALTER TABLE procurement.proc_order_receipt_batch
          ADD COLUMN IF NOT EXISTS vendor_invoice_subtotal NUMERIC(18, 4)
        """,
        """
        ALTER TABLE procurement.proc_order_line
          ADD COLUMN IF NOT EXISTS last_receipt_billing BOOLEAN NOT NULL DEFAULT true
        """,
        """
        ALTER TABLE procurement.proc_order_line
          ADD COLUMN IF NOT EXISTS last_receipt_billing_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0
        """,
        """
        ALTER TABLE procurement.proc_order_receipt_batch_line
          ADD COLUMN IF NOT EXISTS billing BOOLEAN NOT NULL DEFAULT true
        """,
        """
        ALTER TABLE procurement.proc_order_receipt_batch_line
          ADD COLUMN IF NOT EXISTS billing_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0
        """,
    ]
    with engine.begin() as conn:
        for stmt in stmts:
            conn.execute(text(stmt))
    print("proc_order_receipt schema ready")


if __name__ == "__main__":
    main()
