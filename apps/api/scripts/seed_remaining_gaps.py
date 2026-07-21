"""Seed remaining demo gaps: integration queues, payroll slips, finance GL/tax, valuation, comparisons.

Usage (from apps/api):
  .venv\\Scripts\\python.exe -m scripts.seed_remaining_gaps
"""

from __future__ import annotations

import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import SecTenant, SecUser  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.master_data.models.party import MasterCustomer, MasterVendor  # noqa: E402
from modules.master_data.models.product import MasterProduct  # noqa: E402
from modules.master_data.models.reference import MasterTax  # noqa: E402
from modules.master_data.models.warehouse import MasterWarehouse  # noqa: E402
from modules.finance.models.coa import FinChartOfAccount  # noqa: E402
from modules.finance.models.fiscal import FinFiscalYear, FinPeriod  # noqa: E402
from modules.finance.models.journal import FinJournalHeader, FinJournalLine  # noqa: E402
from modules.finance.models.ledger import FinGlEntry  # noqa: E402
from modules.finance.models.tax import FinTaxRegister  # noqa: E402
from modules.payroll.models.payroll_period import PayPayrollPeriod  # noqa: E402
from modules.payroll.models.payroll_run import PayPayrollRun  # noqa: E402
from modules.payroll.models.payroll_run_line import PayPayrollRunLine  # noqa: E402
from modules.payroll.models.payslip import PayPayslip  # noqa: E402
from modules.payroll.models.payroll_summary import PayPayrollSummary  # noqa: E402
from modules.hr.models.employment import HrEmployment  # noqa: E402
from modules.integration.models.message_queue import IntMessageQueue  # noqa: E402
from modules.integration.models.message import IntMessage  # noqa: E402
from modules.integration.models.retry_queue import IntRetryQueue  # noqa: E402
from modules.integration.models.dead_letter import IntDeadLetter  # noqa: E402
from modules.integration.models.sync_job import IntSyncJob  # noqa: E402
from modules.integration.models.sync_log import IntSyncLog  # noqa: E402
from modules.inventory.models.valuation import InvValuationLayer  # noqa: E402
from modules.procurement.models.rfq import ProcRfqHeader  # noqa: E402
from modules.procurement.models.vendor_quotation import (  # noqa: E402
    ProcVendorComparison,
    ProcVendorQuotationHeader,
)


def utcnow():
    return datetime.now(timezone.utc)


def get_one(db, model, **filters):
    stmt = select(model)
    for k, v in filters.items():
        stmt = stmt.where(getattr(model, k) == v)
    if hasattr(model, "is_deleted"):
        stmt = stmt.where(model.is_deleted.is_(False))
    return db.scalar(stmt)


def ensure(db, model, unique: dict, defaults: dict):
    row = get_one(db, model, **unique)
    if row:
        return row
    valid = {c.key for c in model.__table__.columns}
    payload = {**unique, **{k: v for k, v in defaults.items() if v is not None and k in valid}}
    row = model(id=uuid4(), **{k: v for k, v in payload.items() if k in valid and k != "id"})
    db.add(row)
    db.flush()
    return row


