"""AR/AP sub-ledger routers."""

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.session import get_db
from modules.finance.dependencies import PaginationParams, get_pagination, paginate
from modules.finance.schemas import (
    ArAllocateRequest,
    ArAgingReportResponse,
    ArCustomerLedgerResponse,
    ArReceiptCreateRequest,
    ArSummaryResponse,
    ApAllocateRequest,
    ApAgingReportResponse,
    ApPaymentCreateRequest,
    ApSummaryResponse,
    ApVendorLedgerResponse,
    CustomerLedgerCreateRequest,
    CustomerLedgerListResponse,
    CustomerLedgerResponse,
    CustomerLedgerUpdateRequest,
    PaymentRequest,
    VendorLedgerCreateRequest,
    VendorLedgerListResponse,
    VendorLedgerResponse,
    VendorLedgerUpdateRequest,
)
from modules.finance.service.customer_ledger_service import CustomerLedgerService
from modules.finance.service.vendor_ledger_service import VendorLedgerService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

ar_router = APIRouter(prefix="/ar", tags=["Finance - Accounts Receivable"])
ap_router = APIRouter(prefix="/ap", tags=["Finance - Accounts Payable"])


@ar_router.get("/summary", response_model=APIResponse[ArSummaryResponse])
def ar_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ar:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[ArSummaryResponse]:
    data = CustomerLedgerService(db).summary(ctx, company_id)
    return APIResponse(message="AR summary retrieved", data=data)


@ar_router.get("/aging", response_model=APIResponse[ArAgingReportResponse])
def ar_aging(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ar:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    as_of: date | None = None,
) -> APIResponse[ArAgingReportResponse]:
    data = CustomerLedgerService(db).aging_report_response(ctx, company_id, as_of)
    return APIResponse(message="AR aging retrieved", data=data)


@ar_router.get("/customers/{customer_id}", response_model=APIResponse[ArCustomerLedgerResponse])
def ar_customer_ledger(
    customer_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ar:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
) -> APIResponse[ArCustomerLedgerResponse]:
    data = CustomerLedgerService(db).customer_ledger(
        ctx, customer_id, company_id, from_date=from_date, to_date=to_date
    )
    return APIResponse(message="Customer ledger retrieved", data=data)


