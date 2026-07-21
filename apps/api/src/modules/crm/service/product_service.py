"""CRM Product catalog application service (lightweight — quote/OVF line lookups)."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.crm.domain.enums import CrmEntityType
from modules.crm.models import CrmProduct
from modules.crm.repository.product_repository import ProductRepository
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.document_number_service import DocumentNumberService
from modules.foundation.domain.value_objects import TenantContext


class ProductService:
    def __init__(self, db: Session) -> None:
        self._repo = ProductRepository(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_products(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Product not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        if not fields.get("product_code"):
            fields["product_code"] = self._numbers.generate(CrmEntityType.PRODUCT, cid, CrmProduct, "product_code")
        fields.setdefault("status", "active")
        return self._repo.create(ctx, company_id=cid, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Product not found")
        return row
