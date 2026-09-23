"""Asset Information Portal / Self-Service read composition (CR-002).

Read-only. Always loads the asset through AssetService.
Never exposes finance, workflow, or cost fields.
"""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.domain.enums import AssetAssignmentStatus, AssetMaintenanceStatus
from modules.asset.domain.operational_status_audit_events import OperationalStatusAuditEvent
from modules.asset.domain.workflow_codes import ENTITY_AST_ASSET
from modules.asset.repository.asset_assignment_repository import (
    AssetAssignmentListFilters,
    AssetAssignmentRepository,
)
from modules.asset.repository.asset_category_repository import AssetCategoryRepository
from modules.asset.repository.asset_insurance_repository import AssetInsuranceRepository
from modules.asset.repository.asset_maintenance_repository import (
    AssetMaintenanceListFilters,
    AssetMaintenanceRepository,
)
from modules.asset.repository.asset_warranty_repository import AssetWarrantyRepository
from modules.asset.schemas import (
    AssetInformationPortalResponse,
    AssetLifecycleTimelineEvent,
    AssetPortalAssignmentSummary,
    AssetPortalInsuranceSummary,
    AssetPortalWarrantySummary,
)
from modules.asset.service.asset_service import AssetService
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

_OPS_LABELS = {
    "READY_TO_MOVE": "Ready to Move",
    "ASSIGNED": "Assigned",
    "IN_MAINTENANCE": "In Maintenance",
    "RETIRED": "Retired",
    "PENDING_DISPOSAL": "Pending Disposal",
    "DISPOSED": "Disposed",
    "IN_USE_AS_COMPONENT": "In Use as Component",
}

_LIFECYCLE_LABELS = {
    "draft": "Draft",
    "submitted": "Registered",
    "approved": "Approved",
    "active": "Active",
    "in_maintenance": "In Maintenance",
    "disposed": "Disposed",
    "written_off": "Written Off",
}

_MAINT_OPEN = {
    AssetMaintenanceStatus.SUBMITTED.value,
    AssetMaintenanceStatus.APPROVED.value,
    AssetMaintenanceStatus.SCHEDULED.value,
    AssetMaintenanceStatus.IN_PROGRESS.value,
}


