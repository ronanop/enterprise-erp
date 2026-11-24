"""SCM workspace routers - OVF queue, create vendor PO, GRN line updates."""

from typing import Annotated
from uuid import UUID

from core.exceptions import AppException
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session

from database.session import get_db
from modules.crm.schemas import AttachmentResponse
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.schemas import (
    OrderResponse,
    ProcApprovalCapabilitiesResponse,
    ProcApprovalStepOwnersGroup,
    ProcApprovalStepOwnersReplaceRequest,
    ProcInvoiceGenerationTaskCreateRequest,
    ProcInvoiceGenerationTaskResponse,
    ProcInvoiceGenerationTaskSubmitRequest,
    ScmCommercialAttachmentCreate,
    ScmCommercialAttachmentSummary,
    ScmCreateInventoryPoRequest,
    ScmCreatePoFromOvfRequest,
    ScmCorrespondenceDeliveryResponse,
    ScmCorrespondenceTemplateResponse,
    ScmCorrespondenceTemplateUpsertRequest,
    ScmDeliveryContactResponse,
    ScmDeliveryNotificationRunResponse,
    ScmDummyDeliverySendRequest,
    ScmDummyDeliverySendResponse,
    ScmEtdUpdateRequest,
    ScmEtdUpdateResponse,
    ScmFinalizeApprovalRequest,
    ScmFinalizeApprovalResponse,
    ScmChargeApprovalResponse,
    ScmHoldApprovalResponse,
    ScmFinalizeRequest,
    ScmCustomerDeliveryUpsertRequest,
    ScmCustomerPodUploadRequest,
    ScmFulfillFromStockRequest,
    ScmFulfillFromStockResponse,
    ScmFulfillmentCustomerMailRequest,
    ScmFulfillmentSendToVendorRequest,
    ScmFulfillmentStateResponse,
    ScmFulfillmentVendorResponseRequest,
    ScmVendorDispatchCreateRequest,
    ScmInventoryConsumeUnitsRequest,
    ScmInventoryDescriptionUpdate,
    ScmInventoryImportRequest,
    ScmInventorySerialUpdate,
    ScmItemPlanVendorUpdateRequest,
    ScmLineReceiptUpdateRequest,
    ScmNegotiationDecisionRequest,
    ScmNegotiationResponse,
    ScmNegotiationSubmitRequest,
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
    OvfTimelineListItemResponse,
    OvfTimelineEventRecordRequest,
    OvfTimelineResponse,
)
from modules.procurement.service.approval_step_owner_service import ProcApprovalStepOwnerService
from modules.procurement.service.invoice_generation_task_service import (
    ProcInvoiceGenerationTaskService,
)
from modules.procurement.service.order_service import OrderService
from modules.procurement.service.ovf_timeline_service import OvfTimelineService
from modules.procurement.service.scm_delivery_notification_service import (
    ScmDeliveryNotificationService,
)
from modules.procurement.service.scm_fulfillment_service import ScmFulfillmentService
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


