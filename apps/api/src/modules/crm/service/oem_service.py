"""CRM OEM partner master service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.crm.domain.enums import CrmEntityType
from modules.crm.models.oem import CrmOem
from modules.crm.repository.oem_repository import OemRepository
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.document_number_service import DocumentNumberService
from modules.foundation.domain.value_objects import TenantContext


class OemService:
    def __init__(self, db: Session) -> None:
        self._repo = OemRepository(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_oems(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("OEM not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        name = (fields.get("oem_name") or "").strip()
        if not name:
            raise AppException("OEM name is required")
        fields["oem_name"] = name
        existing = self._repo.find_by_name(ctx, cid, name)
        if existing is not None:
            # Idempotent create from the lead-form "New OEM" dialog: reuse master row.
            updates = {}
            for key in ("contact_person", "contact_number", "contact_email"):
                if key not in fields:
                    continue
                value = fields[key]
                if isinstance(value, str):
                    value = value.strip() or None
                if value and not getattr(existing, key, None):
                    updates[key] = value
            if updates:
                return self._repo.update(ctx, existing.id, **updates) or existing
            return existing
        if not fields.get("oem_code"):
            fields["oem_code"] = self._numbers.generate(CrmEntityType.OEM, cid, CrmOem, "oem_code")
        fields.setdefault("status", "active")
        for key in ("contact_person", "contact_number", "contact_email"):
            if key in fields and isinstance(fields[key], str):
                fields[key] = fields[key].strip() or None
        return self._repo.create(ctx, company_id=cid, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        if "oem_name" in fields and fields["oem_name"] is not None:
            fields["oem_name"] = str(fields["oem_name"]).strip()
            if not fields["oem_name"]:
                raise AppException("OEM name is required")
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("OEM not found")
        return row
