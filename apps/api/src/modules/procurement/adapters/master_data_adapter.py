"""Master Data port for resolving vendor / product / UOM during SCM PO create."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.models.product import MasterProduct
from modules.master_data.service.product_service import ProductService
from modules.master_data.service.uom_service import UomService
from modules.master_data.service.vendor_service import VendorService


class ProcurementMasterDataAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._products = ProductService(db)
        self._uoms = UomService(db)
        self._vendors = VendorService(db)

    def get_vendor(self, ctx: TenantContext, vendor_id: UUID):
        return self._vendors.get_vendor(ctx, vendor_id)

    def resolve_default_uom_id(self, ctx: TenantContext, company_id: UUID) -> UUID:
        uoms = self._uoms.list_uoms(ctx, company_id=company_id)
        if not uoms:
            raise NotFoundException(
                "No UOM found — create a base UOM in Master Data before creating SCM POs"
            )
        for uom in uoms:
            code = (getattr(uom, "uom_code", None) or "").upper()
            if code in {"EA", "EACH", "NOS", "UNIT"}:
                return uom.id
        return uoms[0].id

    def resolve_product_for_line(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        product_name: str,
        uom_id: UUID,
    ):
        name = (product_name or "").strip() or "SCM line item"
        stmt = select(MasterProduct).where(
            MasterProduct.tenant_id == ctx.tenant_id,
            MasterProduct.company_id == company_id,
            MasterProduct.is_deleted.is_(False),
            func.lower(MasterProduct.product_name) == name.lower(),
        )
        existing = self._db.scalar(stmt)
        if existing is not None:
            return existing

        # Soft match: reuse first product if catalog is tiny (demo seed)
        products = self._products.list_products(ctx, company_id=company_id)
        for product in products:
            if (product.product_name or "").strip().lower() == name.lower():
                return product

        return self._products.create_product(
            ctx,
            company_id=company_id,
            product_name=name[:255],
            product_type="goods",
            uom_id=uom_id,
            branch_id=branch_id,
            is_inventory_tracked=False,
        )
