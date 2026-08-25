"""SCM workspace routers — OVF queue, create vendor PO, GRN line updates."""

from typing import Annotated
from uuid import UUID

from core.exceptions import AppException
from fastapi import APIRouter, Depends, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database.session import get_db
from modules.crm.schemas import AttachmentResponse
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.schemas import (
    OrderResponse,
    ScmCommercialAttachmentCreate,
    ScmCommercialAttachmentSummary,
    ScmCreateInventoryPoRequest,
    ScmCreatePoFromOvfRequest,
    ScmFulfillFromStockRequest,
    ScmFulfillFromStockResponse,
    ScmInventoryDescriptionUpdate,
    ScmInventoryImportRequest,
    ScmInventorySerialUpdate,
    ScmLineReceiptUpdateRequest,
    ScmNextCompanyPoResponse,
    ScmOvfHoldRequest,
    ScmOvfPreviewResponse,
    ScmProcurementInventoryRowResponse,
    ScmQueueItemResponse,
    ScmReceiptBatchAttachmentCreate,
    ScmReceiptBatchAttachmentSummary,
    ScmReceiptBatchResponse,
    ScmReceiptBatchReverseRequest,
    ScmReceiptBatchVendorInvoiceUpdate,
    ScmUpdateOvfChargesRequest,
    ScmVendorInvoiceExtractRequest,
    ScmVendorInvoiceExtractResponse,
    ScmVendorPoResponse,
)
from modules.procurement.service.order_service import OrderService
from modules.procurement.service.scm_handoff_service import ScmHandoffService
from shared.schemas import APIResponse

scm_router = APIRouter(prefix="/scm", tags=["Procurement - SCM"])


