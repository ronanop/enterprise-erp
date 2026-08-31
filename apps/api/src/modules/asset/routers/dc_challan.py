"""Dedicated DC challan router — do not grow routers/__init__.py."""

from __future__ import annotations

import secrets
from datetime import date
from typing import Annotated
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Header, Query, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session

from core.config import get_settings
from core.exceptions import UnauthorizedException
from modules.asset.dependencies import PaginationParams, get_db, get_pagination, require_permission
from modules.asset.domain.exceptions import DcChallanValidationError
from modules.asset.schemas import (
    DcChallanAttachDocumentRequest,
    DcChallanBulkSendRequest,
    DcChallanBulkSendResult,
    DcChallanCreate,
    DcChallanLegacyContentResponse,
    DcChallanLinkAssignmentRequest,
    DcChallanListResult,
    DcChallanMarkSignedRequest,
    DcChallanResponse,
    DcChallanScmCallbackRequest,
    DcChallanSummaryResponse,
    DcChallanUpdate,
    DcChallanUploadLimits,
)
from modules.asset.service.dc_challan_file import (
    allowed_types_message,
    max_upload_bytes,
    upload_limits_payload,
)
from modules.asset.service.dc_challan_service import DcChallanService
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

dc_challan_router = APIRouter(prefix="/asset-dc-challans", tags=["Asset — DC Challan"])

_CHUNK = 64 * 1024


def require_dc_scm_service_key(
    x_erp_service_key: Annotated[str | None, Header(alias="X-ERP-Service-Key")] = None,
) -> None:
    expected = (get_settings().asset_dc_challan_scm_api_key or "").strip()
    provided = (x_erp_service_key or "").strip()
    if (
        not expected
        or not provided
        or len(provided) != len(expected)
        or not secrets.compare_digest(provided, expected)
    ):
        raise UnauthorizedException("Invalid or missing SCM service key")


async def _read_upload(upload: UploadFile) -> tuple[bytes, str | None, str | None]:
    limit = max_upload_bytes()
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await upload.read(_CHUNK)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            mb = limit // (1024 * 1024)
            raise DcChallanValidationError(
                f"File is larger than the {mb} MB upload limit. {allowed_types_message()}"
            )
        chunks.append(chunk)
    return b"".join(chunks), upload.filename, upload.content_type


def _content_disposition(disposition: str, filename: str) -> str:
    ascii_name = filename.encode("ascii", "ignore").decode("ascii") or "document"
    return f"{disposition}; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"


def _upload_limits() -> DcChallanUploadLimits:
    return DcChallanUploadLimits(**upload_limits_payload())


