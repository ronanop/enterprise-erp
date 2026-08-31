"""Standalone DC challan service (Router → Service → Repository).

branch_id / company_id are copied from the asset at insert and are not rewritten
if the asset later transfers. List/get still apply apply_ast_filter on the
challan row (origin-branch IT sees the paperwork; destination-branch users with
branch scope may not). Super_admin / All-branches still sees it.

Reopening an assignment must not revive a cancelled DC challan. IT creates or
links a new row once the old row is CANCELLED (partial unique index allows this).
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from io import BytesIO
from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.exceptions import ConflictException, ForbiddenException, NotFoundException
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.adapters.scm_port import AssetScmAdapter
from modules.asset.domain.enums import (
    DC_CHALLAN_ASSIGNMENT_AUTO_CANCEL_STATUSES,
    DC_CHALLAN_OPS_AUTO_CANCEL_STATUSES,
    AssignmentDeliveryReferenceStatus,
    AstEntityType,
    DcChallanDocKind,
    DcChallanDocSource,
    DcChallanStatus,
    normalize_dc_doc_kind,
)
from modules.asset.domain.exceptions import DcChallanValidationError, InvalidDcChallanState
from modules.asset.models.dc_challan import AstDcChallan
from modules.asset.models.dc_challan_document import AstDcChallanDocument
from modules.asset.repository.asset_assignment_repository import AssetAssignmentRepository
from modules.asset.repository.base import utcnow
from modules.asset.repository.dc_challan_document_repository import DcChallanDocumentRepository
from modules.asset.repository.dc_challan_repository import DcChallanListFilters, DcChallanRepository
from modules.asset.schemas import (
    DcChallanBulkSendItem,
    DcChallanBulkSendResult,
    DcChallanDocumentResponse,
    DcChallanResponse,
)
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.dc_challan_file import (
    extension_for_content_type,
    max_upload_bytes,
    validate_upload_bytes,
)
from modules.asset.service.dc_challan_validator import (
    DcChallanValidator,
    employee_snapshots_ready,
    format_employee_name,
    send_to_scm_snapshot_error,
    validate_dc_document_url,
)
from modules.asset.service.document_number_service import DocumentNumberService
from modules.asset.storage import StorageBackend, get_storage
from modules.asset.storage.http_fetch import SsrfBlockedError, download_document_bytes
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

logger = logging.getLogger(__name__)

ENTITY = "ast_dc_challan"
ENTITY_DOC = "ast_dc_challan_document"
OPEN_DC_CONFLICT = "An open DC challan already exists for this asset"
CALLBACK_URL_TEMPLATE = "/api/v1/assets/asset-dc-challans/{id}/scm-callback"
DOCUMENT_NOT_FOUND = "Document not found"
SIGNED_DOC_REQUIRED = "A signed document must be uploaded before marking the challan as signed"
CANCELLED_DOC_MSG = "Cannot replace or upload documents on a cancelled DC challan"
DOCUMENT_REPLACE_STATUSES = frozenset(
    {
        DcChallanStatus.DOCUMENT_RECEIVED.value,
        DcChallanStatus.SIGNED.value,
        DcChallanStatus.RECEIVED.value,
    }
)


@dataclass(frozen=True)
class DcDocumentContentResult:
    is_legacy: bool
    external_url: str | None = None
    storage_key: str | None = None
    content_type: str | None = None
    filename: str | None = None
    file_size_bytes: int | None = None


def _document_response(
    doc: AstDcChallanDocument | None,
    *,
    kind: str,
    legacy_url: str | None,
    legacy_uploaded_at,
) -> DcChallanDocumentResponse | None:
    if doc is not None:
        return DcChallanDocumentResponse(
            id=doc.id,
            doc_kind=doc.doc_kind,
            original_filename=doc.original_filename,
            content_type=doc.content_type,
            file_size_bytes=doc.file_size_bytes,
            checksum_sha256=doc.checksum_sha256,
            source=doc.source,
            uploaded_by_user_id=doc.uploaded_by_user_id,
            uploaded_at=doc.uploaded_at,
            external_url=doc.external_url,
            is_legacy=not bool(doc.storage_key) and bool(doc.external_url),
            has_stored_file=bool(doc.storage_key),
        )
    url = _blank(legacy_url)
    if not url:
        return None
    return DcChallanDocumentResponse(
        doc_kind=kind,
        external_url=url,
        uploaded_at=legacy_uploaded_at,
        is_legacy=True,
        has_stored_file=False,
    )


def to_dc_challan_response(
    row: AstDcChallan,
    documents: list[AstDcChallanDocument] | None = None,
) -> DcChallanResponse:
    payload = DcChallanResponse.model_validate(row)
    by_kind = {
        str(getattr(doc, "doc_kind", "") or ""): doc
        for doc in (documents or [])
        if not getattr(doc, "is_deleted", False)
    }
    payload.scm_issued_document = _document_response(
        by_kind.get(DcChallanDocKind.SCM_ISSUED.value),
        kind=DcChallanDocKind.SCM_ISSUED.value,
        legacy_url=getattr(row, "scm_document_url", None),
        legacy_uploaded_at=getattr(row, "scm_document_uploaded_at", None),
    )
    payload.signed_document = _document_response(
        by_kind.get(DcChallanDocKind.SIGNED.value),
        kind=DcChallanDocKind.SIGNED.value,
        legacy_url=getattr(row, "signed_document_url", None),
        legacy_uploaded_at=getattr(row, "signed_document_uploaded_at", None),
    )
    return payload


def _blank(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = str(value).strip()
    return stripped or None


def _append_remark(existing: str | None, remark: str) -> str:
    note = remark.strip()
    current = (existing or "").strip()
    if not current:
        return note
    if note in current:
        return current
    return f"{current}\n{note}"


def _raise_open_conflict(exc: IntegrityError) -> None:
    detail = str(getattr(exc, "orig", exc))
    if "uq_ast_dc_challan_one_open_per_asset" in detail or "one_open_per_asset" in detail:
        raise ConflictException(OPEN_DC_CONFLICT) from exc
    raise ConflictException("DC challan could not be saved") from exc


class DcChallanService:
    def __init__(self, db: Session, *, storage: StorageBackend | None = None) -> None:
        self._db = db
        self._repo = DcChallanRepository(db)
        self._docs = DcChallanDocumentRepository(db)
        self._assignments = AssetAssignmentRepository(db)
        self._validator = DcChallanValidator(db)
        self._scope = AssetScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._master = AssetMasterDataAdapter(db)
        self._scm = AssetScmAdapter(db)
        self._audit = AuditService(db)
        self._storage = storage if storage is not None else get_storage()

    def to_response(self, row: AstDcChallan) -> DcChallanResponse:
        return to_dc_challan_response(row, self._docs.list_active(row.id))

    def to_responses(self, rows: list[AstDcChallan]) -> list[DcChallanResponse]:
        mapping = self._docs.map_active([row.id for row in rows])
        return [to_dc_challan_response(row, mapping.get(row.id, [])) for row in rows]

    def get(self, ctx: TenantContext, row_id: UUID) -> AstDcChallan:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("DC challan not found")
        return row

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        status: str | None = None,
        asset_id: UUID | None = None,
        assignment_id: UUID | None = None,
        unlinked: bool = False,
        search: str | None = None,
        created_from: date | None = None,
        created_to: date | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstDcChallan], int]:
        resolved = self._repo.resolve_company_id(ctx, company_id)
        return self._repo.search(
            ctx,
            DcChallanListFilters(
                company_id=resolved,
                status=status,
                asset_id=asset_id,
                assignment_id=assignment_id,
                unlinked=unlinked,
                search=search,
                created_from=created_from,
                created_to=created_to,
            ),
            offset=offset,
            limit=limit,
        )

    def summary(self, ctx: TenantContext, *, company_id: UUID | None = None) -> dict[str, int]:
        resolved = self._repo.resolve_company_id(ctx, company_id)
        counts = self._repo.summary_counts(ctx, resolved)
        return {
            "pending": counts.get(DcChallanStatus.PENDING.value, 0),
            "sent_to_scm": counts.get(DcChallanStatus.SENT_TO_SCM.value, 0),
            "document_received": counts.get(DcChallanStatus.DOCUMENT_RECEIVED.value, 0),
            "signed": counts.get(DcChallanStatus.SIGNED.value, 0),
            "received": counts.get(DcChallanStatus.RECEIVED.value, 0),
            "cancelled": counts.get(DcChallanStatus.CANCELLED.value, 0),
        }

    def create(
        self,
        ctx: TenantContext,
        *,
        asset_id: UUID,
        assignment_id: UUID | None = None,
        employee_id: UUID | None = None,
        employee_code: str | None = None,
        employee_name: str | None = None,
        employee_phone: str | None = None,
        employee_email: str | None = None,
        remarks: str | None = None,
        company_id: UUID | None = None,
    ) -> AstDcChallan:
        asset = self._validator.require_asset(ctx, asset_id)
        resolved_company = company_id or asset.company_id
        self._scope.validate_company_access(ctx, resolved_company)
        if asset.company_id != resolved_company:
            raise DcChallanValidationError("Asset does not belong to this company")
        self._validator.validate_create_eligibility(asset)

        resolved_employee_id = employee_id
        assignment = None
        if assignment_id is not None:
            assignment = self._validator.require_assignment(ctx, assignment_id)
            self._validator.validate_employee_assignment(assignment)
            if assignment.asset_id != asset_id:
                raise DcChallanValidationError("Assignment does not belong to this asset")
            resolved_employee_id = assignment.employee_id

        snapshots = self._prefill_snapshots(
            ctx,
            asset,
            assignment=assignment,
            employee_id=resolved_employee_id,
            employee_code=employee_code,
            employee_name=employee_name,
            employee_phone=employee_phone,
            employee_email=employee_email,
        )

        dc_number = self._numbers.generate(
            AstEntityType.DC_CHALLAN,
            asset.company_id,
            AstDcChallan,
            "dc_number",
            ctx=ctx,
        )
        try:
            row = self._repo.create(
                ctx,
                dc_number=dc_number,
                asset_id=asset.id,
                assignment_id=assignment_id,
                employee_id=resolved_employee_id,
                status=DcChallanStatus.PENDING.value,
                company_id=asset.company_id,
                branch_id=asset.branch_id,
                remarks=_blank(remarks),
                **snapshots,
            )
        except IntegrityError as exc:
            _raise_open_conflict(exc)

        if assignment is not None:
            self._sync_assignment_delivery_reference(ctx, assignment, row.dc_number)

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"dc_number": row.dc_number, "status": row.status},
        )
        return row

    def update(
        self,
        ctx: TenantContext,
        row_id: UUID,
        **fields,
    ) -> AstDcChallan:
        row = self.get(ctx, row_id)
        self._validator.validate_pending(row)
        allowed = {
            "employee_code",
            "employee_name",
            "employee_phone",
            "employee_email",
            "asset_name",
            "asset_tag",
            "make",
            "model",
            "serial_number",
            "purchase_cost",
            "remarks",
        }
        payload = {k: v for k, v in fields.items() if k in allowed and v is not None}
        if "purchase_cost" in payload and payload["purchase_cost"] is not None:
            payload["purchase_cost"] = Decimal(str(payload["purchase_cost"]))
        for key in ("employee_code", "employee_name", "employee_phone", "employee_email", "remarks"):
            if key in payload:
                payload[key] = _blank(payload[key]) if isinstance(payload[key], str) else payload[key]
        if not payload:
            return row
        updated = self._repo.update(ctx, row_id, **payload)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY,
            entity_id=row_id,
            operation="update",
            performed_by=ctx.user_id,
            new_value={k: str(v) if v is not None else None for k, v in payload.items()},
        )
        return updated or row

    def send_to_scm(self, ctx: TenantContext, row_id: UUID) -> AstDcChallan:
        row = self.get(ctx, row_id)
        self._validator.validate_transition(row, DcChallanStatus.SENT_TO_SCM.value)
        if not employee_snapshots_ready(row):
            raise DcChallanValidationError(send_to_scm_snapshot_error(row))
        now = utcnow()
        self._scm.send_dc_request(
            dc_challan_id=row.id,
            dc_number=row.dc_number,
            asset_snapshot={
                "asset_name": row.asset_name,
                "asset_tag": row.asset_tag,
                "make": row.make,
                "model": row.model,
                "serial_number": row.serial_number,
                "purchase_cost": str(row.purchase_cost) if row.purchase_cost is not None else None,
            },
            employee_snapshot={
                "employee_code": row.employee_code,
                "employee_name": row.employee_name,
                "employee_phone": row.employee_phone,
                "employee_email": row.employee_email,
                "deployed_to": getattr(row, "deployed_to", None),
            },
            requested_by=ctx.user_id,
            callback_url=CALLBACK_URL_TEMPLATE.format(id=row.id),
        )
        updated = self._repo.update(
            ctx,
            row_id,
            status=DcChallanStatus.SENT_TO_SCM.value,
            sent_to_scm_at=now,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY,
            entity_id=row_id,
            operation="send_to_scm",
            performed_by=ctx.user_id,
            new_value={"status": DcChallanStatus.SENT_TO_SCM.value},
        )
        return updated or row

    def bulk_send_to_scm(self, ctx: TenantContext, ids: list[UUID]) -> DcChallanBulkSendResult:
        results: list[DcChallanBulkSendItem] = []
        sent = 0
        skipped = 0
        for row_id in ids:
            try:
                self.send_to_scm(ctx, row_id)
                results.append(DcChallanBulkSendItem(id=row_id, ok=True, reason=None))
                sent += 1
            except (NotFoundException, InvalidDcChallanState, DcChallanValidationError, ConflictException) as exc:
                reason = getattr(exc, "message", None) or str(exc)
                results.append(DcChallanBulkSendItem(id=row_id, ok=False, reason=reason))
                skipped += 1
            except Exception as exc:  # noqa: BLE001 — per-item skip, do not abort batch
                results.append(DcChallanBulkSendItem(id=row_id, ok=False, reason=str(exc)))
                skipped += 1
        return DcChallanBulkSendResult(results=results, sent_count=sent, skipped_count=skipped)

    def link_assignment(self, ctx: TenantContext, row_id: UUID, assignment_id: UUID) -> AstDcChallan:
        row = self.get(ctx, row_id)
        if row.status in {
            DcChallanStatus.CANCELLED.value,
            DcChallanStatus.RECEIVED.value,
        }:
            raise InvalidDcChallanState("Cannot link a cancelled or received DC challan")
        assignment = self._validator.require_assignment(ctx, assignment_id)
        self._validator.validate_employee_assignment(assignment)
        if assignment.asset_id != row.asset_id:
            raise DcChallanValidationError("Assignment does not belong to this asset")
        if row.employee_id is not None and row.employee_id != assignment.employee_id:
            raise DcChallanValidationError(
                "DC challan employee does not match the assignment employee"
            )

        payload: dict = {"assignment_id": assignment_id}
        if row.employee_id is None:
            snapshots = self._prefill_snapshots(
                ctx,
                None,
                assignment=assignment,
                employee_id=assignment.employee_id,
            )
            payload["employee_id"] = assignment.employee_id
            payload.update(snapshots)

        updated = self._repo.update(ctx, row_id, **payload) or row
        self._sync_assignment_delivery_reference(ctx, assignment, updated.dc_number)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY,
            entity_id=row_id,
            operation="link_assignment",
            performed_by=ctx.user_id,
            new_value={"assignment_id": str(assignment_id)},
        )
        return updated

    def attach_scm_document(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        document_url: str,
        scm_reference_number: str | None = None,
    ) -> AstDcChallan:
        row = self.get(ctx, row_id)
        return self._ingest_scm_issued(
            ctx,
            row,
            file_bytes=None,
            original_filename=None,
            declared_content_type=None,
            document_url=document_url,
            scm_reference_number=scm_reference_number,
            source=DcChallanDocSource.MANUAL_UPLOAD.value,
            allow_replace=True,
        )

    def upload_scm_issued_document(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        file_bytes: bytes,
        original_filename: str | None,
        declared_content_type: str | None,
        scm_reference_number: str | None = None,
    ) -> AstDcChallan:
        row = self.get(ctx, row_id)
        return self._ingest_scm_issued(
            ctx,
            row,
            file_bytes=file_bytes,
            original_filename=original_filename,
            declared_content_type=declared_content_type,
            document_url=None,
            scm_reference_number=scm_reference_number,
            source=DcChallanDocSource.MANUAL_UPLOAD.value,
            allow_replace=True,
        )

    def apply_scm_callback(
        self,
        row_id: UUID,
        *,
        document_url: str | None = None,
        file_bytes: bytes | None = None,
        original_filename: str | None = None,
        declared_content_type: str | None = None,
        scm_reference_number: str | None = None,
    ) -> AstDcChallan:
        row = self._repo.get_by_id_unscoped(row_id)
        if row is None:
            raise NotFoundException("DC challan not found")
        ctx = TenantContext(
            tenant_id=row.tenant_id,
            user_id=row.created_by or row.updated_by or row.tenant_id,
            user_type="super_admin",
            company_id=row.company_id,
            branch_id=row.branch_id,
        )
        return self._ingest_scm_issued(
            ctx,
            row,
            file_bytes=file_bytes,
            original_filename=original_filename,
            declared_content_type=declared_content_type,
            document_url=document_url,
            scm_reference_number=scm_reference_number,
            source=DcChallanDocSource.SCM_CALLBACK.value,
            allow_replace=False,
        )

    def upload_signed_document(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        file_bytes: bytes,
        original_filename: str | None,
        declared_content_type: str | None,
    ) -> AstDcChallan:
        row = self.get(ctx, row_id)
        self._require_documents_mutable(row)
        replacing = row.status in {
            DcChallanStatus.SIGNED.value,
            DcChallanStatus.RECEIVED.value,
        }
        self._store_document(
            ctx,
            row,
            kind=DcChallanDocKind.SIGNED.value,
            file_bytes=file_bytes,
            original_filename=original_filename,
            declared_content_type=declared_content_type,
            document_url=None,
            source=DcChallanDocSource.MANUAL_UPLOAD.value,
            allow_replace=True,
        )
        if replacing:
            return self.get(ctx, row.id)
        return self._transition_to_signed(ctx, row)

    def mark_signed(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        signed_document_url: str | None = None,
    ) -> AstDcChallan:
        row = self.get(ctx, row_id)
        self._require_documents_mutable(row)
        if signed_document_url:
            self._store_document(
                ctx,
                row,
                kind=DcChallanDocKind.SIGNED.value,
                file_bytes=None,
                original_filename=None,
                declared_content_type=None,
                document_url=signed_document_url,
                source=DcChallanDocSource.MANUAL_UPLOAD.value,
                allow_replace=row.status in DOCUMENT_REPLACE_STATUSES,
            )
        return self._transition_to_signed(ctx, row)

    def mark_received(self, ctx: TenantContext, row_id: UUID) -> AstDcChallan:
        row = self.get(ctx, row_id)
        self._validator.validate_transition(row, DcChallanStatus.RECEIVED.value)
        now = utcnow()
        updated = self._repo.update(
            ctx,
            row_id,
            status=DcChallanStatus.RECEIVED.value,
            received_at=now,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY,
            entity_id=row_id,
            operation="mark_received",
            performed_by=ctx.user_id,
            new_value={"status": DcChallanStatus.RECEIVED.value},
        )
        self._push_scm_status(updated or row, now)
        return updated or row

    def document_content(
        self,
        ctx: TenantContext,
        row_id: UUID,
        doc_kind: str,
    ) -> DcDocumentContentResult:
        try:
            kind = normalize_dc_doc_kind(doc_kind)
        except ValueError as exc:
            raise NotFoundException(DOCUMENT_NOT_FOUND) from exc
        row = self._require_challan_for_document(ctx, row_id)
        doc = self._docs.get_active(row.id, kind)
        if doc is not None and doc.storage_key:
            suffix = extension_for_content_type(doc.content_type or "") or ""
            label = "scm-issued" if kind == DcChallanDocKind.SCM_ISSUED.value else "signed"
            filename = doc.original_filename or f"{row.dc_number}-{label}{suffix}"
            return DcDocumentContentResult(
                is_legacy=False,
                storage_key=doc.storage_key,
                content_type=doc.content_type or "application/octet-stream",
                filename=filename,
                file_size_bytes=doc.file_size_bytes,
            )
        external = None
        if doc is not None:
            external = doc.external_url
        elif kind == DcChallanDocKind.SCM_ISSUED.value:
            external = row.scm_document_url
        else:
            external = row.signed_document_url
        if external:
            return DcDocumentContentResult(is_legacy=True, external_url=external)
        raise NotFoundException(DOCUMENT_NOT_FOUND)

    def open_stored_file(self, key: str):
        return self._storage.open(key)

    def cancel(self, ctx: TenantContext, row_id: UUID, *, remark: str | None = None) -> AstDcChallan:
        row = self.get(ctx, row_id)
        self._validator.validate_transition(row, DcChallanStatus.CANCELLED.value)
        note = remark or "Cancelled by IT."
        updated = self._repo.update(
            ctx,
            row_id,
            status=DcChallanStatus.CANCELLED.value,
            remarks=_append_remark(row.remarks, note),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY,
            entity_id=row_id,
            operation="cancel",
            performed_by=ctx.user_id,
            new_value={"status": DcChallanStatus.CANCELLED.value},
        )
        return updated or row

    def auto_cancel_for_assignment(
        self,
        ctx: TenantContext,
        assignment_id: UUID,
        *,
        remark: str,
    ) -> int:
        """Cancel linked open DCs (SIGNED included, RECEIVED not). Idempotent if already CANCELLED."""
        return self._auto_cancel(
            ctx,
            rows=self._repo.list_open_for_assignment(
                ctx, assignment_id, statuses=DC_CHALLAN_ASSIGNMENT_AUTO_CANCEL_STATUSES
            ),
            remark=remark,
        )

    def auto_cancel_open_for_asset(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        remark: str,
        statuses: frozenset[str] | None = None,
    ) -> int:
        """Ops RETIRED/PENDING_DISPOSAL/DISPOSED: cancel PENDING/SENT/DOCUMENT_RECEIVED only."""
        wanted = statuses or DC_CHALLAN_OPS_AUTO_CANCEL_STATUSES
        return self._auto_cancel(
            ctx,
            rows=self._repo.list_open_for_asset(ctx, asset_id, statuses=wanted),
            remark=remark,
        )

    def _auto_cancel(self, ctx: TenantContext, *, rows: list[AstDcChallan], remark: str) -> int:
        cancelled = 0
        for row in rows:
            if row.status == DcChallanStatus.CANCELLED.value:
                continue
            if row.status == DcChallanStatus.RECEIVED.value:
                continue
            self._repo.update_row(
                ctx,
                row,
                status=DcChallanStatus.CANCELLED.value,
                remarks=_append_remark(row.remarks, remark),
            )
            self._audit.log_entity_change(
                tenant_id=ctx.tenant_id,
                entity_name=ENTITY,
                entity_id=row.id,
                operation="auto_cancel",
                performed_by=ctx.user_id,
                new_value={"status": DcChallanStatus.CANCELLED.value, "remark": remark},
            )
            cancelled += 1
        return cancelled

    def _require_documents_mutable(self, row: AstDcChallan) -> None:
        if row.status == DcChallanStatus.CANCELLED.value:
            raise InvalidDcChallanState(CANCELLED_DOC_MSG)

    def _download_remote(self, ctx: TenantContext, row: AstDcChallan, url: str) -> bytes:
        try:
            return download_document_bytes(url, max_bytes=max_upload_bytes())
        except SsrfBlockedError as exc:
            logger.error(
                "Blocked SCM document URL host=%s challan_id=%s",
                exc.blocked_host,
                row.id,
            )
            self._audit.log_entity_change(
                tenant_id=ctx.tenant_id,
                entity_name=ENTITY,
                entity_id=row.id,
                operation="document_url_blocked",
                performed_by=ctx.user_id,
                new_value={"host": exc.blocked_host},
            )
            raise

    def _require_challan_for_document(self, ctx: TenantContext, row_id: UUID) -> AstDcChallan:
        row = self._repo.get(ctx, row_id)
        if row is not None:
            return row
        unscoped = self._repo.get_by_id_unscoped(row_id)
        if unscoped is None:
            raise NotFoundException(DOCUMENT_NOT_FOUND)
        raise ForbiddenException(DOCUMENT_NOT_FOUND)

    def _has_signed_document(self, row: AstDcChallan) -> bool:
        doc = self._docs.get_active(row.id, DcChallanDocKind.SIGNED.value)
        if doc is not None:
            return True
        return bool(_blank(getattr(row, "signed_document_url", None)))

    def _transition_to_signed(self, ctx: TenantContext, row: AstDcChallan) -> AstDcChallan:
        if row.status == DcChallanStatus.SIGNED.value:
            if not self._has_signed_document(row):
                raise DcChallanValidationError(SIGNED_DOC_REQUIRED)
            return row
        self._validator.validate_transition(row, DcChallanStatus.SIGNED.value)
        if not self._has_signed_document(row):
            raise DcChallanValidationError(SIGNED_DOC_REQUIRED)
        now = utcnow()
        updated = self._repo.update(
            ctx,
            row.id,
            status=DcChallanStatus.SIGNED.value,
            signed_at=now,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY,
            entity_id=row.id,
            operation="mark_signed",
            performed_by=ctx.user_id,
            new_value={"status": DcChallanStatus.SIGNED.value},
        )
        self._push_scm_status(updated or row, now)
        return updated or row

    def _push_scm_status(self, row: AstDcChallan, timestamp) -> None:
        signed = self._docs.get_active(row.id, DcChallanDocKind.SIGNED.value)
        meta = None
        if signed is not None:
            meta = {
                "original_filename": signed.original_filename,
                "filename": signed.original_filename,
                "checksum_sha256": signed.checksum_sha256,
                "file_size_bytes": signed.file_size_bytes,
                "content_type": signed.content_type,
            }
        self._scm.push_status_update(
            dc_challan_id=row.id,
            dc_number=row.dc_number,
            status=row.status,
            timestamp=timestamp,
            signed_document=meta,
        )

    def _ingest_scm_issued(
        self,
        ctx: TenantContext,
        row: AstDcChallan,
        *,
        file_bytes: bytes | None,
        original_filename: str | None,
        declared_content_type: str | None,
        document_url: str | None,
        scm_reference_number: str | None,
        source: str,
        allow_replace: bool,
    ) -> AstDcChallan:
        self._require_documents_mutable(row)
        url = validate_dc_document_url(document_url) if document_url else None
        ref = _blank(scm_reference_number)
        existing = self._docs.get_active(row.id, DcChallanDocKind.SCM_ISSUED.value)
        already_received = row.status in DOCUMENT_REPLACE_STATUSES

        if already_received:
            if file_bytes is not None:
                checksum = hashlib.sha256(file_bytes).hexdigest()
                if existing is not None and existing.checksum_sha256 == checksum:
                    return row
                if not allow_replace:
                    raise ConflictException(
                        "DC challan already has a different SCM document; do not replace it"
                    )
            elif url:
                same_url = False
                if existing is not None and (existing.external_url or "") == url:
                    same_url = True
                if (row.scm_document_url or "") == url and (row.scm_reference_number or None) == ref:
                    same_url = True
                if same_url:
                    return row
                if not allow_replace:
                    raise ConflictException(
                        "DC challan already has a different SCM document; do not replace it"
                    )
            elif not allow_replace:
                raise ConflictException(
                    "DC challan already has a different SCM document; do not replace it"
                )
        else:
            self._validator.validate_transition(row, DcChallanStatus.DOCUMENT_RECEIVED.value)

        data = file_bytes
        if data is None:
            if not url:
                raise DcChallanValidationError("A document file or document URL is required")
            data = self._download_remote(ctx, row, url)

        stored = self._store_document(
            ctx,
            row,
            kind=DcChallanDocKind.SCM_ISSUED.value,
            file_bytes=data,
            original_filename=original_filename or (url.split("/")[-1] if url else None),
            declared_content_type=declared_content_type,
            document_url=url,
            source=source,
            allow_replace=allow_replace or already_received,
        )
        now = utcnow()
        payload = {
            "scm_document_uploaded_at": now,
        }
        if url:
            payload["scm_document_url"] = url
        if ref is not None:
            payload["scm_reference_number"] = ref
        if already_received:
            updated = self._repo.update_row(ctx, row, **payload)
            self._audit.log_entity_change(
                tenant_id=ctx.tenant_id,
                entity_name=ENTITY,
                entity_id=row.id,
                operation="document_replaced",
                performed_by=ctx.user_id,
                new_value={"doc_kind": DcChallanDocKind.SCM_ISSUED.value, "checksum": stored[1]},
            )
            return updated

        payload["status"] = DcChallanStatus.DOCUMENT_RECEIVED.value
        updated = self._repo.update_row(ctx, row, **payload)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY,
            entity_id=row.id,
            operation="document_received",
            performed_by=ctx.user_id,
            new_value={
                "status": DcChallanStatus.DOCUMENT_RECEIVED.value,
                "checksum": stored[1],
                "source": source,
            },
        )
        return updated

    def _store_document(
        self,
        ctx: TenantContext,
        row: AstDcChallan,
        *,
        kind: str,
        file_bytes: bytes | None,
        original_filename: str | None,
        declared_content_type: str | None,
        document_url: str | None,
        source: str,
        allow_replace: bool,
    ) -> tuple[str, str]:
        url = validate_dc_document_url(document_url) if document_url else None
        data = file_bytes
        if data is None:
            if not url:
                raise DcChallanValidationError("A document file or document URL is required")
            data = self._download_remote(ctx, row, url)

        content_type, filename, size = validate_upload_bytes(
            data,
            declared_content_type=declared_content_type,
            original_filename=original_filename,
        )
        checksum = hashlib.sha256(data).hexdigest()
        existing = self._docs.get_active(row.id, kind)
        if existing is not None and existing.checksum_sha256 == checksum:
            return existing.storage_key or "", checksum
        if existing is not None and not allow_replace:
            raise ConflictException(
                "DC challan already has a different document of this kind; do not replace it"
            )

        slug = "scm-issued" if kind == DcChallanDocKind.SCM_ISSUED.value else "signed"
        ext = extension_for_content_type(content_type)
        key = f"dc-challan/{row.id}/{slug}/{uuid4()}{ext}"
        self._storage.save(BytesIO(data), key)

        previous_checksum = existing.checksum_sha256 if existing is not None else None
        if existing is not None:
            self._docs.soft_delete(ctx, existing)

        now = utcnow()
        uploaded_by = ctx.user_id if source == DcChallanDocSource.MANUAL_UPLOAD.value else None
        self._docs.create(
            ctx,
            company_id=row.company_id,
            dc_challan_id=row.id,
            doc_kind=kind,
            storage_key=key,
            external_url=url,
            original_filename=filename,
            content_type=content_type,
            file_size_bytes=size,
            checksum_sha256=checksum,
            source=source,
            uploaded_by_user_id=uploaded_by,
            uploaded_at=now,
        )
        if kind == DcChallanDocKind.SIGNED.value:
            self._repo.update_row(
                ctx,
                row,
                signed_document_uploaded_at=now,
                signed_document_url=url if url else getattr(row, "signed_document_url", None),
            )
        operation = "document_replaced" if previous_checksum else "document_upload"
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_DOC,
            entity_id=row.id,
            operation=operation,
            performed_by=ctx.user_id,
            new_value={
                "doc_kind": kind,
                "source": source,
                "checksum": checksum,
                "previous_checksum": previous_checksum,
                "filename": filename,
            },
        )
        return key, checksum

    def _apply_document_received(
        self,
        ctx: TenantContext,
        row: AstDcChallan,
        *,
        document_url: str,
        scm_reference_number: str | None,
        actor_id: UUID | None,
    ) -> AstDcChallan:
        del actor_id
        return self._ingest_scm_issued(
            ctx,
            row,
            file_bytes=None,
            original_filename=None,
            declared_content_type=None,
            document_url=document_url,
            scm_reference_number=scm_reference_number,
            source=DcChallanDocSource.MANUAL_UPLOAD.value,
            allow_replace=False,
        )

    def _prefill_snapshots(
        self,
        ctx: TenantContext,
        asset,
        *,
        employee_id: UUID | None,
        assignment=None,
        employee_code: str | None = None,
        employee_name: str | None = None,
        employee_phone: str | None = None,
        employee_email: str | None = None,
    ) -> dict:
        payload: dict = {}
        if asset is not None:
            payload.update(
                {
                    "asset_name": asset.asset_name,
                    "asset_tag": asset.asset_code,
                    "make": asset.make,
                    "model": asset.model,
                    "serial_number": asset.serial_number,
                    "purchase_cost": asset.purchase_cost,
                }
            )
        source = (
            str(getattr(assignment, "employee_source", None) or "").strip()
            if assignment is not None
            else ""
        )
        if assignment is not None and source == "MANUAL_ENTRY":
            payload["employee_code"] = None
            payload["employee_name"] = _blank(employee_name) or _blank(
                getattr(assignment, "manual_employee_name", None)
            )
            payload["employee_phone"] = _blank(employee_phone) or _blank(
                getattr(assignment, "manual_employee_phone", None)
            )
            payload["employee_email"] = _blank(employee_email) or _blank(
                getattr(assignment, "manual_employee_email", None)
            )
            payload["deployed_to"] = _blank(getattr(assignment, "manual_employee_deployed_to", None))
            return payload
        payload["deployed_to"] = None
        if employee_id is not None:
            employee = self._master.get_employee(ctx, employee_id)
            if employee is None:
                raise NotFoundException("Employee not found")
            payload["employee_code"] = _blank(employee_code) or employee.employee_code
            payload["employee_name"] = _blank(employee_name) or format_employee_name(employee)
            payload["employee_phone"] = _blank(employee_phone) or _blank(getattr(employee, "mobile", None))
            payload["employee_email"] = _blank(employee_email) or employee.email
        else:
            payload["employee_code"] = _blank(employee_code)
            payload["employee_name"] = _blank(employee_name)
            payload["employee_phone"] = _blank(employee_phone)
            payload["employee_email"] = _blank(employee_email)
        return payload

    def _sync_assignment_delivery_reference(self, ctx: TenantContext, assignment, dc_number: str) -> None:
        status = getattr(assignment, "delivery_reference_status", None)
        fields: dict = {"delivery_reference_number": dc_number}
        if status == AssignmentDeliveryReferenceStatus.NOT_APPLICABLE.value or not status:
            fields["delivery_reference_status"] = AssignmentDeliveryReferenceStatus.PENDING.value
        self._assignments.update(ctx, assignment.id, **fields)