@scm_router.get("/queue", response_model=APIResponse[list[ScmQueueItemResponse]])
def list_scm_queue(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[list[ScmQueueItemResponse]]:
    rows = ScmHandoffService(db).list_scm_queue(ctx, company_id)
    return APIResponse(
        message="SCM queue retrieved",
        data=[ScmQueueItemResponse.model_validate(r) for r in rows],
    )


@scm_router.get(
    "/company-po-numbers/next",
    response_model=APIResponse[ScmNextCompanyPoResponse],
)
def next_company_po_number(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
    entity_code: str,
    company_id: UUID | None = None,
) -> APIResponse[ScmNextCompanyPoResponse]:
    row = ScmHandoffService(db).peek_next_company_po(
        ctx, entity_code=entity_code, company_id=company_id
    )
    return APIResponse(
        message="Next company PO number",
        data=ScmNextCompanyPoResponse.model_validate(row),
    )


@scm_router.get("/ovf/{ovf_id}", response_model=APIResponse[ScmOvfPreviewResponse])
def get_scm_ovf_preview(
    ovf_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmOvfPreviewResponse]:
    row = ScmHandoffService(db).get_ovf_preview(ctx, ovf_id)
    return APIResponse(
        message="OVF preview retrieved",
        data=ScmOvfPreviewResponse.model_validate(row),
    )


@scm_router.get(
    "/ovf/{ovf_id}/attachments",
    response_model=APIResponse[list[ScmCommercialAttachmentSummary]],
)
def list_scm_ovf_attachments(
    ovf_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[ScmCommercialAttachmentSummary]]:
    rows = ScmHandoffService(db).list_ovf_attachments(ctx, ovf_id)
    return APIResponse(
        message="OVF documents retrieved",
        data=[ScmCommercialAttachmentSummary.model_validate(r) for r in rows],
    )


@scm_router.post(
    "/ovf/{ovf_id}/attachments",
    response_model=APIResponse[AttachmentResponse],
)
def create_scm_ovf_attachment(
    ovf_id: UUID,
    body: ScmCommercialAttachmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[AttachmentResponse]:
    row = ScmHandoffService(db).attach_ovf_document(
        ctx,
        ovf_id,
        file_name=body.file_name,
        content_base64=body.content_base64,
        content_type=body.content_type,
        branch_id=body.branch_id,
        company_id=body.company_id,
        category=body.category,
        remarks=body.remarks,
    )
    db.commit()
    return APIResponse(message="OVF document attached", data=AttachmentResponse.model_validate(row))


@scm_router.get(
    "/orders/{order_id}/attachments",
    response_model=APIResponse[list[ScmCommercialAttachmentSummary]],
)
def list_scm_po_attachments(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[ScmCommercialAttachmentSummary]]:
    rows = ScmHandoffService(db).list_po_attachments(ctx, order_id)
    return APIResponse(
        message="PO documents retrieved",
        data=[ScmCommercialAttachmentSummary.model_validate(r) for r in rows],
    )


@scm_router.get(
    "/orders/{order_id}/commercial-documents",
    response_model=APIResponse[list[ScmCommercialAttachmentSummary]],
)
def list_scm_order_commercial_documents(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[ScmCommercialAttachmentSummary]]:
    rows = ScmHandoffService(db).list_commercial_documents_for_order(ctx, order_id)
    return APIResponse(
        message="Commercial documents retrieved",
        data=[ScmCommercialAttachmentSummary.model_validate(r) for r in rows],
    )


@scm_router.post(
    "/orders/{order_id}/attachments",
    response_model=APIResponse[AttachmentResponse],
)
def create_scm_po_attachment(
    order_id: UUID,
    body: ScmCommercialAttachmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[AttachmentResponse]:
    row = ScmHandoffService(db).attach_po_document(
        ctx,
        order_id,
        file_name=body.file_name,
        content_base64=body.content_base64,
        content_type=body.content_type,
        branch_id=body.branch_id,
        company_id=body.company_id,
        category=body.category,
        remarks=body.remarks,
    )
    db.commit()
    return APIResponse(message="PO document attached", data=AttachmentResponse.model_validate(row))


@scm_router.get("/commercial-attachments/{attachment_id}/content")
def download_scm_commercial_attachment(
    attachment_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    path, file_name, content_type = ScmHandoffService(db).resolve_commercial_attachment_file(
        ctx, attachment_id
    )
    return FileResponse(
        path=path,
        filename=file_name,
        media_type=content_type or "application/octet-stream",
        content_disposition_type="inline",
    )


@scm_router.post("/ovf/{ovf_id}/hold", response_model=APIResponse[ScmOvfPreviewResponse])
def hold_scm_ovf(
    ovf_id: UUID,
    body: ScmOvfHoldRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmOvfPreviewResponse]:
    row = ScmHandoffService(db).hold_ovf(ctx, ovf_id, remark=body.remark)
    db.commit()
    return APIResponse(
        message="OVF placed on Hold",
        data=ScmOvfPreviewResponse.model_validate(row),
    )


@scm_router.post("/ovf/{ovf_id}/release-hold", response_model=APIResponse[ScmOvfPreviewResponse])
def release_scm_ovf_hold(
    ovf_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmOvfPreviewResponse]:
    row = ScmHandoffService(db).release_ovf_hold(ctx, ovf_id)
    db.commit()
    return APIResponse(
        message="OVF removed from SCM hold",
        data=ScmOvfPreviewResponse.model_validate(row),
    )


@scm_router.patch("/ovf/{ovf_id}/charges", response_model=APIResponse[ScmOvfPreviewResponse])
def update_scm_ovf_charges(
    ovf_id: UUID,
    body: ScmUpdateOvfChargesRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmOvfPreviewResponse]:
    row = ScmHandoffService(db).update_ovf_charges(
        ctx,
        ovf_id,
        freight=body.freight,
        additional_charges=body.additional_charges,
        finance_cost_pct=body.finance_cost_pct,
    )
    db.commit()
    return APIResponse(
        message="OVF freight and finance updated",
        data=ScmOvfPreviewResponse.model_validate(row),
    )


@scm_router.post(
    "/ovf/{ovf_id}/fulfill-from-stock",
    response_model=APIResponse[ScmFulfillFromStockResponse],
)
def fulfill_ovf_from_stock(
    ovf_id: UUID,
    body: ScmFulfillFromStockRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmFulfillFromStockResponse]:
    row = ScmHandoffService(db).fulfill_ovf_from_stock(
        ctx,
        ovf_id,
        [line.model_dump() for line in body.lines],
    )
    db.commit()
    return APIResponse(
        message="OVF demand allocated from inventory stock",
        data=ScmFulfillFromStockResponse.model_validate(row),
    )


@scm_router.post("/ovf/{ovf_id}/purchase-orders", response_model=APIResponse[OrderResponse])
def create_po_from_ovf(
    ovf_id: UUID,
    body: ScmCreatePoFromOvfRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[OrderResponse]:
    row = ScmHandoffService(db).create_po_from_ovf(ctx, ovf_id=ovf_id, **body.model_dump())
    db.commit()
    return APIResponse(
        message="Vendor purchase order created from OVF",
        data=OrderResponse.model_validate(row),
    )


@scm_router.post("/orders/{order_id}/finalize", response_model=APIResponse[OrderResponse])
def finalize_scm_order(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:send"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[OrderResponse]:
    row = ScmHandoffService(db).finalize_scm_po(ctx, order_id)
    db.commit()
    return APIResponse(message="SCM purchase order finalized", data=OrderResponse.model_validate(row))


@scm_router.get("/vendor-pos", response_model=APIResponse[list[ScmVendorPoResponse]])
def list_vendor_pos(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[list[ScmVendorPoResponse]]:
    rows = ScmHandoffService(db).list_vendor_pos(ctx, company_id)
    return APIResponse(
        message="Vendor POs retrieved",
        data=[ScmVendorPoResponse.model_validate(r) for r in rows],
    )


@scm_router.get(
    "/inventory",
    response_model=APIResponse[list[ScmProcurementInventoryRowResponse]],
)
def list_procurement_inventory(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[list[ScmProcurementInventoryRowResponse]]:
    rows = ScmHandoffService(db).list_procurement_inventory(ctx, company_id)
    return APIResponse(
        message="Procurement inventory retrieved",
        data=[ScmProcurementInventoryRowResponse.model_validate(r) for r in rows],
    )


@scm_router.post(
    "/inventory/clear-stock",
    response_model=APIResponse[dict],
)
def clear_procurement_inventory_stock(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[dict]:
    removed = ScmHandoffService(db).clear_procurement_inventory_stock(ctx, company_id)
    db.commit()
    return APIResponse(
        message="Procurement stock cleared",
        data={"removed": removed},
    )


@scm_router.post(
    "/inventory/import",
    response_model=APIResponse[dict],
)
def import_procurement_inventory(
    body: ScmInventoryImportRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[dict]:
    count = ScmHandoffService(db).import_inventory_lines(
        ctx,
        [line.model_dump() for line in body.lines],
        company_id=company_id,
    )
    db.commit()
    return APIResponse(message="Inventory imported", data={"imported": count})


@scm_router.patch(
    "/inventory/stock-units/{unit_id}/serial",
    response_model=APIResponse[dict],
)
def update_inventory_stock_serial(
    unit_id: UUID,
    body: ScmInventorySerialUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    ScmHandoffService(db).update_inventory_stock_serial(
        ctx,
        unit_id,
        serial_number=body.serial_number,
    )
    db.commit()
    return APIResponse(message="Serial number updated", data={"updated": True})


@scm_router.patch(
    "/inventory/import-lines/{line_id}/serial",
    response_model=APIResponse[dict],
)
def update_inventory_import_serial(
    line_id: UUID,
    body: ScmInventorySerialUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    ScmHandoffService(db).update_inventory_import_serial(
        ctx,
        line_id,
        serial_number=body.serial_number,
    )
    db.commit()
    return APIResponse(message="Serial number updated", data={"updated": True})


@scm_router.patch(
    "/inventory/order-lines/{line_id}/description",
    response_model=APIResponse[dict],
)
def update_inventory_order_line_description(
    line_id: UUID,
    body: ScmInventoryDescriptionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    ScmHandoffService(db).update_inventory_order_line_description(
        ctx,
        line_id,
        description=body.description,
    )
    db.commit()
    return APIResponse(message="Description updated", data={"updated": True})


@scm_router.post(
    "/inventory/purchase-orders",
    response_model=APIResponse[OrderResponse],
)
def create_po_from_inventory(
    body: ScmCreateInventoryPoRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:create"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[OrderResponse]:
    row = ScmHandoffService(db).create_po_from_inventory(
        ctx,
        vendor_id=body.vendor_id,
        entity_code=body.entity_code,
        document_date=body.document_date,
        currency_code=body.currency_code,
        payment_terms=body.payment_terms,
        expected_delivery_date=body.expected_delivery_date,
        company_id=company_id,
        lines=[line.model_dump() for line in body.lines],
        approved_by_name=body.approved_by_name,
        order_ref_cache=body.order_ref_cache,
        stock_unit_ids=list(body.stock_unit_ids or []),
        import_line_ids=list(body.import_line_ids or []),
    )
    db.commit()
    return APIResponse(
        message="Purchase order created",
        data=OrderService(db).get_order_response(ctx, row.id),
    )


@scm_router.get(
    "/orders/{order_id}/receipt-batches",
    response_model=APIResponse[list[ScmReceiptBatchResponse]],
)
def list_order_receipt_batches(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[ScmReceiptBatchResponse]]:
    try:
        rows = ScmHandoffService(db).list_receipt_batches(ctx, order_id)
        validated: list[ScmReceiptBatchResponse] = []
        for row in rows:
            try:
                validated.append(ScmReceiptBatchResponse.model_validate(row))
            except Exception:
                row = {**row, "attachments": []}
                validated.append(ScmReceiptBatchResponse.model_validate(row))
        return APIResponse(
            message="Receipt batches retrieved",
            data=validated,
        )
    except AppException:
        raise
    except Exception as exc:
        raise AppException(
            f"Failed to load GRN receipt batches: {exc}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        ) from exc


@scm_router.post(
    "/receipt-batches/{batch_id}/reverse",
    response_model=APIResponse[ScmReceiptBatchResponse],
)
def reverse_receipt_batch(
    batch_id: UUID,
    body: ScmReceiptBatchReverseRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.grn:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmReceiptBatchResponse]:
    row = ScmHandoffService(db).reverse_receipt_batch(ctx, batch_id, reason=body.reason)
    db.commit()
    return APIResponse(
        message="GRN reversed",
        data=ScmReceiptBatchResponse.model_validate(row),
    )


@scm_router.patch(
    "/orders/{order_id}/lines/{line_id}/receipt",
    response_model=APIResponse[OrderResponse],
)
def update_line_receipt(
    order_id: UUID,
    line_id: UUID,
    body: ScmLineReceiptUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.grn:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[OrderResponse]:
    ScmHandoffService(db).update_line_receipt(
        ctx,
        order_id,
        line_id,
        quantity_received=body.quantity_received,
        grn_status=body.grn_status,
        serial_numbers=body.serial_numbers,
        billing=body.billing,
        billing_quantity=body.billing_quantity,
    )
    db.commit()
    data = OrderService(db).get_order_response(ctx, order_id, enrich_commercial=True)
    return APIResponse(message="GRN line updated", data=data)


@scm_router.post(
    "/vendor-invoice/extract",
    response_model=APIResponse[ScmVendorInvoiceExtractResponse],
)
def extract_vendor_invoice_fields(
    body: ScmVendorInvoiceExtractRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.grn:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmVendorInvoiceExtractResponse]:
    del ctx
    try:
        fields = ScmHandoffService(db).extract_vendor_invoice(
            file_name=body.file_name,
            content_base64=body.content_base64,
        )
    except ValueError as exc:
        raise AppException(str(exc), status_code=400) from exc
    return APIResponse(
        message="Vendor invoice fields extracted",
        data=ScmVendorInvoiceExtractResponse.model_validate(fields),
    )


@scm_router.patch(
    "/receipt-batches/{batch_id}/vendor-invoice",
    response_model=APIResponse[ScmReceiptBatchResponse],
)
def update_receipt_batch_vendor_invoice(
    batch_id: UUID,
    body: ScmReceiptBatchVendorInvoiceUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.grn:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmReceiptBatchResponse]:
    batch = ScmHandoffService(db).update_receipt_batch_vendor_invoice(
        ctx,
        batch_id,
        vendor_invoice_number=body.vendor_invoice_number,
        vendor_invoice_date=body.vendor_invoice_date,
        vendor_invoice_quantity=body.vendor_invoice_quantity,
        vendor_invoice_subtotal=body.vendor_invoice_subtotal,
        file_name=body.file_name,
        content_base64=body.content_base64,
        content_type=body.content_type,
        branch_id=body.branch_id,
        company_id=body.company_id,
    )
    db.commit()
    payload = {
        "id": batch.id,
        "sequence": int(batch.sequence),
        "grn_number": batch.grn_number,
        "receipt_at": batch.receipt_at,
        "lines": [],
        **ScmHandoffService._vendor_invoice_batch_fields(batch),
    }
    return APIResponse(
        message="Vendor invoice saved",
        data=ScmReceiptBatchResponse.model_validate(payload),
    )


@scm_router.post(
    "/receipt-batches/{batch_id}/attachments",
    response_model=APIResponse[AttachmentResponse],
)
def create_receipt_batch_attachment(
    batch_id: UUID,
    body: ScmReceiptBatchAttachmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.grn:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[AttachmentResponse]:
    row = ScmHandoffService(db).attach_receipt_batch_document(
        ctx,
        batch_id,
        file_name=body.file_name,
        content_base64=body.content_base64,
        content_type=body.content_type,
        branch_id=body.branch_id,
        company_id=body.company_id,
    )
    db.commit()
    return APIResponse(message="GRN document attached", data=AttachmentResponse.model_validate(row))


@scm_router.get(
    "/receipt-batches/{batch_id}/attachments",
    response_model=APIResponse[list[ScmReceiptBatchAttachmentSummary]],
)
def list_receipt_batch_attachments(
    batch_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.grn:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[ScmReceiptBatchAttachmentSummary]]:
    rows = ScmHandoffService(db).list_receipt_batch_attachments(ctx, batch_id)
    return APIResponse(
        message="GRN documents retrieved",
        data=[
            ScmReceiptBatchAttachmentSummary(
                id=r.id,
                file_name=r.file_name,
                content_type=r.content_type,
                size=r.size,
            )
            for r in rows
        ],
    )


@scm_router.get("/receipt-batch-attachments/{attachment_id}/content")
def download_receipt_batch_attachment(
    attachment_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.grn:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    path, file_name, content_type = ScmHandoffService(db).resolve_receipt_batch_attachment_file(
        ctx, attachment_id
    )
    return FileResponse(
        path=path,
        filename=file_name,
        media_type=content_type or "application/octet-stream",
        content_disposition_type="inline",
    )
