"""Debug list_receipt_batches — run: python scripts/debug_receipt_batches.py [order_id]"""
import sys
import traceback
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from sqlalchemy import text

from database.session import SessionLocal
from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.schemas import ScmReceiptBatchResponse
from modules.procurement.service.scm_handoff_service import ScmHandoffService


def main() -> None:
    order_id_arg = sys.argv[1] if len(sys.argv) > 1 else None
    db = SessionLocal()
    try:
        if order_id_arg:
            order_id = UUID(order_id_arg)
            r = db.execute(
                text(
                    "SELECT id, tenant_id, company_id, branch_id "
                    "FROM procurement.proc_order_header WHERE id = :id"
                ),
                {"id": str(order_id)},
            ).fetchone()
        else:
            r = db.execute(
                text(
                    "SELECT id, tenant_id, company_id, branch_id "
                    "FROM procurement.proc_order_header "
                    "WHERE is_deleted = false "
                    "ORDER BY updated_at DESC LIMIT 1"
                )
            ).fetchone()
            order_id = r[0]

        if r is None:
            print("No order found")
            return

        ctx = TenantContext(
            tenant_id=r[1],
            user_id=r[1],
            company_id=r[2],
            branch_id=r[3],
            user_type=sys.argv[2] if len(sys.argv) > 2 else "tenant_admin",
        )
        print("order_id", order_id)
        svc = ScmHandoffService(db)
        rows = svc.list_receipt_batches(ctx, order_id)
        print("batch count", len(rows))
        for row in rows:
            validated = ScmReceiptBatchResponse.model_validate(row)
            print(
                "OK",
                validated.grn_number,
                "lines",
                len(validated.lines),
                "attachments",
                len(validated.attachments),
            )
    except Exception:
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
