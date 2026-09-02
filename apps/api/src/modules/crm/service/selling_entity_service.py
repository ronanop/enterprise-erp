"""CRM selling / billing entity master service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.crm.domain.enums import CrmEntityType
from modules.crm.models.selling_entity import CrmSellingEntity
from modules.crm.repository.selling_entity_repository import SellingEntityRepository
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.document_number_service import DocumentNumberService
from modules.foundation.domain.value_objects import TenantContext


class SellingEntityService:
    def __init__(self, db: Session) -> None:
        self._repo = SellingEntityRepository(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_entities(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Selling entity not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        name = (fields.get("entity_name") or "").strip()
        if not name:
            raise AppException("Entity name is required")
        fields["entity_name"] = name
        if not fields.get("entity_code"):
            fields["entity_code"] = self._numbers.generate(
                CrmEntityType.SELLING_ENTITY, cid, CrmSellingEntity, "entity_code"
            )
        fields.setdefault("status", "active")
        for key in ("entity_email", "entity_contact", "entity_gst", "entity_address"):
            if key in fields and isinstance(fields[key], str):
                fields[key] = fields[key].strip() or None
        return self._repo.create(ctx, company_id=cid, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        if "entity_name" in fields and fields["entity_name"] is not None:
            fields["entity_name"] = str(fields["entity_name"]).strip()
            if not fields["entity_name"]:
                raise AppException("Entity name is required")
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Selling entity not found")
        return row
