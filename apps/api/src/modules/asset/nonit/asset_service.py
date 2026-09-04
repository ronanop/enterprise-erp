"""Non-IT asset inventory, create, assign, and Excel import."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import AppException, ConflictException, NotFoundException
from modules.asset.domain.enums import (
    NonItAssignmentMode,
    NonItAssetStatus,
    NonItTimelineEventType,
)
from modules.asset.nonit.access import ensure_nonit_member_or_permission
from modules.asset.nonit.code_service import NonItCodeService
from modules.asset.nonit.repository_asset import NonItAssetRepository
from modules.asset.nonit.repository_location import NonItLocationRepository
from modules.asset.nonit.repository_timeline import NonItTimelineRepository
from modules.asset.nonit.repository_type import NonItAssetTypeRepository
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.master_data.models.employee import MasterEmployee
from modules.organization.models.branch import OrgBranch


class NonItAssetService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = NonItAssetRepository(db)
        self._types = NonItAssetTypeRepository(db)
        self._locations = NonItLocationRepository(db)
        self._timeline = NonItTimelineRepository(db)
        self._codes = NonItCodeService(db)
        self._scope = AssetScopeValidator(db)
        self._audit = AuditService(db)

    def _ensure_read(self, ctx: TenantContext) -> None:
        ensure_nonit_member_or_permission(ctx, self._db, "asset.nonit_asset:read")

    def _ensure_create(self, ctx: TenantContext) -> None:
        ensure_nonit_member_or_permission(ctx, self._db, "asset.nonit_asset:create")

    def _ensure_update(self, ctx: TenantContext) -> None:
        ensure_nonit_member_or_permission(ctx, self._db, "asset.nonit_asset:update")

    @staticmethod
    def _reject_if_disposed(row) -> None:
        if row.status == NonItAssetStatus.DISPOSED.value:
            raise AppException("Disposed assets are terminal and cannot change status")

    def _resolve_branch(self, ctx: TenantContext, company_id: UUID, branch_id: UUID | None) -> UUID:
        bid = branch_id or ctx.branch_id
        if bid is None:
            bid = self._db.scalar(
                select(OrgBranch.id)
                .where(
                    OrgBranch.company_id == company_id,
                    OrgBranch.tenant_id == ctx.tenant_id,
                    OrgBranch.is_deleted.is_(False),
                )
                .order_by(OrgBranch.created_at.asc())
                .limit(1)
            )
        if bid is None:
            raise AppException("branch_id is required")
        self._scope.validate_branch_access(ctx, bid)
        return bid

    def list(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        asset_type_id: UUID | None = None,
        location_id: UUID | None = None,
        status: str | None = None,
        assignment: str | None = None,
        q: str | None = None,
        page: int = 1,
        page_size: int = 25,
    ) -> tuple[list[dict], int]:
        self._ensure_read(ctx)
        cid = self._scope.resolve_company_id(ctx, company_id)
        offset = (page - 1) * page_size
        rows, total = self._repo.search(
            ctx,
            cid,
            asset_type_id=asset_type_id,
            location_id=location_id,
            status=status,
            assignment=assignment,
            q=q,
            offset=offset,
            limit=page_size,
        )
        return self._enrich(ctx, cid, rows), total

    def dashboard_summary(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
    ) -> dict:
        self._ensure_read(ctx)
        cid = self._scope.resolve_company_id(ctx, company_id)
        raw = self._repo.dashboard_summary(ctx, cid)

        status_order = (
            NonItAssetStatus.IN_STOCK.value,
            NonItAssetStatus.ASSIGNED.value,
            NonItAssetStatus.MAINTENANCE.value,
            NonItAssetStatus.DISPOSED.value,
        )
        status_map = raw["status_map"]
        total = int(raw["total_assets"])
        in_stock = int(status_map.get(NonItAssetStatus.IN_STOCK.value, 0))
        assigned = int(status_map.get(NonItAssetStatus.ASSIGNED.value, 0))
        in_maintenance = int(status_map.get(NonItAssetStatus.MAINTENANCE.value, 0))
        disposed = int(status_map.get(NonItAssetStatus.DISPOSED.value, 0))

        def pct(count: int) -> float:
            if total <= 0:
                return 0.0
            return round((count / total) * 100, 1)

        by_status = [
            {
                "status": s,
                "count": int(status_map.get(s, 0)),
                "pct_of_total": pct(int(status_map.get(s, 0))),
            }
            for s in status_order
        ]

        return {
            "company_id": cid,
            "total_assets": total,
            "in_stock": in_stock,
            "assigned": assigned,
            "in_maintenance": in_maintenance,
            "disposed": disposed,
            "by_status": by_status,
            "by_type": raw["by_type"],
            "by_location": raw["by_location"],
        }

    def get(self, ctx: TenantContext, row_id: UUID, *, include_timeline: bool = False) -> dict:
        self._ensure_read(ctx)
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Non-IT asset not found")
        item = self._enrich(ctx, row.company_id, [row])[0]
        if include_timeline:
            item["timeline"] = self._timeline_dicts(ctx, row)
        return item

    def create(
        self,
        ctx: TenantContext,
        *,
        asset_type_id: UUID,
        status: str = NonItAssetStatus.IN_STOCK.value,
        serial_number: str | None = None,
        condition: str | None = None,
        purchase_date: date | None = None,
        remarks: str | None = None,
        current_employee_id: UUID | None = None,
        current_location_id: UUID | None = None,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
    ) -> dict:
        self._ensure_create(ctx)
        cid = self._scope.resolve_company_id(ctx, company_id)
        bid = self._resolve_branch(ctx, cid, branch_id)

        asset_type = self._types.get(ctx, asset_type_id)
        if asset_type is None or asset_type.company_id != cid:
            raise NotFoundException("Non-IT asset type not found")
        if not asset_type.active:
            raise AppException("Asset type is inactive")

        status_norm = str(status).strip().upper()
        if status_norm not in {
            NonItAssetStatus.IN_STOCK.value,
            NonItAssetStatus.ASSIGNED.value,
        }:
            raise AppException("status at creation must be IN_STOCK or ASSIGNED")

        emp_id, loc_id = self._validate_assignment_targets(
            ctx,
            cid,
            asset_type.assignment_mode,
            status=status_norm,
            employee_id=current_employee_id,
            location_id=current_location_id,
            require_holder=status_norm == NonItAssetStatus.ASSIGNED.value,
        )

        code = self._codes.next_code(ctx, cid, asset_type.id)
        asset = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=bid,
            asset_code=code,
            asset_type_id=asset_type.id,
            status=status_norm,
            serial_number=(serial_number or None),
            condition=(condition or None),
            purchase_date=purchase_date,
            remarks=(remarks or None),
            current_employee_id=emp_id,
            current_location_id=loc_id,
        )
        self._timeline.append(
            ctx,
            asset_id=asset.id,
            event_type=NonItTimelineEventType.CREATED.value,
            event_data={
                "asset_code": code,
                "asset_type": asset_type.name,
                "status": status_norm,
            },
        )
        if status_norm == NonItAssetStatus.ASSIGNED.value:
            self._append_assigned_event(ctx, asset, emp_id, loc_id)

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_nonit_asset",
            entity_id=asset.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return self._enrich(ctx, cid, [asset])[0]

    def assign(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        employee_id: UUID | None = None,
        location_id: UUID | None = None,
        version: int | None = None,
        remarks: str | None = None,
    ) -> dict:
        """Assign or reassign. Reassign appends UNASSIGNED then ASSIGNED."""
        self._ensure_update(ctx)
        row = self._repo.lock_for_update(ctx, row_id)
        if row is None:
            raise NotFoundException("Non-IT asset not found")
        self._reject_if_disposed(row)
        if version is not None and int(row.version or 1) != int(version):
            raise ConflictException("Version conflict")
        if row.status not in {
            NonItAssetStatus.IN_STOCK.value,
            NonItAssetStatus.ASSIGNED.value,
        }:
            raise AppException("Only IN_STOCK or ASSIGNED assets can be assigned")

        asset_type = self._types.get(ctx, row.asset_type_id)
        if asset_type is None:
            raise NotFoundException("Non-IT asset type not found")

        emp_id, loc_id = self._validate_assignment_targets(
            ctx,
            row.company_id,
            asset_type.assignment_mode,
            status=NonItAssetStatus.ASSIGNED.value,
            employee_id=employee_id,
            location_id=location_id,
            require_holder=True,
        )

        if (
            emp_id == row.current_employee_id
            and loc_id == row.current_location_id
            and row.status == NonItAssetStatus.ASSIGNED.value
        ):
            raise AppException("Asset is already assigned to this holder")

        if row.current_employee_id or row.current_location_id:
            self._append_unassigned_event(ctx, row, remarks=remarks)

        updated = self._repo.update(
            ctx,
            row_id,
            current_employee_id=emp_id,
            current_location_id=loc_id,
            status=NonItAssetStatus.ASSIGNED.value,
            version=int(row.version or 1),
        )
        if updated is None:
            raise ConflictException("Version conflict")
        self._append_assigned_event(ctx, updated, emp_id, loc_id, remarks=remarks)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_nonit_asset",
            entity_id=row_id,
            operation="assign",
            performed_by=ctx.user_id,
        )
        return self._enrich(ctx, updated.company_id, [updated])[0]

    def unassign(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        version: int | None = None,
        remarks: str | None = None,
    ) -> dict:
        self._ensure_update(ctx)
        row = self._repo.lock_for_update(ctx, row_id)
        if row is None:
            raise NotFoundException("Non-IT asset not found")
        self._reject_if_disposed(row)
        if version is not None and int(row.version or 1) != int(version):
            raise ConflictException("Version conflict")
        if row.status != NonItAssetStatus.ASSIGNED.value and not (
            row.current_employee_id or row.current_location_id
        ):
            raise AppException("Asset is not currently assigned")

        self._append_unassigned_event(ctx, row, remarks=remarks)
        updated = self._repo.update(
            ctx,
            row_id,
            current_employee_id=None,
            current_location_id=None,
            status=NonItAssetStatus.IN_STOCK.value,
            version=int(row.version or 1),
        )
        if updated is None:
            raise ConflictException("Version conflict")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_nonit_asset",
            entity_id=row_id,
            operation="unassign",
            performed_by=ctx.user_id,
        )
        return self._enrich(ctx, updated.company_id, [updated])[0]

    def start_maintenance(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        maintenance_reason: str,
        maintenance_notes: str | None = None,
        maintenance_provider: str | None = None,
        maintenance_cost: Decimal | None = None,
        version: int | None = None,
    ) -> dict:
        self._ensure_update(ctx)
        row = self._repo.lock_for_update(ctx, row_id)
        if row is None:
            raise NotFoundException("Non-IT asset not found")
        self._reject_if_disposed(row)
        if version is not None and int(row.version or 1) != int(version):
            raise ConflictException("Version conflict")
        if row.status not in {
            NonItAssetStatus.IN_STOCK.value,
            NonItAssetStatus.ASSIGNED.value,
        }:
            raise AppException("Only IN_STOCK or ASSIGNED assets can enter maintenance")

        reason = str(maintenance_reason or "").strip()
        if not reason:
            raise AppException("maintenance_reason is required")

        prior_emp = row.current_employee_id
        prior_loc = row.current_location_id
        prior_holder = self._holder_label(ctx, row.company_id, prior_emp, prior_loc)
        prior_status = row.status

        started_at = datetime.now(timezone.utc)
        updated = self._repo.update(
            ctx,
            row_id,
            status=NonItAssetStatus.MAINTENANCE.value,
            current_employee_id=None,
            current_location_id=None,
            maintenance_reason=reason,
            maintenance_notes=(maintenance_notes or None),
            maintenance_started_at=started_at,
            maintenance_provider=(maintenance_provider or None),
            maintenance_cost=maintenance_cost,
            version=int(row.version or 1),
        )
        if updated is None:
            raise ConflictException("Version conflict")

        self._timeline.append(
            ctx,
            asset_id=row_id,
            event_type=NonItTimelineEventType.MAINTENANCE_STARTED.value,
            event_data={
                "reason": reason,
                "notes": maintenance_notes,
                "provider": maintenance_provider,
                "cost": str(maintenance_cost) if maintenance_cost is not None else None,
                "started_at": started_at.isoformat(),
                "prior_status": prior_status,
                "prior_employee_id": str(prior_emp) if prior_emp else None,
                "prior_location_id": str(prior_loc) if prior_loc else None,
                "prior_holder": prior_holder,
            },
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_nonit_asset",
            entity_id=row_id,
            operation="maintenance_start",
            performed_by=ctx.user_id,
        )
        return self._enrich(ctx, updated.company_id, [updated])[0]

    def complete_maintenance(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        completion_notes: str | None = None,
        completion_date: date | None = None,
        restore_prior_holder: bool = False,
        version: int | None = None,
    ) -> dict:
        self._ensure_update(ctx)
        row = self._repo.lock_for_update(ctx, row_id)
        if row is None:
            raise NotFoundException("Non-IT asset not found")
        self._reject_if_disposed(row)
        if version is not None and int(row.version or 1) != int(version):
            raise ConflictException("Version conflict")
        if row.status != NonItAssetStatus.MAINTENANCE.value:
            raise AppException("Asset is not in maintenance")

        started = self._timeline.latest_of_type(
            row_id, NonItTimelineEventType.MAINTENANCE_STARTED.value
        )
        prior_data = (started.event_data or {}) if started else {}
        prior_emp_raw = prior_data.get("prior_employee_id")
        prior_loc_raw = prior_data.get("prior_location_id")
        prior_emp = UUID(str(prior_emp_raw)) if prior_emp_raw else None
        prior_loc = UUID(str(prior_loc_raw)) if prior_loc_raw else None
        has_prior = bool(prior_emp or prior_loc)

        new_status = NonItAssetStatus.IN_STOCK.value
        new_emp: UUID | None = None
        new_loc: UUID | None = None
        if restore_prior_holder and has_prior:
            new_status = NonItAssetStatus.ASSIGNED.value
            new_emp = prior_emp
            new_loc = prior_loc

        completed = completion_date or date.today()
        updated = self._repo.update(
            ctx,
            row_id,
            status=new_status,
            current_employee_id=new_emp,
            current_location_id=new_loc,
            maintenance_reason=None,
            maintenance_notes=None,
            maintenance_started_at=None,
            maintenance_provider=None,
            maintenance_cost=None,
            version=int(row.version or 1),
        )
        if updated is None:
            raise ConflictException("Version conflict")

        self._timeline.append(
            ctx,
            asset_id=row_id,
            event_type=NonItTimelineEventType.MAINTENANCE_COMPLETED.value,
            event_data={
                "completion_notes": completion_notes,
                "completion_date": completed.isoformat(),
                "result_status": new_status,
                "restored_prior_holder": bool(restore_prior_holder and has_prior),
                "prior_holder": prior_data.get("prior_holder"),
            },
            remarks=completion_notes,
        )
        if new_status == NonItAssetStatus.ASSIGNED.value:
            self._append_assigned_event(ctx, updated, new_emp, new_loc)

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_nonit_asset",
            entity_id=row_id,
            operation="maintenance_complete",
            performed_by=ctx.user_id,
        )
        return self._enrich(ctx, updated.company_id, [updated])[0]

    def dispose(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        disposal_reason: str,
        disposal_date: date | None = None,
        remarks: str | None = None,
        version: int | None = None,
    ) -> dict:
        self._ensure_update(ctx)
        row = self._repo.lock_for_update(ctx, row_id)
        if row is None:
            raise NotFoundException("Non-IT asset not found")
        self._reject_if_disposed(row)
        if version is not None and int(row.version or 1) != int(version):
            raise ConflictException("Version conflict")
        if row.status not in {
            NonItAssetStatus.IN_STOCK.value,
            NonItAssetStatus.ASSIGNED.value,
            NonItAssetStatus.MAINTENANCE.value,
        }:
            raise AppException("Asset cannot be disposed from current status")

        reason = str(disposal_reason or "").strip()
        if not reason:
            raise AppException("disposal_reason is required")
        disposed_on = disposal_date or date.today()

        updated = self._repo.update(
            ctx,
            row_id,
            status=NonItAssetStatus.DISPOSED.value,
            current_employee_id=None,
            current_location_id=None,
            disposal_reason=reason,
            disposal_date=disposed_on,
            remarks=remarks if remarks is not None else row.remarks,
            maintenance_reason=None,
            maintenance_notes=None,
            maintenance_started_at=None,
            maintenance_provider=None,
            maintenance_cost=None,
            version=int(row.version or 1),
        )
        if updated is None:
            raise ConflictException("Version conflict")

        # Soft-deleted rows still count toward code MAX — dispose must not free codes.
        self._timeline.append(
            ctx,
            asset_id=row_id,
            event_type=NonItTimelineEventType.DISPOSED.value,
            event_data={
                "reason": reason,
                "disposal_date": disposed_on.isoformat(),
                "remarks": remarks,
            },
            remarks=remarks,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_nonit_asset",
            entity_id=row_id,
            operation="dispose",
            performed_by=ctx.user_id,
        )
        return self._enrich(ctx, updated.company_id, [updated])[0]

    def import_rows(
        self,
        ctx: TenantContext,
        rows: list[dict],
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
    ) -> dict:
        """Create N IN_STOCK assets per {asset_type, quantity} row; one IMPORTED timeline each."""
        self._ensure_create(ctx)
        cid = self._scope.resolve_company_id(ctx, company_id)
        bid = self._resolve_branch(ctx, cid, branch_id)

        summaries: list[dict] = []
        total_created = 0

        for raw in rows:
            type_name = str(raw.get("asset_type") or "").strip()
            quantity = int(raw.get("quantity") or 0)
            if not type_name:
                raise AppException("asset_type is required on each import row")
            if quantity < 1:
                raise AppException(f"quantity must be >= 1 for type '{type_name}'")

            asset_type = self._types.get_by_name(ctx, cid, type_name)
            if asset_type is None:
                raise AppException(f"Unknown asset type: {type_name}")
            if not asset_type.active:
                raise AppException(f"Asset type '{type_name}' is inactive")

            codes = self._codes.next_codes(ctx, cid, asset_type.id, quantity)
            created = 0
            for code in codes:
                asset = self._repo.create(
                    ctx,
                    company_id=cid,
                    branch_id=bid,
                    asset_code=code,
                    asset_type_id=asset_type.id,
                    status=NonItAssetStatus.IN_STOCK.value,
                )
                self._timeline.append(
                    ctx,
                    asset_id=asset.id,
                    event_type=NonItTimelineEventType.IMPORTED.value,
                    event_data={
                        "asset_code": code,
                        "asset_type": type_name,
                        "source": "excel_import",
                    },
                    remarks="Imported via Excel",
                )
                self._audit.log_entity_change(
                    tenant_id=ctx.tenant_id,
                    entity_name="ast_nonit_asset",
                    entity_id=asset.id,
                    operation="create",
                    performed_by=ctx.user_id,
                )
                created += 1
            summaries.append(
                {"asset_type": type_name, "requested": quantity, "created": created}
            )
            total_created += created

        return {"lines": summaries, "total_created": total_created}

    def _validate_assignment_targets(
        self,
        ctx: TenantContext,
        company_id: UUID,
        assignment_mode: str,
        *,
        status: str,
        employee_id: UUID | None,
        location_id: UUID | None,
        require_holder: bool,
    ) -> tuple[UUID | None, UUID | None]:
        mode = str(assignment_mode).strip().upper()
        emp_id = employee_id
        loc_id = location_id

        if status == NonItAssetStatus.IN_STOCK.value:
            return None, None

        if emp_id and loc_id:
            raise AppException("Provide either employee or location, not both")
        if require_holder and not emp_id and not loc_id:
            raise AppException("Assignment requires an employee or location")

        if emp_id:
            if mode == NonItAssignmentMode.LOCATION.value:
                raise AppException("This asset type can only be assigned to a location")
            emp = self._db.scalar(
                select(MasterEmployee).where(
                    MasterEmployee.id == emp_id,
                    MasterEmployee.company_id == company_id,
                    MasterEmployee.is_deleted.is_(False),
                )
            )
            if emp is None:
                raise AppException("Employee not found")
            return emp_id, None

        if loc_id:
            if mode == NonItAssignmentMode.EMPLOYEE.value:
                raise AppException("This asset type can only be assigned to an employee")
            loc = self._locations.get(ctx, loc_id)
            if loc is None or loc.company_id != company_id:
                raise AppException("Location not found")
            if not loc.active:
                raise AppException("Location is inactive")
            return None, loc_id

        return None, None

    def _append_assigned_event(
        self,
        ctx: TenantContext,
        asset,
        employee_id: UUID | None,
        location_id: UUID | None,
        *,
        remarks: str | None = None,
    ) -> None:
        holder = self._holder_label(ctx, asset.company_id, employee_id, location_id)
        self._timeline.append(
            ctx,
            asset_id=asset.id,
            event_type=NonItTimelineEventType.ASSIGNED.value,
            event_data={
                "employee_id": str(employee_id) if employee_id else None,
                "location_id": str(location_id) if location_id else None,
                "holder": holder,
            },
            remarks=remarks,
        )

    def _append_unassigned_event(
        self,
        ctx: TenantContext,
        asset,
        *,
        remarks: str | None = None,
    ) -> None:
        holder = self._holder_label(
            ctx,
            asset.company_id,
            asset.current_employee_id,
            asset.current_location_id,
        )
        self._timeline.append(
            ctx,
            asset_id=asset.id,
            event_type=NonItTimelineEventType.UNASSIGNED.value,
            event_data={
                "employee_id": str(asset.current_employee_id)
                if asset.current_employee_id
                else None,
                "location_id": str(asset.current_location_id)
                if asset.current_location_id
                else None,
                "holder": holder,
            },
            remarks=remarks,
        )

    def _holder_label(
        self,
        ctx: TenantContext,
        company_id: UUID,
        employee_id: UUID | None,
        location_id: UUID | None,
    ) -> str | None:
        if employee_id:
            employees = self._repo.employees_by_ids(company_id, [employee_id])
            emp = employees.get(employee_id)
            if emp:
                return f"{emp.first_name} {emp.last_name}".strip()
        if location_id:
            locations = self._repo.locations_by_ids(ctx, [location_id])
            loc = locations.get(location_id)
            if loc:
                return loc.name
        return None

    def _timeline_dicts(self, ctx: TenantContext, asset) -> list[dict]:
        rows = self._timeline.list_for_asset(asset.id)
        out: list[dict] = []
        for ev in rows:
            data = ev.event_data or {}
            holder = data.get("holder")
            summary = self._humanize_event(ev.event_type, data, holder)
            out.append(
                {
                    "id": ev.id,
                    "event_type": ev.event_type,
                    "event_data": data,
                    "occurred_at": ev.occurred_at,
                    "actor_user_id": ev.actor_user_id,
                    "remarks": ev.remarks,
                    "summary": summary,
                }
            )
        return out

    @staticmethod
    def _humanize_event(event_type: str, data: dict, holder: str | None) -> str:
        if event_type == NonItTimelineEventType.CREATED.value:
            return "Created"
        if event_type == NonItTimelineEventType.IMPORTED.value:
            return "Imported"
        if event_type == NonItTimelineEventType.ASSIGNED.value:
            return f"Assigned to {holder}" if holder else "Assigned"
        if event_type == NonItTimelineEventType.UNASSIGNED.value:
            return f"Unassigned from {holder}" if holder else "Unassigned"
        if event_type == NonItTimelineEventType.LOCATION_CHANGED.value:
            return "Location changed"
        if event_type == NonItTimelineEventType.STATUS_CHANGED.value:
            return f"Status changed to {data.get('status') or 'unknown'}"
        if event_type == NonItTimelineEventType.MAINTENANCE_STARTED.value:
            reason = data.get("reason")
            return f"Maintenance started — {reason}" if reason else "Maintenance started"
        if event_type == NonItTimelineEventType.MAINTENANCE_COMPLETED.value:
            if data.get("restored_prior_holder") and data.get("prior_holder"):
                return f"Maintenance completed — reassigned to {data.get('prior_holder')}"
            return "Maintenance completed"
        if event_type == NonItTimelineEventType.DISPOSED.value:
            reason = data.get("reason")
            return f"Disposed — {reason}" if reason else "Disposed"
        return event_type.replace("_", " ").title()

    def _prior_holder_from_maintenance(self, asset_id: UUID) -> dict:
        started = self._timeline.latest_of_type(
            asset_id, NonItTimelineEventType.MAINTENANCE_STARTED.value
        )
        data = (started.event_data or {}) if started else {}
        prior_emp = data.get("prior_employee_id")
        prior_loc = data.get("prior_location_id")
        return {
            "prior_holder_available": bool(prior_emp or prior_loc),
            "prior_holder_label": data.get("prior_holder"),
            "prior_employee_id": prior_emp,
            "prior_location_id": prior_loc,
        }

    def _enrich(self, ctx: TenantContext, company_id: UUID, rows) -> list[dict]:
        type_ids = list({r.asset_type_id for r in rows})
        emp_ids = [r.current_employee_id for r in rows if r.current_employee_id]
        loc_ids = [r.current_location_id for r in rows if r.current_location_id]
        types = self._repo.types_by_ids(ctx, type_ids)
        employees = self._repo.employees_by_ids(company_id, emp_ids)
        locations = self._repo.locations_by_ids(ctx, loc_ids)

        out: list[dict] = []
        for r in rows:
            t = types.get(r.asset_type_id)
            emp = employees.get(r.current_employee_id) if r.current_employee_id else None
            loc = locations.get(r.current_location_id) if r.current_location_id else None
            emp_name = (
                f"{emp.first_name} {emp.last_name}".strip() if emp is not None else None
            )
            loc_name = loc.name if loc is not None else None
            assignment = emp_name or loc_name
            prior = (
                self._prior_holder_from_maintenance(r.id)
                if r.status == NonItAssetStatus.MAINTENANCE.value
                else {
                    "prior_holder_available": False,
                    "prior_holder_label": None,
                    "prior_employee_id": None,
                    "prior_location_id": None,
                }
            )
            out.append(
                {
                    "id": r.id,
                    "asset_code": r.asset_code,
                    "asset_type_id": r.asset_type_id,
                    "asset_type_name": t.name if t else None,
                    "asset_type_prefix": t.prefix if t else None,
                    "assignment_mode": t.assignment_mode if t else None,
                    "status": r.status,
                    "serial_number": r.serial_number,
                    "condition": r.condition,
                    "current_employee_id": r.current_employee_id,
                    "current_employee_name": emp_name,
                    "current_location_id": r.current_location_id,
                    "current_location_name": loc_name,
                    "assignment_display": assignment,
                    "purchase_date": r.purchase_date,
                    "remarks": r.remarks,
                    "maintenance_reason": r.maintenance_reason,
                    "maintenance_notes": r.maintenance_notes,
                    "maintenance_started_at": r.maintenance_started_at,
                    "maintenance_provider": r.maintenance_provider,
                    "maintenance_cost": r.maintenance_cost,
                    "disposal_reason": r.disposal_reason,
                    "disposal_date": r.disposal_date,
                    "prior_holder_available": prior["prior_holder_available"],
                    "prior_holder_label": prior["prior_holder_label"],
                    "company_id": r.company_id,
                    "branch_id": r.branch_id,
                    "version": int(r.version or 1),
                    "created_at": r.created_at,
                }
            )
        return out