def _as_utc_datetime(value: object | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    if isinstance(value, date):
        return datetime.combine(value, time.min, tzinfo=timezone.utc)
    if isinstance(value, str) and value.strip():
        raw = value.strip().replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(raw)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    return None


def _ops_label(value: object | None) -> str:
    key = str(value or "").strip().upper().replace("-", "_")
    return _OPS_LABELS.get(key, key.replace("_", " ").title() if key else "—")


def _lifecycle_label(value: object | None) -> str:
    key = str(value or "").strip().lower()
    return _LIFECYCLE_LABELS.get(key, key.replace("_", " ").title() if key else "—")


def _fmt_pair(items: dict[str, object | None]) -> str | None:
    parts = [f"{k}: {v}" for k, v in items.items() if v not in (None, "", "—")]
    return "; ".join(parts) if parts else None


class AssetInformationPortalService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._assets = AssetService(db)
        self._categories = AssetCategoryRepository(db)
        self._assignments = AssetAssignmentRepository(db)
        self._maintenances = AssetMaintenanceRepository(db)
        self._warranties = AssetWarrantyRepository(db)
        self._insurances = AssetInsuranceRepository(db)
        self._master = AssetMasterDataAdapter(db)
        self._audit = AuditService(db)

    def get_portal(self, ctx: TenantContext, asset_id: UUID) -> AssetInformationPortalResponse:
        """Build redacted portal/self-service profile for an authenticated caller."""
        asset = self._assets.get(ctx, asset_id)

        category_code = None
        category_name = None
        category = self._categories.get(ctx, asset.asset_category_id)
        if category is not None:
            category_code = category.category_code
            category_name = category.category_name

        manufacturer = self._safe_vendor_name(ctx, asset.supplier_vendor_id)
        model = self._safe_product_model(ctx, asset.product_id)

        return AssetInformationPortalResponse(
            asset_id=asset.id,
            asset_code=asset.asset_code,
            asset_name=asset.asset_name,
            category_code=category_code,
            category_name=category_name,
            manufacturer=manufacturer,
            model=model,
            serial_number=asset.serial_number,
            asset_type=asset.asset_type,
            status=asset.status,
            operational_status=getattr(asset, "operational_status", None),
            assignment=self._active_assignment(ctx, company_id=asset.company_id, asset_id=asset.id),
            warranty=self._warranty_summary(ctx, company_id=asset.company_id, asset_id=asset.id),
            insurance=self._insurance_summary(
                ctx, company_id=asset.company_id, asset_id=asset.id
            ),
            self_service_path=f"/assets/information-portal/{asset.id}?from=qr",
            discovery_profile_json=getattr(asset, "discovery_profile_json", None),
            version=int(asset.version or 1),
            created_at=getattr(asset, "created_at", None),
            updated_at=getattr(asset, "updated_at", None),
        )

    def get_self_service(
        self, ctx: TenantContext, asset_id: UUID
    ) -> AssetInformationPortalResponse:
        """Alias for portal profile — reserved for future signed-token entry."""
        return self.get_portal(ctx, asset_id)

    def get_lifecycle_timeline(
        self, ctx: TenantContext, asset_id: UUID
    ) -> list[AssetLifecycleTimelineEvent]:
        """Compose a full asset lifecycle timeline for Information Portal Activity Logs.

        Merges asset audit events with assignment and maintenance domain milestones.
        """
        asset = self._assets.get(ctx, asset_id)
        events: list[AssetLifecycleTimelineEvent] = []

        events.extend(self._events_from_asset_audits(ctx, asset_id=asset.id))
        events.extend(
            self._events_from_assignments(ctx, company_id=asset.company_id, asset_id=asset.id)
        )
        events.extend(
            self._events_from_maintenances(ctx, company_id=asset.company_id, asset_id=asset.id)
        )

        # Fallback create marker when no create audit exists yet (legacy rows).
        if not any(e.kind == "created" for e in events):
            created_at = _as_utc_datetime(getattr(asset, "created_at", None))
            if created_at is not None:
                events.append(
                    AssetLifecycleTimelineEvent(
                        id=f"asset-created-{asset.id}",
                        kind="created",
                        stage="Created",
                        title="Asset added to register",
                        detail=f"{asset.asset_code} — {asset.asset_name}",
                        occurred_at=created_at,
                        reference_id=asset.id,
                        reference_label=asset.asset_code,
                    )
                )

        events.sort(
            key=lambda e: e.occurred_at or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        return events

    def _events_from_asset_audits(
        self, ctx: TenantContext, *, asset_id: UUID
    ) -> list[AssetLifecycleTimelineEvent]:
        rows = self._audit.list_logs_for_entity(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSET,
            entity_id=asset_id,
        )
        out: list[AssetLifecycleTimelineEvent] = []
        for entry in rows:
            mapped = self._map_asset_audit(entry)
            if mapped is not None:
                out.append(mapped)
        return out

    def _map_asset_audit(self, entry) -> AssetLifecycleTimelineEvent | None:
        op = str(getattr(entry, "operation", "") or "").strip()
        old_v = getattr(entry, "old_value", None) or {}
        new_v = getattr(entry, "new_value", None) or {}
        if not isinstance(old_v, dict):
            old_v = {}
        if not isinstance(new_v, dict):
            new_v = {}

        occurred = _as_utc_datetime(getattr(entry, "performed_at", None))
        eid = f"audit-{entry.id}"

        if op == "create":
            return AssetLifecycleTimelineEvent(
                id=eid,
                kind="created",
                stage="Created",
                title="Asset added to register",
                detail=None,
                occurred_at=occurred,
                reference_id=getattr(entry, "entity_id", None),
            )

        if op in {
            OperationalStatusAuditEvent.OPERATIONAL_STATUS_CHANGED,
            OperationalStatusAuditEvent.ASSIGNMENT_RETURNED,
            OperationalStatusAuditEvent.RETIRED,
            OperationalStatusAuditEvent.DISPOSED,
            "OperationalStatusChanged",
            "AssignmentReturned",
            "Retired",
            "Disposed",
        }:
            old_ops = old_v.get("operational_status")
            new_ops = new_v.get("operational_status")
            action = str(new_v.get("action") or old_v.get("action") or "").strip()
            title = "Operational status changed"
            kind = "status"
            stage = "Status"
            if action == "assign" or str(new_ops or "").upper() == "ASSIGNED":
                title = "Marked as assigned"
                kind = "assigned"
                stage = "Assignment"
            elif action == "return_to_ready" or op in {
                OperationalStatusAuditEvent.ASSIGNMENT_RETURNED,
                "AssignmentReturned",
            }:
                title = "Returned to ready-to-move"
                kind = "returned"
                stage = "Assignment"
            elif op in {OperationalStatusAuditEvent.RETIRED, "Retired"}:
                title = "Asset retired"
                kind = "status"
                stage = "Retirement"
            elif op in {OperationalStatusAuditEvent.DISPOSED, "Disposed"}:
                title = "Asset disposed"
                kind = "status"
                stage = "Disposal"
            elif str(new_ops or "").upper() == "IN_MAINTENANCE":
                title = "Operational status set to In Maintenance"
                kind = "status"
                stage = "Status"
            approval = new_v.get("management_approved")
            approval_label = None
            if approval is True:
                approval_label = "Yes / Approved"
            elif approval is False:
                approval_label = "No / Not Approved"
            detail = _fmt_pair(
                {
                    "From": _ops_label(old_ops) if old_ops else None,
                    "To": _ops_label(new_ops) if new_ops else None,
                    "Disposal date": new_v.get("disposal_date"),
                    "Reason": new_v.get("reason")
                    or new_v.get("remarks")
                    or old_v.get("reason"),
                    "Management approval": approval_label,
                    "Document": new_v.get("disposal_document_number"),
                }
            )
            return AssetLifecycleTimelineEvent(
                id=eid,
                kind=kind,
                stage=stage,
                title=title,
                detail=detail,
                occurred_at=occurred,
                reference_id=getattr(entry, "entity_id", None),
            )

        if op in {"submit", "approve", "reject", "cancel", "activate"}:
            status_new = new_v.get("status")
            return AssetLifecycleTimelineEvent(
                id=eid,
                kind="status",
                stage="Lifecycle",
                title=f"Lifecycle {op}",
                detail=_fmt_pair(
                    {
                        "Status": _lifecycle_label(status_new) if status_new else op.title(),
                    }
                ),
                occurred_at=occurred,
                reference_id=getattr(entry, "entity_id", None),
            )

        if op == "update":
            # Skip noisy empty updates; surface meaningful field diffs when present.
            interesting = {
                k: new_v.get(k)
                for k in (
                    "asset_name",
                    "serial_number",
                    "status",
                    "operational_status",
                    "branch_id",
                    "department_id",
                    "location_label",
                    "make",
                    "model",
                )
                if k in new_v and new_v.get(k) is not None
            }
            detail_parts: list[str] = []
            for key, val in interesting.items():
                before = old_v.get(key)
                if key == "status":
                    detail_parts.append(
                        f"Lifecycle: {_lifecycle_label(before)} → {_lifecycle_label(val)}"
                    )
                elif key == "operational_status":
                    detail_parts.append(f"Ops: {_ops_label(before)} → {_ops_label(val)}")
                elif before is not None and str(before) != str(val):
                    detail_parts.append(f"{key}: {before} → {val}")
                else:
                    detail_parts.append(f"{key}: {val}")
            return AssetLifecycleTimelineEvent(
                id=eid,
                kind="updated",
                stage="Updated",
                title="Asset details updated",
                detail="; ".join(detail_parts) if detail_parts else None,
                occurred_at=occurred,
                reference_id=getattr(entry, "entity_id", None),
            )

        # Unknown audit ops still surface so lifecycle is complete.
        return AssetLifecycleTimelineEvent(
            id=eid,
            kind="other",
            stage="Activity",
            title=op.replace("_", " ").title() if op else "Asset activity",
            detail=_fmt_pair({str(k): v for k, v in list(new_v.items())[:6]}),
            occurred_at=occurred,
            reference_id=getattr(entry, "entity_id", None),
        )

    def _events_from_assignments(
        self, ctx: TenantContext, *, company_id: UUID, asset_id: UUID
    ) -> list[AssetLifecycleTimelineEvent]:
        rows, _ = self._assignments.search(
            ctx,
            AssetAssignmentListFilters(company_id=company_id, asset_id=asset_id),
            offset=0,
            limit=100,
        )
        out: list[AssetLifecycleTimelineEvent] = []
        for row in rows:
            status = str(row.status or "").lower()
            if status in {
                AssetAssignmentStatus.DRAFT.value,
                AssetAssignmentStatus.SUBMITTED.value,
                "cancelled",
                "canceled",
            }:
                continue
            assignee = self._assignee_label(ctx, row)
            allocated_at = _as_utc_datetime(row.allocated_at) or _as_utc_datetime(
                getattr(row, "created_at", None)
            )
            if allocated_at is not None:
                out.append(
                    AssetLifecycleTimelineEvent(
                        id=f"asn-assign-{row.id}",
                        kind="assigned",
                        stage="Assigned",
                        title=f"Assigned to {assignee}",
                        detail=_fmt_pair(
                            {
                                "Document": row.document_number,
                                "Allocation": row.allocation_type,
                                "Remarks": getattr(row, "assignment_remarks", None),
                            }
                        ),
                        occurred_at=allocated_at,
                        actor_label=assignee,
                        reference_id=row.id,
                        reference_label=row.document_number,
                    )
                )
            returned_at = _as_utc_datetime(row.returned_at)
            if returned_at is not None or status == AssetAssignmentStatus.RETURNED.value:
                out.append(
                    AssetLifecycleTimelineEvent(
                        id=f"asn-return-{row.id}",
                        kind="returned",
                        stage="Returned",
                        title=f"De-assigned from {assignee}",
                        detail=_fmt_pair(
                            {
                                "Document": row.document_number,
                                "Previous user": assignee,
                                "Return remarks": getattr(row, "return_remarks", None),
                            }
                        ),
                        occurred_at=returned_at or allocated_at,
                        actor_label=assignee,
                        reference_id=row.id,
                        reference_label=row.document_number,
                    )
                )
        return out

    def _events_from_maintenances(
        self, ctx: TenantContext, *, company_id: UUID, asset_id: UUID
    ) -> list[AssetLifecycleTimelineEvent]:
        rows, _ = self._maintenances.search(
            ctx,
            AssetMaintenanceListFilters(company_id=company_id, asset_id=asset_id),
            offset=0,
            limit=100,
        )
        out: list[AssetLifecycleTimelineEvent] = []
        for row in rows:
            status = str(row.status or "").lower()
            if status == AssetMaintenanceStatus.DRAFT.value:
                continue
            if status == AssetMaintenanceStatus.CANCELLED.value:
                cancelled_at = _as_utc_datetime(getattr(row, "updated_at", None)) or _as_utc_datetime(
                    getattr(row, "created_at", None)
                )
                out.append(
                    AssetLifecycleTimelineEvent(
                        id=f"maint-cancel-{row.id}",
                        kind="other",
                        stage="Cancelled",
                        title="Maintenance cancelled",
                        detail=_fmt_pair(
                            {
                                "Work order": row.document_number,
                                "Type": row.maintenance_type,
                                "Reason": row.reason,
                            }
                        ),
                        occurred_at=cancelled_at,
                        reference_id=row.id,
                        reference_label=row.document_number,
                    )
                )
                continue

            started_at = _as_utc_datetime(getattr(row, "created_at", None)) or _as_utc_datetime(
                row.scheduled_date
            )
            if status in _MAINT_OPEN or status == AssetMaintenanceStatus.COMPLETED.value:
                out.append(
                    AssetLifecycleTimelineEvent(
                        id=f"maint-start-{row.id}",
                        kind="maintenance_started",
                        stage="Maintenance started",
                        title="Entered maintenance",
                        detail=_fmt_pair(
                            {
                                "Work order": row.document_number,
                                "Type": row.maintenance_type,
                                "Reason": row.reason,
                                "Status": status.replace("_", " ").title(),
                            }
                        ),
                        occurred_at=started_at,
                        reference_id=row.id,
                        reference_label=row.document_number,
                    )
                )

            if status == AssetMaintenanceStatus.COMPLETED.value:
                completed_at = _as_utc_datetime(row.completed_date) or _as_utc_datetime(
                    getattr(row, "updated_at", None)
                )
                out.append(
                    AssetLifecycleTimelineEvent(
                        id=f"maint-complete-{row.id}",
                        kind="maintenance_completed",
                        stage="Maintenance completed",
                        title="Maintenance completed",
                        detail=_fmt_pair(
                            {
                                "Work order": row.document_number,
                                "Type": row.maintenance_type,
                                "Reason": row.reason,
                            }
                        ),
                        occurred_at=completed_at or started_at,
                        reference_id=row.id,
                        reference_label=row.document_number,
                    )
                )
        return out

    def _assignee_label(self, ctx: TenantContext, row) -> str:
        if getattr(row, "manual_employee_name", None):
            return str(row.manual_employee_name).strip() or "Manual assignee"
        if row.employee_id is not None:
            try:
                emp = self._master.get_employee(ctx, row.employee_id)
                name = f"{emp.first_name} {emp.last_name}".strip()
                code = getattr(emp, "employee_code", None)
                if code and name:
                    return f"{code} — {name}"
                return name or str(code or row.employee_id)
            except NotFoundException:
                return str(row.employee_id)
        return str(row.allocation_type or "Unassigned")

    def _safe_vendor_name(self, ctx: TenantContext, vendor_id: UUID | None) -> str | None:
        if vendor_id is None:
            return None
        try:
            vendor = self._master.get_vendor(ctx, vendor_id)
        except NotFoundException:
            return None
        return getattr(vendor, "vendor_name", None)

    def _safe_product_model(self, ctx: TenantContext, product_id: UUID | None) -> str | None:
        if product_id is None:
            return None
        try:
            product = self._master.get_product(ctx, product_id)
        except NotFoundException:
            return None
        return getattr(product, "product_name", None) or getattr(product, "product_code", None)

    def _active_assignment(
        self, ctx: TenantContext, *, company_id: UUID, asset_id: UUID
    ) -> AssetPortalAssignmentSummary | None:
        rows, _ = self._assignments.search(
            ctx,
            AssetAssignmentListFilters(
                company_id=company_id,
                asset_id=asset_id,
                status=AssetAssignmentStatus.ACTIVE.value,
            ),
            offset=0,
            limit=1,
        )
        if not rows:
            return None
        row = rows[0]
        label = None
        if row.employee_id is not None:
            try:
                emp = self._master.get_employee(ctx, row.employee_id)
                label = f"{emp.employee_code} — {emp.first_name} {emp.last_name}".strip()
            except NotFoundException:
                label = None
        if label is None:
            label = row.allocation_type
        return AssetPortalAssignmentSummary(
            document_number=row.document_number,
            allocation_type=row.allocation_type,
            status=row.status,
            assignee_label=label,
        )

    def _warranty_summary(
        self, ctx: TenantContext, *, company_id: UUID, asset_id: UUID
    ) -> AssetPortalWarrantySummary | None:
        row = self._warranties.find_open_for_asset(
            ctx, company_id=company_id, asset_id=asset_id
        )
        if row is None:
            return None
        return AssetPortalWarrantySummary(
            warranty_type=row.warranty_type,
            status=row.status,
            start_date=row.start_date,
            end_date=row.end_date,
        )

    def _insurance_summary(
        self, ctx: TenantContext, *, company_id: UUID, asset_id: UUID
    ) -> AssetPortalInsuranceSummary | None:
        row = self._insurances.find_open_for_asset(
            ctx, company_id=company_id, asset_id=asset_id
        )
        if row is None:
            return None
        return AssetPortalInsuranceSummary(
            policy_number=row.policy_number,
            insurer_name=row.insurer_name,
            status=row.status,
            start_date=row.start_date,
            end_date=row.end_date,
        )