def main() -> None:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(SecTenant).where(SecTenant.is_deleted.is_(False)).limit(1))
        company = db.scalar(
            select(OrgCompany).where(OrgCompany.is_deleted.is_(False)).limit(1)
        )
        branch = db.scalar(
            select(OrgBranch).where(OrgBranch.is_deleted.is_(False)).limit(1)
        )
        admin = db.scalar(
            select(SecUser).where(SecUser.email == "admin@example.com").limit(1)
        )
        if not all([tenant, company, branch, admin]):
            raise SystemExit("Demo tenant/company/branch/admin missing — run seed_demo_data first")

        tid, cid, bid, aid = tenant.id, company.id, branch.id, admin.id
        employees = list(
            db.scalars(
                select(MasterEmployee).where(
                    MasterEmployee.company_id == cid,
                    MasterEmployee.is_deleted.is_(False),
                )
            ).all()
        )
        product = db.scalar(
            select(MasterProduct).where(
                MasterProduct.company_id == cid, MasterProduct.is_deleted.is_(False)
            )
        )
        warehouse = db.scalar(
            select(MasterWarehouse).where(
                MasterWarehouse.company_id == cid, MasterWarehouse.is_deleted.is_(False)
            )
        )
        customer = db.scalar(
            select(MasterCustomer).where(
                MasterCustomer.company_id == cid, MasterCustomer.is_deleted.is_(False)
            )
        )
        tax = db.scalar(
            select(MasterTax).where(MasterTax.company_id == cid, MasterTax.is_deleted.is_(False))
        )
        period = db.scalar(
            select(FinPeriod).where(FinPeriod.company_id == cid, FinPeriod.is_deleted.is_(False))
        )
        fy = db.scalar(
            select(FinFiscalYear).where(
                FinFiscalYear.company_id == cid, FinFiscalYear.is_deleted.is_(False)
            )
        )
        journal = db.scalar(
            select(FinJournalHeader).where(
                FinJournalHeader.company_id == cid, FinJournalHeader.is_deleted.is_(False)
            )
        )
        cash = db.scalar(
            select(FinChartOfAccount).where(
                FinChartOfAccount.company_id == cid,
                FinChartOfAccount.account_code == "1000",
                FinChartOfAccount.is_deleted.is_(False),
            )
        )
        revenue = db.scalar(
            select(FinChartOfAccount).where(
                FinChartOfAccount.company_id == cid,
                FinChartOfAccount.account_code == "4000",
                FinChartOfAccount.is_deleted.is_(False),
            )
        )
        pay_period = db.scalar(
            select(PayPayrollPeriod).where(
                PayPayrollPeriod.company_id == cid, PayPayrollPeriod.is_deleted.is_(False)
            )
        )
        pay_run = db.scalar(
            select(PayPayrollRun).where(
                PayPayrollRun.company_id == cid, PayPayrollRun.is_deleted.is_(False)
            )
        )
        employment = db.scalar(
            select(HrEmployment).where(
                HrEmployment.company_id == cid, HrEmployment.is_deleted.is_(False)
            )
        )
        queue = db.scalar(
            select(IntMessageQueue).where(
                IntMessageQueue.company_id == cid, IntMessageQueue.is_deleted.is_(False)
            )
        )
        sync_job = db.scalar(
            select(IntSyncJob).where(
                IntSyncJob.company_id == cid, IntSyncJob.is_deleted.is_(False)
            )
        )
        rfq = db.scalar(
            select(ProcRfqHeader).where(
                ProcRfqHeader.company_id == cid, ProcRfqHeader.is_deleted.is_(False)
            )
        )
        vq = db.scalar(
            select(ProcVendorQuotationHeader).where(
                ProcVendorQuotationHeader.company_id == cid,
                ProcVendorQuotationHeader.is_deleted.is_(False),
            )
        )

        print("Seeding finance journal lines + GL + tax…")
        if journal and cash and revenue and period and fy:
            line_dr = ensure(
                db,
                FinJournalLine,
                {"journal_header_id": journal.id, "line_number": 1},
                {
                    "tenant_id": tid,
                    "company_id": cid,
                    "branch_id": bid,
                    "account_id": cash.id,
                    "description": "Demo cash receipt",
                    "debit_amount": Decimal("10000.0000"),
                    "credit_amount": Decimal("0.0000"),
                    "base_debit_amount": Decimal("10000.0000"),
                    "base_credit_amount": Decimal("0.0000"),
                    "currency_code": "INR",
                    "exchange_rate": Decimal("1.00000000"),
                    "created_by": aid,
                    "updated_by": aid,
                },
            )
            line_cr = ensure(
                db,
                FinJournalLine,
                {"journal_header_id": journal.id, "line_number": 2},
                {
                    "tenant_id": tid,
                    "company_id": cid,
                    "branch_id": bid,
                    "account_id": revenue.id,
                    "description": "Demo sales recognition",
                    "debit_amount": Decimal("0.0000"),
                    "credit_amount": Decimal("10000.0000"),
                    "base_debit_amount": Decimal("0.0000"),
                    "base_credit_amount": Decimal("10000.0000"),
                    "currency_code": "INR",
                    "exchange_rate": Decimal("1.00000000"),
                    "created_by": aid,
                    "updated_by": aid,
                },
            )
            ensure(
                db,
                FinGlEntry,
                {"tenant_id": tid, "company_id": cid, "entry_number": "GL-00000001"},
                {
                    "branch_id": bid,
                    "entry_date": date(2025, 4, 10),
                    "period_id": period.id,
                    "fiscal_year_id": fy.id,
                    "journal_header_id": journal.id,
                    "journal_line_id": line_dr.id,
                    "account_id": cash.id,
                    "account_code": cash.account_code,
                    "debit_amount": Decimal("10000.0000"),
                    "credit_amount": Decimal("0.0000"),
                    "base_debit_amount": Decimal("10000.0000"),
                    "base_credit_amount": Decimal("0.0000"),
                    "currency_code": "INR",
                    "exchange_rate": Decimal("1.00000000"),
                    "description": "Opening cash — demo",
                    "posted_by": aid,
                    "version": 1,
                },
            )
            ensure(
                db,
                FinGlEntry,
                {"tenant_id": tid, "company_id": cid, "entry_number": "GL-00000002"},
                {
                    "branch_id": bid,
                    "entry_date": date(2025, 4, 10),
                    "period_id": period.id,
                    "fiscal_year_id": fy.id,
                    "journal_header_id": journal.id,
                    "journal_line_id": line_cr.id,
                    "account_id": revenue.id,
                    "account_code": revenue.account_code,
                    "debit_amount": Decimal("0.0000"),
                    "credit_amount": Decimal("10000.0000"),
                    "base_debit_amount": Decimal("0.0000"),
                    "base_credit_amount": Decimal("10000.0000"),
                    "currency_code": "INR",
                    "exchange_rate": Decimal("1.00000000"),
                    "description": "Sales revenue — demo",
                    "posted_by": aid,
                    "version": 1,
                },
            )
            if tax:
                ensure(
                    db,
                    FinTaxRegister,
                    {"tenant_id": tid, "company_id": cid, "register_number": "TAX-00000001"},
                    {
                        "branch_id": bid,
                        "register_date": date(2025, 4, 15),
                        "tax_id": tax.id,
                        "tax_type": "gst",
                        "transaction_type": "output",
                        "taxable_amount": Decimal("10000.0000"),
                        "tax_amount": Decimal("1800.0000"),
                        "currency_code": "INR",
                        "journal_header_id": journal.id,
                        "customer_id": customer.id if customer else None,
                        "source_module": "sales",
                        "period_id": period.id,
                        "status": "active",
                        "version": 1,
                    },
                )

        print("Seeding payroll payslips + summaries…")
        if pay_run and pay_period and employees and employment:
            for idx, emp in enumerate(employees[:3], start=1):
                line = ensure(
                    db,
                    PayPayrollRunLine,
                    {
                        "tenant_id": tid,
                        "company_id": cid,
                        "payroll_run_id": pay_run.id,
                        "employee_id": emp.id,
                    },
                    {
                        "branch_id": bid,
                        "employment_id": employment.id,
                        "paid_days": Decimal("30.00"),
                        "lop_days": Decimal("0.00"),
                        "leave_days": Decimal("0.00"),
                        "gross_earnings": Decimal("50000.0000"),
                        "total_deductions": Decimal("6000.0000"),
                        "net_pay": Decimal("44000.0000"),
                        "employer_contribution": Decimal("6000.0000"),
                        "component_breakdown_json": {
                            "basic": 30000,
                            "hra": 12000,
                            "special": 8000,
                            "pf": 3600,
                            "tax": 2400,
                        },
                        "status": "calculated",
                        "created_by": aid,
                        "updated_by": aid,
                    },
                )
                ensure(
                    db,
                    PayPayslip,
                    {
                        "tenant_id": tid,
                        "company_id": cid,
                        "document_number": f"PS-2026-{idx:06d}",
                    },
                    {
                        "branch_id": bid,
                        "payroll_run_id": pay_run.id,
                        "payroll_run_line_id": line.id,
                        "employee_id": emp.id,
                        "payroll_period_id": pay_period.id,
                        "gross_salary": Decimal("50000.0000"),
                        "total_deductions": Decimal("6000.0000"),
                        "net_salary": Decimal("44000.0000"),
                        "payslip_json": {
                            "employee_name": f"{emp.first_name} {emp.last_name}",
                            "employee_code": emp.employee_code,
                            "period": getattr(pay_period, "period_name", None)
                            or getattr(pay_period, "period_code", "Apr 2026"),
                        },
                        "delivery_status": "emailed" if idx == 1 else "pending",
                        "payment_status": "paid" if idx == 1 else "unpaid",
                        "status": "issued" if idx == 1 else "generated",
                        "created_by": aid,
                        "updated_by": aid,
                    },
                )
            ensure(
                db,
                PayPayrollSummary,
                {"tenant_id": tid, "company_id": cid, "payroll_run_id": pay_run.id},
                {
                    "branch_id": bid,
                    "payroll_period_id": pay_period.id,
                    "employee_count": min(3, len(employees)),
                    "total_gross": Decimal("150000.0000"),
                    "total_deduction": Decimal("18000.0000"),
                    "total_net": Decimal("132000.0000"),
                    "total_employer_cost": Decimal("18000.0000"),
                    "summary_json": {"currency": "INR", "run": "DEMO-PAY-RUN-0001"},
                    "status": "finalized",
                    "created_by": aid,
                    "updated_by": aid,
                },
            )

        print("Seeding integration messages / retries / DLQ / sync logs…")
        if queue:
            msg = ensure(
                db,
                IntMessage,
                {"tenant_id": tid, "company_id": cid, "message_number": "MSG-2026-000001"},
                {
                    "branch_id": bid,
                    "message_queue_id": queue.id,
                    "correlation_id": "CORR-INV-0001",
                    "payload_json": {"event": "invoice.posted", "doc": "SI-0001"},
                    "source_module": "finance",
                    "priority": 1,
                    "available_at": utcnow(),
                    "status": "failed",
                    "created_by": aid,
                    "updated_by": aid,
                },
            )
            retry = ensure(
                db,
                IntRetryQueue,
                {"tenant_id": tid, "company_id": cid, "retry_number": "RTY-2026-000001"},
                {
                    "branch_id": bid,
                    "message_id": msg.id,
                    "attempt_no": 2,
                    "next_attempt_at": utcnow(),
                    "last_error": "Upstream bank gateway timeout",
                    "status": "pending",
                    "created_by": aid,
                    "updated_by": aid,
                },
            )
            ensure(
                db,
                IntDeadLetter,
                {"tenant_id": tid, "company_id": cid, "dlq_number": "DLQ-2026-000001"},
                {
                    "branch_id": bid,
                    "message_id": msg.id,
                    "retry_id": retry.id,
                    "reason": "Max retries exceeded for bank payment sync",
                    "payload_json": {"event": "invoice.posted", "doc": "SI-0001"},
                    "failed_at": utcnow(),
                    "status": "open",
                    "created_by": aid,
                    "updated_by": aid,
                },
            )
        if sync_job:
            ensure(
                db,
                IntSyncLog,
                {
                    "tenant_id": tid,
                    "company_id": cid,
                    "sync_job_id": sync_job.id,
                    "message": "Bank statement sync completed — 12 records",
                },
                {
                    "branch_id": bid,
                    "logged_at": utcnow(),
                    "level": "info",
                    "payload_json": {"imported": 12, "failed": 0},
                    "status": "recorded",
                    "created_by": aid,
                    "updated_by": aid,
                },
            )
            ensure(
                db,
                IntSyncLog,
                {
                    "tenant_id": tid,
                    "company_id": cid,
                    "sync_job_id": sync_job.id,
                    "message": "SKU mapping warning for PRD-1007",
                },
                {
                    "branch_id": bid,
                    "logged_at": utcnow(),
                    "level": "warn",
                    "payload_json": {"sku": "PRD-1007"},
                    "status": "recorded",
                    "created_by": aid,
                    "updated_by": aid,
                },
            )

        print("Seeding inventory valuation layers…")
        if product and warehouse:
            ensure(
                db,
                InvValuationLayer,
                {
                    "tenant_id": tid,
                    "company_id": cid,
                    "warehouse_id": warehouse.id,
                    "product_id": product.id,
                    "source_document_id": product.id,
                },
                {
                    "branch_id": bid,
                    "received_at": utcnow(),
                    "original_qty": Decimal("100.0000"),
                    "remaining_qty": Decimal("75.0000"),
                    "unit_cost": Decimal("250.0000"),
                    "currency_code": "INR",
                    "source_module": "procurement",
                    "status": "open",
                    "created_by": aid,
                    "updated_by": aid,
                },
            )

        print("Seeding procurement comparisons…")
        if rfq:
            ensure(
                db,
                ProcVendorComparison,
                {"tenant_id": tid, "company_id": cid, "rfq_header_id": rfq.id},
                {
                    "branch_id": bid,
                    "document_number": "VCMP-2026-000001",
                    "best_price_quotation_id": vq.id if vq else None,
                    "best_delivery_quotation_id": vq.id if vq else None,
                    "best_overall_quotation_id": vq.id if vq else None,
                    "selected_quotation_id": vq.id if vq else None,
                    "score_breakdown": {
                        "price_score": 92,
                        "delivery_score": 88,
                        "overall_score": 90,
                        "winner": getattr(vq, "document_number", None) or "VQ-0001",
                    },
                    "status": "completed",
                    "compared_at": utcnow(),
                    "created_by": aid,
                    "updated_by": aid,
                },
            )

        db.commit()
        print("=" * 60)
        print("Remaining gaps seeded.")
        print("=" * 60)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