@scm_router.get("/timeline/ovfs", response_model=APIResponse[list[OvfTimelineListItemResponse]])
def list_ovf_timeline_rows(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[list[OvfTimelineListItemResponse]]:
    rows = OvfTimelineService(db).list_ovfs(ctx, company_id)
    return APIResponse(
        message="OVF timeline list retrieved",
        data=[OvfTimelineListItemResponse.model_validate(r) for r in rows],
    )


@scm_router.get("/timeline/ovf/{ovf_id}", response_model=APIResponse[OvfTimelineResponse])
def get_ovf_timeline(
    ovf_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[OvfTimelineResponse]:
    row = OvfTimelineService(db).timeline(ctx, ovf_id)
    return APIResponse(message="OVF timeline retrieved", data=OvfTimelineResponse.model_validate(row))


@scm_router.post(
    "/timeline/ovf/{ovf_id}/events",
    response_model=APIResponse[dict],
    status_code=status.HTTP_201_CREATED,
)
def record_ovf_timeline_event(
    ovf_id: UUID,
    body: OvfTimelineEventRecordRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    OvfTimelineService(db).record_event(
        ctx,
        ovf_id,
        action=body.action,
        title=body.title,
        summary=body.summary,
        entity_label=body.entity_label,
        occurred_at=body.occurred_at,
        metadata=body.metadata,
    )
    return APIResponse(message="OVF timeline event recorded", data={"recorded": True})


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
    # Read is enough so View OVF / Approval can persist the auto OVF PDF pack.
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
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
    download: Annotated[bool, Query(description="Force download instead of inline view")] = False,
):
    from io import BytesIO

    from fastapi.responses import StreamingResponse

    path, file_name, content_type, external_url, content = ScmHandoffService(
        db
    ).resolve_commercial_attachment_file(ctx, attachment_id)
    if external_url:
        return RedirectResponse(url=external_url, status_code=status.HTTP_302_FOUND)
    from shared.upload_safety import content_disposition_type

    media = content_type or "application/octet-stream"
    # Never inline active content; only PDF/images may render in-browser.
    disposition = (
        "attachment"
        if download
        else content_disposition_type(file_name, content_type)
    )
    headers = {"X-Content-Type-Options": "nosniff"}
    if content is not None:
        return StreamingResponse(
            BytesIO(content),
            media_type=media,
            headers={
                **headers,
                "Content-Disposition": f'{disposition}; filename="{file_name}"',
            },
        )
    assert path is not None
    return FileResponse(
        path=path,
        filename=file_name,
        media_type=media,
        content_disposition_type=disposition,
        headers=headers,
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
        message="Hold request sent to the Hold approvers",
        data=ScmOvfPreviewResponse.model_validate(row),
    )


@scm_router.get(
    "/hold-approvals",
    response_model=APIResponse[list[ScmHoldApprovalResponse]],
)
def list_scm_hold_approvals(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[ScmHoldApprovalResponse]]:
    rows = ScmHandoffService(db).list_hold_requests(ctx)
    return APIResponse(
        message="SCM hold approvals retrieved",
        data=[ScmHoldApprovalResponse.model_validate(row) for row in rows],
    )


@scm_router.post(
    "/ovf/{ovf_id}/accept-hold",
    response_model=APIResponse[ScmOvfPreviewResponse],
)
def accept_scm_ovf_hold(
    ovf_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:approve"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmOvfPreviewResponse]:
    row = ScmHandoffService(db).accept_ovf_hold(ctx, ovf_id)
    db.commit()
    return APIResponse(message="OVF hold approved", data=ScmOvfPreviewResponse.model_validate(row))


@scm_router.post(
    "/ovf/{ovf_id}/reject-hold",
    response_model=APIResponse[ScmOvfPreviewResponse],
)
def reject_scm_ovf_hold(
    ovf_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:approve"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmOvfPreviewResponse]:
    row = ScmHandoffService(db).reject_ovf_hold(ctx, ovf_id)
    db.commit()
    return APIResponse(message="OVF hold rejected", data=ScmOvfPreviewResponse.model_validate(row))


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
        message="Freight and finance sent for approval",
        data=ScmOvfPreviewResponse.model_validate(row),
    )


@scm_router.get(
    "/charge-approvals",
    response_model=APIResponse[list[ScmChargeApprovalResponse]],
)
def list_scm_charge_approvals(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[ScmChargeApprovalResponse]]:
    rows = ScmHandoffService(db).list_charge_requests(ctx)
    return APIResponse(
        message="Freight and finance approvals retrieved",
        data=[ScmChargeApprovalResponse.model_validate(row) for row in rows],
    )


@scm_router.post(
    "/ovf/{ovf_id}/accept-charges",
    response_model=APIResponse[ScmOvfPreviewResponse],
)
def accept_scm_ovf_charges(
    ovf_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:approve"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmOvfPreviewResponse]:
    row = ScmHandoffService(db).accept_ovf_charges(ctx, ovf_id)
    db.commit()
    return APIResponse(
        message="Freight and finance approved",
        data=ScmOvfPreviewResponse.model_validate(row),
    )


@scm_router.post(
    "/ovf/{ovf_id}/reject-charges",
    response_model=APIResponse[ScmOvfPreviewResponse],
)
def reject_scm_ovf_charges(
    ovf_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:approve"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmOvfPreviewResponse]:
    row = ScmHandoffService(db).reject_ovf_charges(ctx, ovf_id)
    db.commit()
    return APIResponse(
        message="Freight and finance rejected",
        data=ScmOvfPreviewResponse.model_validate(row),
    )


@scm_router.patch(
    "/ovf/{ovf_id}/item-plan-vendor",
    response_model=APIResponse[ScmOvfPreviewResponse],
)
def update_scm_item_plan_vendor(
    ovf_id: UUID,
    body: ScmItemPlanVendorUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmOvfPreviewResponse]:
    row = ScmHandoffService(db).update_item_plan_vendor(
        ctx,
        ovf_id,
        product_name=body.product_name,
        line_index=body.line_index,
        distributor_name=body.distributor_name,
    )
    db.commit()
    return APIResponse(
        message="Item plan vendor updated",
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


@scm_router.get(
    "/orders/{order_id}/negotiation",
    response_model=APIResponse[ScmNegotiationResponse],
)
def get_scm_negotiation(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmNegotiationResponse]:
    row = ScmHandoffService(db).negotiation_summary(ctx, order_id)
    return APIResponse(
        message="Negotiation summary retrieved",
        data=ScmNegotiationResponse.model_validate(row),
    )


@scm_router.post(
    "/orders/{order_id}/negotiation/submit",
    response_model=APIResponse[ScmNegotiationResponse],
)
def submit_scm_negotiation(
    order_id: UUID,
    body: ScmNegotiationSubmitRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmNegotiationResponse]:
    row = ScmHandoffService(db).submit_negotiation(ctx, order_id, remark=body.remark)
    db.commit()
    return APIResponse(
        message="Negotiated price sent to Management for approval",
        data=ScmNegotiationResponse.model_validate(row),
    )


@scm_router.post(
    "/orders/{order_id}/negotiation/decide",
    response_model=APIResponse[ScmNegotiationResponse],
)
def decide_scm_negotiation(
    order_id: UUID,
    body: ScmNegotiationDecisionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:approve"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmNegotiationResponse]:
    row = ScmHandoffService(db).decide_negotiation(
        ctx, order_id, decision=body.decision, remark=body.remark
    )
    db.commit()
    return APIResponse(
        message=f"Negotiated price {body.decision}",
        data=ScmNegotiationResponse.model_validate(row),
    )


@scm_router.patch("/orders/{order_id}/etd", response_model=APIResponse[ScmEtdUpdateResponse])
def update_scm_expected_delivery_date(
    order_id: UUID,
    body: ScmEtdUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmEtdUpdateResponse]:
    row = ScmDeliveryNotificationService(db).set_expected_delivery_date(
        ctx,
        order_id,
        expected_delivery_date=body.expected_delivery_date,
        notify_customer=body.notify_customer,
    )
    db.commit()
    return APIResponse(
        message="Expected delivery date updated",
        data=ScmEtdUpdateResponse.model_validate(row),
    )


@scm_router.get(
    "/orders/{order_id}/delivery-contact",
    response_model=APIResponse[ScmDeliveryContactResponse],
)
def get_scm_delivery_contact(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmDeliveryContactResponse]:
    row = ScmDeliveryNotificationService(db).get_delivery_contact(ctx, order_id)
    return APIResponse(
        message="Delivery contact retrieved",
        data=ScmDeliveryContactResponse.model_validate(row),
    )


@scm_router.post(
    "/orders/{order_id}/delivery-acknowledgement/send",
    response_model=APIResponse[ScmDummyDeliverySendResponse],
)
def send_scm_delivery_acknowledgement(
    order_id: UUID,
    body: ScmDummyDeliverySendRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmDummyDeliverySendResponse]:
    """Email order acknowledgement via SMTP (includes ETD) and unlock Record GRN."""
    row = ScmDeliveryNotificationService(db).send_acknowledgement(
        ctx,
        order_id,
        email=body.email,
        expected_delivery_date=body.expected_delivery_date,
    )
    db.commit()
    return APIResponse(
        message=row["message"],
        data=ScmDummyDeliverySendResponse.model_validate(row),
    )


@scm_router.post(
    "/orders/{order_id}/delivery-acknowledgement/dummy-send",
    response_model=APIResponse[ScmDummyDeliverySendResponse],
    deprecated=True,
)
def dummy_send_scm_delivery_acknowledgement(
    order_id: UUID,
    body: ScmDummyDeliverySendRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmDummyDeliverySendResponse]:
    """Compatibility alias for /delivery-acknowledgement/send."""
    return send_scm_delivery_acknowledgement(order_id, body, ctx, db)


@scm_router.get(
    "/orders/{order_id}/fulfillment",
    response_model=APIResponse[ScmFulfillmentStateResponse],
)
def get_scm_order_fulfillment(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmFulfillmentStateResponse]:
    row = ScmFulfillmentService(db).get_fulfillment(ctx, order_id)
    db.commit()
    return APIResponse(
        message="Fulfillment state retrieved",
        data=ScmFulfillmentStateResponse.model_validate(row),
    )


@scm_router.post(
    "/orders/{order_id}/fulfillment/send-to-vendor",
    response_model=APIResponse[ScmFulfillmentStateResponse],
)
def send_scm_po_to_vendor(
    order_id: UUID,
    body: ScmFulfillmentSendToVendorRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmFulfillmentStateResponse]:
    row = ScmFulfillmentService(db).send_to_vendor(
        ctx,
        order_id,
        email=body.email,
        po_pdf_base64=body.po_pdf_base64,
        po_pdf_filename=body.po_pdf_filename,
    )
    db.commit()
    return APIResponse(
        message="Purchase order sent to vendor",
        data=ScmFulfillmentStateResponse.model_validate(row),
    )


@scm_router.post(
    "/orders/{order_id}/fulfillment/vendor-response",
    response_model=APIResponse[ScmFulfillmentStateResponse],
)
def record_scm_vendor_response(
    order_id: UUID,
    body: ScmFulfillmentVendorResponseRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmFulfillmentStateResponse]:
    row = ScmFulfillmentService(db).record_vendor_response(
        ctx,
        order_id,
        status=body.status,
        remark=body.remark,
        expected_delivery_date=body.expected_delivery_date,
    )
    db.commit()
    return APIResponse(
        message=f"Vendor response recorded: {body.status}",
        data=ScmFulfillmentStateResponse.model_validate(row),
    )


@scm_router.post(
    "/orders/{order_id}/fulfillment/send-customer-order-processed",
    response_model=APIResponse[ScmFulfillmentStateResponse],
)
def send_scm_customer_order_processed(
    order_id: UUID,
    body: ScmFulfillmentCustomerMailRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmFulfillmentStateResponse]:
    row = ScmFulfillmentService(db).send_customer_order_processed(
        ctx, order_id, email=body.email
    )
    db.commit()
    return APIResponse(
        message="Customer order-processed mail sent",
        data=ScmFulfillmentStateResponse.model_validate(row),
    )


@scm_router.post(
    "/orders/{order_id}/fulfillment/vendor-dispatches",
    response_model=APIResponse[ScmFulfillmentStateResponse],
)
def create_scm_vendor_dispatch(
    order_id: UUID,
    body: ScmVendorDispatchCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmFulfillmentStateResponse]:
    row = ScmFulfillmentService(db).create_vendor_dispatch(
        ctx,
        order_id,
        dc_number=body.dc_number,
        invoice_number=body.invoice_number,
        lr_awb_number=body.lr_awb_number,
        dispatch_date=body.dispatch_date,
        eway_notes=body.eway_notes,
        transport_notes=body.transport_notes,
        attachment_refs=body.attachment_refs,
        lines=[ln.model_dump() for ln in body.lines],
    )
    db.commit()
    return APIResponse(
        message="Vendor dispatch recorded",
        data=ScmFulfillmentStateResponse.model_validate(row),
    )


@scm_router.post(
    "/orders/{order_id}/fulfillment/customer-delivery",
    response_model=APIResponse[ScmFulfillmentStateResponse],
)
def upsert_scm_customer_delivery(
    order_id: UUID,
    body: ScmCustomerDeliveryUpsertRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmFulfillmentStateResponse]:
    meta = body.model_dump(exclude={"mark_ready"}, exclude_none=True)
    row = ScmFulfillmentService(db).upsert_customer_delivery(
        ctx, order_id, meta=meta, mark_ready=body.mark_ready
    )
    db.commit()
    return APIResponse(
        message="Customer delivery details saved",
        data=ScmFulfillmentStateResponse.model_validate(row),
    )


@scm_router.post(
    "/orders/{order_id}/fulfillment/share-customer-dispatch",
    response_model=APIResponse[ScmFulfillmentStateResponse],
)
def share_scm_customer_dispatch(
    order_id: UUID,
    body: ScmFulfillmentCustomerMailRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmFulfillmentStateResponse]:
    row = ScmFulfillmentService(db).share_customer_dispatch(
        ctx, order_id, email=body.email
    )
    db.commit()
    return APIResponse(
        message="Customer dispatch details shared",
        data=ScmFulfillmentStateResponse.model_validate(row),
    )


@scm_router.post(
    "/orders/{order_id}/fulfillment/customer-pod",
    response_model=APIResponse[ScmFulfillmentStateResponse],
)
def upload_scm_customer_pod(
    order_id: UUID,
    body: ScmCustomerPodUploadRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmFulfillmentStateResponse]:
    pod_ref = None
    if body.pod_file_name or body.pod_content_base64:
        pod_ref = {
            "file_name": body.pod_file_name,
            "content_base64": body.pod_content_base64,
            "uploaded_at": None,
        }
    row = ScmFulfillmentService(db).upload_customer_pod(
        ctx, order_id, pod_ref=pod_ref, note=body.note
    )
    db.commit()
    return APIResponse(
        message="Customer POD recorded",
        data=ScmFulfillmentStateResponse.model_validate(row),
    )


@scm_router.post(
    "/delivery-notifications/run",
    response_model=APIResponse[ScmDeliveryNotificationRunResponse],
)
def run_scm_delivery_notifications(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmDeliveryNotificationRunResponse]:
    """Manual trigger for the same pass the scheduled job runs."""
    counts = ScmDeliveryNotificationService(db).run(ctx)
    db.commit()
    return APIResponse(
        message="Delivery notifications processed",
        data=ScmDeliveryNotificationRunResponse.model_validate(counts),
    )


@scm_router.get(
    "/orders/{order_id}/correspondence",
    response_model=APIResponse[list[ScmCorrespondenceDeliveryResponse]],
)
def list_order_correspondence(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[ScmCorrespondenceDeliveryResponse]]:
    rows = ScmDeliveryNotificationService(db).list_order_correspondence(ctx, order_id)
    return APIResponse(
        message="Order correspondence retrieved",
        data=[ScmCorrespondenceDeliveryResponse.model_validate(r) for r in rows],
    )


@scm_router.get(
    "/correspondence",
    response_model=APIResponse[list[ScmCorrespondenceDeliveryResponse]],
)
def list_all_correspondence(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(default=200, ge=1, le=500),
) -> APIResponse[list[ScmCorrespondenceDeliveryResponse]]:
    rows = ScmDeliveryNotificationService(db).list_recent_correspondence(ctx, limit=limit)
    return APIResponse(
        message="Correspondence retrieved",
        data=[ScmCorrespondenceDeliveryResponse.model_validate(r) for r in rows],
    )


@scm_router.get(
    "/correspondence/templates",
    response_model=APIResponse[list[ScmCorrespondenceTemplateResponse]],
)
def list_correspondence_templates(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
    order_id: UUID | None = Query(default=None),
    company_account_id: UUID | None = Query(default=None),
) -> APIResponse[list[ScmCorrespondenceTemplateResponse]]:
    svc = ScmDeliveryNotificationService(db)
    if order_id is not None:
        rows = svc.list_templates_for_order(ctx, order_id)
    else:
        rows = svc.list_templates(ctx, company_account_id=company_account_id)
    db.commit()
    return APIResponse(
        message="Correspondence templates retrieved",
        data=[ScmCorrespondenceTemplateResponse.model_validate(r) for r in rows],
    )


@scm_router.put(
    "/correspondence/templates",
    response_model=APIResponse[ScmCorrespondenceTemplateResponse],
)
def upsert_correspondence_template(
    body: ScmCorrespondenceTemplateUpsertRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmCorrespondenceTemplateResponse]:
    row = ScmDeliveryNotificationService(db).upsert_template(
        ctx,
        kind=body.kind,
        subject_template=body.subject_template,
        body_template=body.body_template,
        company_account_id=body.company_account_id,
    )
    db.commit()
    return APIResponse(
        message="Correspondence template saved",
        data=ScmCorrespondenceTemplateResponse.model_validate(row),
    )


@scm_router.get(
    "/approval-step-owners",
    response_model=APIResponse[list[ProcApprovalStepOwnersGroup]],
)
def list_proc_approval_step_owners(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[ProcApprovalStepOwnersGroup]]:
    rows = ProcApprovalStepOwnerService(db).list_grouped(ctx)
    return APIResponse(
        message="PO approval step owners retrieved",
        data=[ProcApprovalStepOwnersGroup.model_validate(row) for row in rows],
    )


@scm_router.put(
    "/approval-step-owners/{step_key}",
    response_model=APIResponse[ProcApprovalStepOwnersGroup],
)
def replace_proc_approval_step_owners(
    step_key: str,
    body: ProcApprovalStepOwnersReplaceRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ProcApprovalStepOwnersGroup]:
    service = ProcApprovalStepOwnerService(db)
    service.replace(ctx, step_key, body.user_ids)
    db.commit()
    grouped = service.list_grouped(ctx)
    row = next(item for item in grouped if item["step_key"] == step_key)
    return APIResponse(
        message="PO approval step owners saved",
        data=ProcApprovalStepOwnersGroup.model_validate(row),
    )


@scm_router.get(
    "/approval-capabilities",
    response_model=APIResponse[ProcApprovalCapabilitiesResponse],
)
def get_proc_approval_capabilities(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ProcApprovalCapabilitiesResponse]:
    caps = ProcApprovalStepOwnerService(db).capabilities(ctx)
    return APIResponse(
        message="PO approval capabilities retrieved",
        data=ProcApprovalCapabilitiesResponse.model_validate(caps),
    )


@scm_router.post(
    "/invoice-generation-tasks",
    response_model=APIResponse[list[ProcInvoiceGenerationTaskResponse]],
)
def create_invoice_generation_tasks(
    body: ProcInvoiceGenerationTaskCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.grn:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[ProcInvoiceGenerationTaskResponse]]:
    service = ProcInvoiceGenerationTaskService(db)
    rows = service.create_for_billing_receipt(
        ctx,
        order_id=body.order_id,
        receipt_batch_id=body.receipt_batch_id,
        items_summary=body.items_summary,
        vendor_name=body.vendor_name,
        customer_name=body.customer_name,
        grn_number=body.grn_number,
        billing_quantity=body.billing_quantity,
        billing_amount=body.billing_amount,
    )
    db.commit()
    return APIResponse(
        message="Accounts notified for invoice generation",
        data=[
            ProcInvoiceGenerationTaskResponse.model_validate(payload)
            for payload in service.serialize_many(ctx, rows)
        ],
    )


@scm_router.get(
    "/invoice-generation-tasks/mine",
    response_model=APIResponse[list[ProcInvoiceGenerationTaskResponse]],
)
def list_my_invoice_generation_tasks(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
    status: str | None = Query(default="pending"),
) -> APIResponse[list[ProcInvoiceGenerationTaskResponse]]:
    service = ProcInvoiceGenerationTaskService(db)
    rows = service.list_my_tasks(ctx, status=status)
    return APIResponse(
        message="Invoice generation tasks retrieved",
        data=[
            ProcInvoiceGenerationTaskResponse.model_validate(payload)
            for payload in service.serialize_many(ctx, rows)
        ],
    )


@scm_router.get(
    "/invoice-generation-tasks/by-batch/{receipt_batch_id}",
    response_model=APIResponse[ProcInvoiceGenerationTaskResponse | None],
)
def get_invoice_generation_task_for_batch(
    receipt_batch_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ProcInvoiceGenerationTaskResponse | None]:
    service = ProcInvoiceGenerationTaskService(db)
    row = service.get_for_batch_prefill(ctx, receipt_batch_id=receipt_batch_id)
    return APIResponse(
        message="Invoice generation prefill retrieved",
        data=(
            ProcInvoiceGenerationTaskResponse.model_validate(service.serialize(ctx, row))
            if row
            else None
        ),
    )


@scm_router.get(
    "/invoice-generation-tasks/by-order/{order_id}",
    response_model=APIResponse[list[ProcInvoiceGenerationTaskResponse]],
)
def list_invoice_generation_tasks_for_order(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[ProcInvoiceGenerationTaskResponse]]:
    service = ProcInvoiceGenerationTaskService(db)
    rows = service.list_for_order(ctx, order_id=order_id)
    return APIResponse(
        message="Invoice generation tasks retrieved",
        data=[
            ProcInvoiceGenerationTaskResponse.model_validate(payload)
            for payload in service.serialize_many(ctx, rows)
        ],
    )


@scm_router.post(
    "/invoice-generation-tasks/{task_id}/submit",
    response_model=APIResponse[ProcInvoiceGenerationTaskResponse],
)
def submit_invoice_generation_task(
    task_id: UUID,
    body: ProcInvoiceGenerationTaskSubmitRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ProcInvoiceGenerationTaskResponse]:
    service = ProcInvoiceGenerationTaskService(db)
    row = service.submit(
        ctx,
        task_id,
        invoice_number=body.invoice_number,
        invoice_date=body.invoice_date,
        invoice_quantity=body.invoice_quantity,
        invoice_amount=body.invoice_amount,
        file_name=body.file_name,
        content_base64=body.content_base64,
        content_type=body.content_type,
    )
    db.commit()
    return APIResponse(
        message="Invoice details saved",
        data=ProcInvoiceGenerationTaskResponse.model_validate(service.serialize(ctx, row)),
    )


@scm_router.get(
    "/finalize-approvals",
    response_model=APIResponse[list[ScmFinalizeApprovalResponse]],
)
def list_scm_finalize_approvals(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[list[ScmFinalizeApprovalResponse]]:
    rows = ScmHandoffService(db).list_finalize_approvals(ctx, company_id)
    return APIResponse(
        message="SCM finalize approvals retrieved",
        data=[ScmFinalizeApprovalResponse.model_validate(r) for r in rows],
    )


@scm_router.post(
    "/orders/{order_id}/request-finalize-approval",
    response_model=APIResponse[OrderResponse],
)
def request_scm_finalize_approval(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
    body: ScmFinalizeApprovalRequest | None = None,
) -> APIResponse[OrderResponse]:
    payload = body.model_dump() if body is not None else {}
    row = ScmHandoffService(db).request_finalize_approval(
        ctx,
        order_id,
        po_pdf_base64=payload.get("po_pdf_base64"),
        po_pdf_filename=payload.get("po_pdf_filename"),
        remarks=payload.get("remarks"),
    )
    db.commit()
    return APIResponse(
        message="SCM purchase order sent for Accept PO approval",
        data=OrderResponse.model_validate(row),
    )


@scm_router.post(
    "/orders/{order_id}/accept-po-approval",
    response_model=APIResponse[OrderResponse],
)
def accept_scm_po_approval(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:approve"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[OrderResponse]:
    row = ScmHandoffService(db).accept_po_approval(ctx, order_id)
    db.commit()
    return APIResponse(
        message="PO accepted — sent to Management for approval",
        data=OrderResponse.model_validate(row),
    )


@scm_router.post(
    "/orders/{order_id}/reject-finalize-approval",
    response_model=APIResponse[OrderResponse],
)
def reject_scm_finalize_approval(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:approve"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[OrderResponse]:
    row = ScmHandoffService(db).reject_finalize_approval(ctx, order_id)
    db.commit()
    return APIResponse(
        message="SCM finalize request rejected",
        data=OrderResponse.model_validate(row),
    )


@scm_router.post("/orders/{order_id}/finalize", response_model=APIResponse[OrderResponse])
def finalize_scm_order(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:send"))],
    db: Annotated[Session, Depends(get_db)],
    body: ScmFinalizeRequest | None = None,
) -> APIResponse[OrderResponse]:
    payload = body.model_dump() if body is not None else {}
    row = ScmHandoffService(db).finalize_scm_po(
        ctx,
        order_id,
        po_pdf_base64=payload.get("po_pdf_base64"),
        po_pdf_filename=payload.get("po_pdf_filename"),
    )
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
    "/inventory/consume-units",
    response_model=APIResponse[dict],
)
def consume_procurement_inventory_units(
    body: ScmInventoryConsumeUnitsRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    removed = ScmHandoffService(db).consume_inventory_stock_units_for_document(
        ctx,
        list(body.stock_unit_ids),
        company_id=body.company_id,
    )
    db.commit()
    return APIResponse(
        message="Inventory units consumed for billing / delivery challan",
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
        delivery_challan_quantity=body.delivery_challan_quantity,
        vendor_dispatch_id=body.vendor_dispatch_id,
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
