"""Vendor service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.master_data.domain.enums import MasterEntityType
from modules.master_data.models.party import MasterVendor
from modules.master_data.repository.vendor_repository import VendorRepository
from modules.master_data.service.code_generator_service import CodeGeneratorService
from modules.master_data.service.duplicate_checker_service import DuplicateCheckerService
from modules.master_data.service.master_scope_validator import MasterScopeValidator


class VendorService:
    def __init__(self, db: Session) -> None:
        self._repo = VendorRepository(db)
        self._audit = AuditService(db)
        self._codes = CodeGeneratorService(db)
        self._duplicates = DuplicateCheckerService(db)
        self._scope = MasterScopeValidator(db)

    def list_vendors(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
        branch_scoped: bool = True,
    ):
        if company_id:
            self._scope.validate_company_access(ctx, company_id)
        if branch_id:
            self._scope.validate_branch_access(ctx, branch_id)
        return self._repo.list_vendors(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            branch_scoped=branch_scoped,
        )

    def get_vendor(self, ctx: TenantContext, vendor_id: UUID):
        vendor = self._repo.get_by_id(ctx, vendor_id)
        if vendor is None:
            raise NotFoundException("Vendor not found")
        self._scope.validate_company_access(ctx, vendor.company_id)
        self._scope.validate_branch_access(ctx, vendor.branch_id)
        return vendor

    def create_vendor(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID,
        vendor_code: str | None = None,
        vendor_name: str,
        vendor_type: str,
        tax_number: str | None = None,
        email: str | None = None,
        mobile: str | None = None,
        payment_terms: str | None = None,
        address_json: dict | None = None,
    ):
        resolved_company_id = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)

        if vendor_code is None:
            vendor_code = self._codes.generate(
                MasterEntityType.VENDOR,
                resolved_company_id,
                model=MasterVendor,
                code_column="vendor_code",
            )
        else:
            self._duplicates.ensure_unique_code(
                model=MasterVendor,
                company_id=resolved_company_id,
                code=vendor_code,
                code_field="vendor_code",
                label="Vendor",
            )

        vendor = self._repo.create(
            ctx,
            company_id=resolved_company_id,
            branch_id=branch_id,
            vendor_code=vendor_code,
            vendor_name=vendor_name,
            vendor_type=vendor_type,
            tax_number=tax_number,
            email=email,
            mobile=mobile,
            payment_terms=payment_terms,
            address_json=address_json,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="master_vendor",
            entity_id=vendor.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"vendor_code": vendor_code, "branch_id": str(branch_id)},
        )
        return vendor

    def update_vendor(self, ctx: TenantContext, vendor_id: UUID, **fields):
        self.get_vendor(ctx, vendor_id)
        if "branch_id" in fields and fields["branch_id"] is not None:
            self._scope.validate_branch_access(ctx, fields["branch_id"])

        updated = self._repo.update(ctx, vendor_id, **fields)
        if updated is None:
            raise NotFoundException("Vendor not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="master_vendor",
            entity_id=vendor_id,
            operation="update",
            performed_by=ctx.user_id,
            new_value=fields,
        )
        return updated

    def delete_vendor(self, ctx: TenantContext, vendor_id: UUID) -> None:
        self.get_vendor(ctx, vendor_id)
        if not self._repo.soft_delete(ctx, vendor_id):
            raise NotFoundException("Vendor not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="master_vendor",
            entity_id=vendor_id,
            operation="delete",
            performed_by=ctx.user_id,
        )
