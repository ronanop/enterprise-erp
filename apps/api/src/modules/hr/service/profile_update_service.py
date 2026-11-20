"""Employee personal-detail update requests (ESS → HR)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.repository.profile_update_repository import ProfileUpdateRequestRepository
from modules.hr.service.hr_scope_validator import HrScopeValidator


class ProfileUpdateRequestService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = ProfileUpdateRequestRepository(db)
        self._scope = HrScopeValidator(db)
        self._master = HrMasterDataAdapter(db)
        self._audit = PlatformAuditFacade(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Profile update request not found")
        return row

    def list_for_employee(
        self, ctx: TenantContext, *, company_id: UUID, employee_id: UUID
    ):
        return self._repo.list_for_employee(
            ctx, company_id=company_id, employee_id=employee_id
        )

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        company_id: UUID | None = None,
        notes: str | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        pending = self._repo.find_pending_for_employee(
            ctx, company_id=cid, employee_id=employee_id
        )
        if pending is not None:
            raise AppException(
                "You already have a detail update request pending HR review"
            )
        note_text = (notes or "").strip() or None
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            notes=note_text,
            status="submitted",
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_profile_update_request",
            entity_id=row.id,
            operation="submit",
            performed_by=ctx.user_id,
        )
        try:
            from modules.hr.service.hr_notify import (
                notify_employee,
                notify_users_with_permission,
            )
            from modules.master_data.models.employee import MasterEmployee

            emp = self._db.get(MasterEmployee, employee_id)
            emp_name = (
                f"{emp.first_name} {emp.last_name}".strip()
                if emp is not None
                else "Employee"
            )
            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=employee_id,
                template_code="hr.profile_update_submitted",
                template_name="Detail Update Submitted",
                event_type="hr.profile_update_submitted",
                title="Detail update request submitted",
                body="Your personal detail update request is pending HR review.",
                kind="profile_update",
                cc_reporting_manager=False,
                extra={
                    "profile_update_request_id": str(row.id),
                    "href": "/profile/personal",
                },
            )
            exclude: set[UUID] = set()
            if ctx.user_id:
                exclude.add(ctx.user_id)
            detail = note_text or "No notes provided"
            notify_users_with_permission(
                self._db,
                tenant_id=ctx.tenant_id,
                permission_code="hr.employee_profile:update",
                template_code="hr.profile_update_pending",
                template_name="Detail Update Pending",
                event_type="hr.profile_update_pending",
                title=f"Detail update from {emp_name}",
                body=f"{emp_name} requested a personal detail update. {detail}",
                kind="profile_update",
                extra={
                    "href": "/hr/ess-inbox",
                    "profile_update_request_id": str(row.id),
                    "employee_id": str(employee_id),
                },
                exclude_user_ids=exclude,
            )
        except Exception:
            pass
        return row

    def approve(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        decision_notes: str | None = None,
    ):
        row = self.get(ctx, row_id)
        if row.status != "submitted":
            raise AppException("Only submitted requests can be approved")
        updated = self._repo.update(
            ctx,
            row_id,
            status="approved",
            approved_by=ctx.user_id,
            decided_at=datetime.now(timezone.utc),
            decision_notes=(decision_notes or "").strip() or None,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_profile_update_request",
            entity_id=row_id,
            operation="approve",
            performed_by=ctx.user_id,
        )
        try:
            from modules.hr.service.hr_notify import notify_employee

            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.profile_update_approved",
                template_name="Detail Update Approved",
                event_type="hr.profile_update_approved",
                title="Detail update approved",
                body=(
                    "HR approved your personal detail update request. "
                    "Updated details will appear on your profile."
                ),
                kind="profile_update",
                cc_reporting_manager=False,
                extra={
                    "profile_update_request_id": str(row.id),
                    "href": "/profile/personal",
                },
            )
        except Exception:
            pass
        return updated

    def reject(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        decision_notes: str | None = None,
    ):
        row = self.get(ctx, row_id)
        if row.status != "submitted":
            raise AppException("Only submitted requests can be rejected")
        updated = self._repo.update(
            ctx,
            row_id,
            status="rejected",
            approved_by=ctx.user_id,
            decided_at=datetime.now(timezone.utc),
            decision_notes=(decision_notes or "").strip() or None,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_profile_update_request",
            entity_id=row_id,
            operation="reject",
            performed_by=ctx.user_id,
        )
        try:
            from modules.hr.service.hr_notify import notify_employee

            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.profile_update_rejected",
                template_name="Detail Update Rejected",
                event_type="hr.profile_update_rejected",
                title="Detail update rejected",
                body="HR rejected your personal detail update request.",
                kind="profile_update",
                cc_reporting_manager=False,
                extra={
                    "profile_update_request_id": str(row.id),
                    "href": "/profile/personal",
                },
            )
        except Exception:
            pass
        return updated