@ar_router.get("")
def list_ar(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ar:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    customer_id: UUID | None = None,
    document_type: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    workflow_status: Annotated[str | None, Query()] = None,
    currency_code: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
    from_date: date | None = None,
    to_date: date | None = None,
    due_from: date | None = None,
    due_to: date | None = None,
    overdue_only: Annotated[bool, Query()] = False,
    sort_by: Annotated[str, Query()] = "document_date",
    sort_dir: Annotated[str, Query()] = "desc",
    paged: Annotated[bool, Query()] = False,
) -> APIResponse[CustomerLedgerListResponse | list[CustomerLedgerResponse]]:
    """Default list stays an array for backward compatibility; use paged=true for enterprise UI."""
    svc = CustomerLedgerService(db)
    items = svc.list_responses(
        ctx,
        company_id,
        customer_id,
        document_type=document_type,
        status=status,
        workflow_status=workflow_status,
        currency_code=currency_code,
        search=q,
        from_date=from_date,
        to_date=to_date,
        due_from=due_from,
        due_to=due_to,
        overdue_only=overdue_only,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    page = paginate(items, pagination)
    total_outstanding = sum(float(i.outstanding_amount or i.balance_amount or 0) for i in items)
    total_paid = sum(float(i.paid_amount or 0) for i in items)
    total_balance = sum(float(i.balance_amount or 0) for i in items)
    if paged:
        return APIResponse(
            message="AR entries retrieved",
            data=CustomerLedgerListResponse(
                items=page,
                total=len(items),
                page=pagination.page,
                page_size=pagination.page_size,
                total_outstanding=total_outstanding,
                total_paid=total_paid,
                total_balance=total_balance,
            ),
        )
    return APIResponse(message="AR entries retrieved", data=page)


@ar_router.post("", response_model=APIResponse[CustomerLedgerResponse])
def create_ar(
    body: CustomerLedgerCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ar:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CustomerLedgerResponse]:
    entry = CustomerLedgerService(db).create_entry(ctx, **body.model_dump())
    db.commit()
    data = CustomerLedgerService(db).get_entry(ctx, entry.id)
    return APIResponse(message="AR entry created", data=data)


@ar_router.post("/receipts", response_model=APIResponse[CustomerLedgerResponse])
def create_receipt(
    body: ArReceiptCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ar:payment"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CustomerLedgerResponse]:
    entry = CustomerLedgerService(db).create_receipt(ctx, **body.model_dump(exclude={"notes"}))
    db.commit()
    data = CustomerLedgerService(db).get_entry(ctx, entry.id)
    return APIResponse(message="Receipt created", data=data)


@ar_router.post("/allocate", response_model=APIResponse[CustomerLedgerResponse])
def allocate_receipt(
    body: ArAllocateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ar:payment"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CustomerLedgerResponse]:
    receipt, _ = CustomerLedgerService(db).allocate_receipt(
        ctx, body.receipt_id, [a.model_dump() for a in body.allocations]
    )
    db.commit()
    data = CustomerLedgerService(db).get_entry(ctx, receipt.id)
    return APIResponse(message="Receipt allocated", data=data)


@ar_router.get("/{entry_id}", response_model=APIResponse[CustomerLedgerResponse])
def get_ar(
    entry_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ar:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CustomerLedgerResponse]:
    data = CustomerLedgerService(db).get_entry(ctx, entry_id)
    return APIResponse(message="AR entry retrieved", data=data)


@ar_router.get("/{entry_id}/payments", response_model=APIResponse[list[CustomerLedgerResponse]])
def list_ar_payments(
    entry_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ar:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[CustomerLedgerResponse]]:
    data = CustomerLedgerService(db).list_invoice_payments(ctx, entry_id)
    return APIResponse(message="Invoice payments retrieved", data=data)


@ar_router.patch("/{entry_id}", response_model=APIResponse[CustomerLedgerResponse])
def update_ar(
    entry_id: UUID,
    body: CustomerLedgerUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ar:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CustomerLedgerResponse]:
    CustomerLedgerService(db).update_entry(ctx, entry_id, **body.model_dump(exclude_unset=True))
    db.commit()
    data = CustomerLedgerService(db).get_entry(ctx, entry_id)
    return APIResponse(message="AR entry updated", data=data)


@ar_router.post("/{entry_id}/payment", response_model=APIResponse[CustomerLedgerResponse])
def ar_payment(
    entry_id: UUID,
    body: PaymentRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ar:payment"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CustomerLedgerResponse]:
    CustomerLedgerService(db).record_payment(ctx, entry_id, body.amount, receipt_id=body.receipt_id)
    db.commit()
    data = CustomerLedgerService(db).get_entry(ctx, entry_id)
    return APIResponse(message="AR payment recorded", data=data)


@ar_router.post("/{entry_id}/submit", response_model=APIResponse[CustomerLedgerResponse])
def ar_submit(
    entry_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ar:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CustomerLedgerResponse]:
    CustomerLedgerService(db).submit(ctx, entry_id)
    db.commit()
    return APIResponse(message="AR entry submitted", data=CustomerLedgerService(db).get_entry(ctx, entry_id))


@ar_router.post("/{entry_id}/approve", response_model=APIResponse[CustomerLedgerResponse])
def ar_approve(
    entry_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ar:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CustomerLedgerResponse]:
    CustomerLedgerService(db).approve(ctx, entry_id)
    db.commit()
    return APIResponse(message="AR entry approved", data=CustomerLedgerService(db).get_entry(ctx, entry_id))


@ar_router.post("/{entry_id}/cancel", response_model=APIResponse[CustomerLedgerResponse])
def ar_cancel(
    entry_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ar:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CustomerLedgerResponse]:
    CustomerLedgerService(db).cancel(ctx, entry_id)
    db.commit()
    return APIResponse(message="AR entry cancelled", data=CustomerLedgerService(db).get_entry(ctx, entry_id))


@ar_router.post("/{entry_id}/reverse", response_model=APIResponse[CustomerLedgerResponse])
def ar_reverse(
    entry_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ar:payment"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CustomerLedgerResponse]:
    CustomerLedgerService(db).reverse(ctx, entry_id)
    db.commit()
    return APIResponse(message="AR entry reversed", data=CustomerLedgerService(db).get_entry(ctx, entry_id))


@ap_router.get("/summary", response_model=APIResponse[ApSummaryResponse])
def ap_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ap:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[ApSummaryResponse]:
    data = VendorLedgerService(db).summary(ctx, company_id)
    return APIResponse(message="AP summary retrieved", data=data)


@ap_router.get("/aging", response_model=APIResponse[ApAgingReportResponse])
def ap_aging(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ap:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    as_of: date | None = None,
) -> APIResponse[ApAgingReportResponse]:
    data = VendorLedgerService(db).aging_report_response(ctx, company_id, as_of)
    return APIResponse(message="AP aging retrieved", data=data)


@ap_router.get("/vendors/{vendor_id}", response_model=APIResponse[ApVendorLedgerResponse])
def ap_vendor_ledger(
    vendor_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ap:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
) -> APIResponse[ApVendorLedgerResponse]:
    data = VendorLedgerService(db).vendor_ledger(
        ctx, vendor_id, company_id, from_date=from_date, to_date=to_date
    )
    return APIResponse(message="Vendor ledger retrieved", data=data)


@ap_router.get("")
def list_ap(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ap:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    vendor_id: UUID | None = None,
    document_type: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    workflow_status: Annotated[str | None, Query()] = None,
    currency_code: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
    from_date: date | None = None,
    to_date: date | None = None,
    due_from: date | None = None,
    due_to: date | None = None,
    overdue_only: Annotated[bool, Query()] = False,
    sort_by: Annotated[str, Query()] = "document_date",
    sort_dir: Annotated[str, Query()] = "desc",
    paged: Annotated[bool, Query()] = False,
) -> APIResponse[VendorLedgerListResponse | list[VendorLedgerResponse]]:
    """Default list stays an array for backward compatibility; use paged=true for enterprise UI."""
    svc = VendorLedgerService(db)
    items = svc.list_responses(
        ctx,
        company_id,
        vendor_id,
        document_type=document_type,
        status=status,
        workflow_status=workflow_status,
        currency_code=currency_code,
        search=q,
        from_date=from_date,
        to_date=to_date,
        due_from=due_from,
        due_to=due_to,
        overdue_only=overdue_only,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    page = paginate(items, pagination)
    total_outstanding = sum(float(i.outstanding_amount or i.balance_amount or 0) for i in items)
    total_paid = sum(float(i.paid_amount or 0) for i in items)
    total_balance = sum(float(i.balance_amount or 0) for i in items)
    if paged:
        return APIResponse(
            message="AP entries retrieved",
            data=VendorLedgerListResponse(
                items=page,
                total=len(items),
                page=pagination.page,
                page_size=pagination.page_size,
                total_outstanding=total_outstanding,
                total_paid=total_paid,
                total_balance=total_balance,
            ),
        )
    return APIResponse(message="AP entries retrieved", data=page)


@ap_router.post("", response_model=APIResponse[VendorLedgerResponse])
def create_ap(
    body: VendorLedgerCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ap:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[VendorLedgerResponse]:
    entry = VendorLedgerService(db).create_entry(ctx, **body.model_dump())
    db.commit()
    data = VendorLedgerService(db).get_entry(ctx, entry.id)
    return APIResponse(message="AP entry created", data=data)


@ap_router.post("/payments", response_model=APIResponse[VendorLedgerResponse])
def create_ap_payment(
    body: ApPaymentCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ap:payment"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[VendorLedgerResponse]:
    entry = VendorLedgerService(db).create_payment(
        ctx, **body.model_dump(exclude={"notes"}, exclude_none=False)
    )
    db.commit()
    data = VendorLedgerService(db).get_entry(ctx, entry.id)
    return APIResponse(message="Vendor payment created", data=data)


@ap_router.post("/allocate", response_model=APIResponse[VendorLedgerResponse])
def allocate_ap_payment(
    body: ApAllocateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ap:payment"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[VendorLedgerResponse]:
    payment, _ = VendorLedgerService(db).allocate_payment(
        ctx, body.payment_id, [a.model_dump() for a in body.allocations]
    )
    db.commit()
    data = VendorLedgerService(db).get_entry(ctx, payment.id)
    return APIResponse(message="Payment allocated", data=data)


@ap_router.get("/{entry_id}", response_model=APIResponse[VendorLedgerResponse])
def get_ap(
    entry_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ap:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[VendorLedgerResponse]:
    data = VendorLedgerService(db).get_entry(ctx, entry_id)
    return APIResponse(message="AP entry retrieved", data=data)


@ap_router.get("/{entry_id}/payments", response_model=APIResponse[list[VendorLedgerResponse]])
def list_ap_payments(
    entry_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ap:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[VendorLedgerResponse]]:
    data = VendorLedgerService(db).list_invoice_payments(ctx, entry_id)
    return APIResponse(message="Invoice payments retrieved", data=data)


@ap_router.patch("/{entry_id}", response_model=APIResponse[VendorLedgerResponse])
def update_ap(
    entry_id: UUID,
    body: VendorLedgerUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ap:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[VendorLedgerResponse]:
    VendorLedgerService(db).update_entry(ctx, entry_id, **body.model_dump(exclude_unset=True))
    db.commit()
    data = VendorLedgerService(db).get_entry(ctx, entry_id)
    return APIResponse(message="AP entry updated", data=data)


@ap_router.post("/{entry_id}/payment", response_model=APIResponse[VendorLedgerResponse])
def ap_payment(
    entry_id: UUID,
    body: PaymentRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ap:payment"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[VendorLedgerResponse]:
    VendorLedgerService(db).record_payment(
        ctx, entry_id, body.amount, payment_id=body.payment_id or body.receipt_id
    )
    db.commit()
    data = VendorLedgerService(db).get_entry(ctx, entry_id)
    return APIResponse(message="AP payment recorded", data=data)


@ap_router.post("/{entry_id}/submit", response_model=APIResponse[VendorLedgerResponse])
def ap_submit(
    entry_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ap:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[VendorLedgerResponse]:
    VendorLedgerService(db).submit(ctx, entry_id)
    db.commit()
    return APIResponse(message="AP entry submitted", data=VendorLedgerService(db).get_entry(ctx, entry_id))


@ap_router.post("/{entry_id}/approve", response_model=APIResponse[VendorLedgerResponse])
def ap_approve(
    entry_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ap:approve"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[VendorLedgerResponse]:
    VendorLedgerService(db).approve(ctx, entry_id)
    db.commit()
    return APIResponse(message="AP entry approved", data=VendorLedgerService(db).get_entry(ctx, entry_id))


@ap_router.post("/{entry_id}/cancel", response_model=APIResponse[VendorLedgerResponse])
def ap_cancel(
    entry_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ap:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[VendorLedgerResponse]:
    VendorLedgerService(db).cancel(ctx, entry_id)
    db.commit()
    return APIResponse(message="AP entry cancelled", data=VendorLedgerService(db).get_entry(ctx, entry_id))


@ap_router.post("/{entry_id}/reverse", response_model=APIResponse[VendorLedgerResponse])
def ap_reverse(
    entry_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.ap:payment"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[VendorLedgerResponse]:
    VendorLedgerService(db).reverse(ctx, entry_id)
    db.commit()
    return APIResponse(message="AP entry reversed", data=VendorLedgerService(db).get_entry(ctx, entry_id))
