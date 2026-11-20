"""Employee profile application service."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.kyc_validators import normalize_kyc_fields
from modules.hr.repository.employee_profile_repository import EmployeeProfileRepository
from modules.hr.schemas import EmployeeProfileResponse
from modules.hr.service.engines import EmployeeProfileEngine
from modules.hr.service.hr_scope_validator import HrScopeValidator
from modules.master_data.published import EmployeeRead


class EmployeeProfileService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = EmployeeProfileRepository(db)
        self._scope = HrScopeValidator(db)
        self._engine = EmployeeProfileEngine()
        self._master = HrMasterDataAdapter(db)
        self._audit = PlatformAuditFacade(db)

    def _enrich(self, row) -> EmployeeProfileResponse:
        emp = self._db.scalar(
            select(EmployeeRead).where(
                EmployeeRead.id == row.employee_id,
                EmployeeRead.is_deleted.is_(False),
            )
        )
        payload = EmployeeProfileResponse.model_validate(row)
        payload.has_profile_photo = bool(getattr(row, "profile_photo_uri", None))
        if emp is not None:
            payload.employee_code = emp.employee_code
            payload.first_name = emp.first_name
            payload.last_name = emp.last_name
            payload.employee_name = f"{emp.first_name} {emp.last_name}".strip()
            payload.email = emp.email
            payload.designation = emp.designation
        return payload

    def _apply_profile_photo(
        self,
        *,
        company_id: UUID,
        employee_id: UUID,
        fields: dict,
    ) -> dict:
        photo = fields.pop("profile_photo_data_url", None)
        if not photo or not str(photo).strip():
            return fields
        from modules.hr.service.profile_photo_storage import save_profile_photo_data_url

        fields["profile_photo_uri"] = save_profile_photo_data_url(
            company_id=company_id,
            employee_id=employee_id,
            data_url=str(photo),
        )
        return fields

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return [self._enrich(row) for row in self._repo.list_rows(ctx, cid)]

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Employee profile not found")
        return self._enrich(row)

    def get_by_employee_id(self, ctx: TenantContext, employee_id: UUID):
        row = self._repo.get_by_employee_id(ctx, employee_id)
        if row is None:
            raise NotFoundException("Employee profile not found")
        return self._enrich(row)

    def get_orm_by_employee_id(self, ctx: TenantContext, employee_id: UUID):
        row = self._repo.get_by_employee_id(ctx, employee_id)
        if row is None:
            raise NotFoundException("Employee profile not found")
        return row

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        company_id: UUID | None = None,
        **fields,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        fields = normalize_kyc_fields(fields)
        fields = self._apply_profile_photo(
            company_id=cid, employee_id=employee_id, fields=fields
        )
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            **fields,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_employee_profile",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return self._enrich(row)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        orm = self._repo.get(ctx, row_id)
        if orm is None:
            raise NotFoundException("Employee profile not found")
        self._engine.validate_writable(orm)
        fields = normalize_kyc_fields(fields)
        fields = self._apply_profile_photo(
            company_id=orm.company_id,
            employee_id=orm.employee_id,
            fields=fields,
        )
        updated = self._repo.update(ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Employee profile not found")
        return self._enrich(updated)