@dc_challan_router.get("/summary", response_model=APIResponse[DcChallanSummaryResponse])
def summary_dc_challans(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.dc_challan:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    data = DcChallanService(db).summary(ctx, company_id=company_id)
    return APIResponse(
        message="OK",
        data=DcChallanSummaryResponse(**data, upload_limits=_upload_limits()),
    )


@dc_challan_router.get("", response_model=APIResponse[DcChallanListResult])
def list_dc_challans(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.dc_challan:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    status: str | None = None,
    asset_id: UUID | None = None,
    assignment_id: UUID | None = None,
    unlinked: bool = False,
    q: str | None = None,
    created_from: date | None = None,
    created_to: date | None = None,
):
    service = DcChallanService(db)
    items, total = service.search(
        ctx,
        company_id=company_id,
        status=status,
        asset_id=asset_id,
        assignment_id=assignment_id,
        unlinked=unlinked,
        search=q,
        created_from=created_from,
        created_to=created_to,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = DcChallanListResult(
        items=service.to_responses(items),
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        upload_limits=_upload_limits(),
    )
    return APIResponse(message="OK", data=payload)


@dc_challan_router.post("", response_model=APIResponse[DcChallanResponse], status_code=201)
def create_dc_challan(
    body: DcChallanCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.dc_challan:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    service = DcChallanService(db)
    row = service.create(
        ctx,
        asset_id=body.asset_id,
        assignment_id=body.assignment_id,
        employee_id=body.employee_id,
        employee_code=body.employee_code,
        employee_name=body.employee_name,
        employee_phone=body.employee_phone,
        employee_email=body.employee_email,
        remarks=body.remarks,
        company_id=body.company_id,
    )
    return APIResponse(message="created", data=service.to_response(row))


@dc_challan_router.post("/bulk-send-to-scm", response_model=APIResponse[DcChallanBulkSendResult])
def bulk_send_dc_challans(
    body: DcChallanBulkSendRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.dc_challan:send"))],
    db: Annotated[Session, Depends(get_db)],
):
    result = DcChallanService(db).bulk_send_to_scm(ctx, body.ids)
    return APIResponse(message="OK", data=result)


@dc_challan_router.get("/{row_id}", response_model=APIResponse[DcChallanResponse])
def get_dc_challan(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.dc_challan:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    service = DcChallanService(db)
    row = service.get(ctx, row_id)
    return APIResponse(message="OK", data=service.to_response(row))


@dc_challan_router.patch("/{row_id}", response_model=APIResponse[DcChallanResponse])
def update_dc_challan(
    row_id: UUID,
    body: DcChallanUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.dc_challan:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    service = DcChallanService(db)
    row = service.update(ctx, row_id, **body.model_dump(exclude_unset=True))
    return APIResponse(message="updated", data=service.to_response(row))


@dc_challan_router.post("/{row_id}/send-to-scm", response_model=APIResponse[DcChallanResponse])
def send_dc_challan(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.dc_challan:send"))],
    db: Annotated[Session, Depends(get_db)],
):
    service = DcChallanService(db)
    row = service.send_to_scm(ctx, row_id)
    return APIResponse(message="sent", data=service.to_response(row))


@dc_challan_router.post("/{row_id}/link-assignment", response_model=APIResponse[DcChallanResponse])
def link_dc_challan_assignment(
    row_id: UUID,
    body: DcChallanLinkAssignmentRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.dc_challan:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    service = DcChallanService(db)
    row = service.link_assignment(ctx, row_id, body.assignment_id)
    return APIResponse(message="linked", data=service.to_response(row))


@dc_challan_router.post(
    "/{row_id}/attach-scm-document",
    response_model=APIResponse[DcChallanResponse],
    deprecated=True,
    description="Deprecated. Prefer POST .../documents/scm-issued (multipart file upload).",
)
def attach_dc_scm_document(
    row_id: UUID,
    body: DcChallanAttachDocumentRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.dc_challan:receive"))],
    db: Annotated[Session, Depends(get_db)],
):
    service = DcChallanService(db)
    row = service.attach_scm_document(
        ctx,
        row_id,
        document_url=body.document_url,
        scm_reference_number=body.scm_reference_number,
    )
    return APIResponse(message="received", data=service.to_response(row))


@dc_challan_router.post(
    "/{row_id}/documents/scm-issued",
    response_model=APIResponse[DcChallanResponse],
)
async def upload_scm_issued_document(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.dc_challan:receive"))],
    db: Annotated[Session, Depends(get_db)],
    file: Annotated[UploadFile, File()],
    scm_reference_number: Annotated[str | None, Form()] = None,
):
    data, filename, content_type = await _read_upload(file)
    service = DcChallanService(db)
    row = service.upload_scm_issued_document(
        ctx,
        row_id,
        file_bytes=data,
        original_filename=filename,
        declared_content_type=content_type,
        scm_reference_number=scm_reference_number,
    )
    return APIResponse(message="received", data=service.to_response(row))


@dc_challan_router.post(
    "/{row_id}/documents/signed",
    response_model=APIResponse[DcChallanResponse],
)
async def upload_signed_document(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.dc_challan:receive"))],
    db: Annotated[Session, Depends(get_db)],
    file: Annotated[UploadFile, File()],
):
    data, filename, content_type = await _read_upload(file)
    service = DcChallanService(db)
    row = service.upload_signed_document(
        ctx,
        row_id,
        file_bytes=data,
        original_filename=filename,
        declared_content_type=content_type,
    )
    return APIResponse(message="signed", data=service.to_response(row))


@dc_challan_router.get("/{row_id}/documents/{doc_kind}/content")
def get_dc_document_content(
    row_id: UUID,
    doc_kind: str,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.dc_challan:read"))],
    db: Annotated[Session, Depends(get_db)],
    disposition: Annotated[str, Query()] = "inline",
):
    disp = disposition if disposition in {"inline", "attachment"} else "inline"
    service = DcChallanService(db)
    result = service.document_content(ctx, row_id, doc_kind)
    if result.is_legacy:
        return JSONResponse(
            content=APIResponse(
                message="OK",
                data=DcChallanLegacyContentResponse(
                    is_legacy=True,
                    external_url=result.external_url or "",
                    doc_kind=doc_kind,
                ),
            ).model_dump(),
        )
    handle = service.open_stored_file(result.storage_key or "")

    def _iter():
        try:
            while True:
                chunk = handle.read(_CHUNK)
                if not chunk:
                    break
                yield chunk
        finally:
            handle.close()

    headers = {
        "Content-Disposition": _content_disposition(disp, result.filename or "document"),
        "X-Content-Type-Options": "nosniff",
    }
    if result.file_size_bytes:
        headers["Content-Length"] = str(result.file_size_bytes)
    return StreamingResponse(
        _iter(),
        media_type=result.content_type or "application/octet-stream",
        headers=headers,
    )


@dc_challan_router.post(
    "/{row_id}/mark-signed",
    response_model=APIResponse[DcChallanResponse],
    deprecated=True,
    description="Deprecated. Prefer POST .../documents/signed (multipart). Upload and mark-signed are one action.",
)
def mark_dc_challan_signed(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.dc_challan:receive"))],
    db: Annotated[Session, Depends(get_db)],
    body: DcChallanMarkSignedRequest | None = None,
):
    service = DcChallanService(db)
    row = service.mark_signed(
        ctx,
        row_id,
        signed_document_url=body.signed_document_url if body else None,
    )
    return APIResponse(message="signed", data=service.to_response(row))


@dc_challan_router.post("/{row_id}/mark-received", response_model=APIResponse[DcChallanResponse])
def mark_dc_challan_received(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.dc_challan:receive"))],
    db: Annotated[Session, Depends(get_db)],
):
    service = DcChallanService(db)
    row = service.mark_received(ctx, row_id)
    return APIResponse(message="received", data=service.to_response(row))


@dc_challan_router.post("/{row_id}/cancel", response_model=APIResponse[DcChallanResponse])
def cancel_dc_challan(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.dc_challan:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    service = DcChallanService(db)
    row = service.cancel(ctx, row_id)
    return APIResponse(message="cancelled", data=service.to_response(row))


@dc_challan_router.post("/{row_id}/scm-callback", response_model=APIResponse[DcChallanResponse])
async def scm_callback_dc_challan(
    row_id: UUID,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_dc_scm_service_key)],
):
    content_type = (request.headers.get("content-type") or "").lower()
    file_bytes: bytes | None = None
    filename: str | None = None
    declared_type: str | None = None
    document_url: str | None = None
    scm_reference_number: str | None = None

    if "multipart/form-data" in content_type:
        form = await request.form()
        upload = form.get("file")
        ref_value = form.get("scm_reference_number")
        scm_reference_number = str(ref_value).strip() if isinstance(ref_value, str) else None
        url_value = form.get("document_url")
        if isinstance(url_value, str) and url_value.strip():
            document_url = url_value.strip()
        if hasattr(upload, "read"):
            file_bytes, filename, declared_type = await _read_upload(upload)  # type: ignore[arg-type]
    else:
        try:
            payload = await request.json()
        except Exception as exc:
            raise DcChallanValidationError(
                "SCM callback body must be JSON {document_url} or multipart with a file"
            ) from exc
        parsed = DcChallanScmCallbackRequest.model_validate(payload)
        document_url = parsed.document_url
        scm_reference_number = parsed.scm_reference_number

    if file_bytes is None and not document_url:
        raise DcChallanValidationError(
            "SCM callback requires a multipart file or a JSON document_url"
        )

    service = DcChallanService(db)
    row = service.apply_scm_callback(
        row_id,
        document_url=document_url,
        file_bytes=file_bytes,
        original_filename=filename,
        declared_content_type=declared_type,
        scm_reference_number=scm_reference_number,
    )
    return APIResponse(message="OK", data=service.to_response(row))
