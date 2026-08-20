"""Master Data port for resolving vendor / product / UOM during SCM PO create."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.domain.exceptions import DuplicateMasterCodeError
from modules.master_data.models.product import MasterProduct
from modules.master_data.service.product_service import ProductService
from modules.master_data.service.uom_service import UomService
from modules.master_data.service.vendor_service import VendorService

# Stable master product used for SCM OVF lines that are not in the product catalog.
_SCM_PLACEHOLDER_CODE = "SCM-PURCHASED"
_SCM_PLACEHOLDER_NAME = "SCM Purchased Item"


def scm_line_product_code(product) -> str | None:
    """Return catalog code for PO lines; hide the SCM placeholder stub code."""
    code = (getattr(product, "product_code", None) or "").strip()
    if not code or code.upper() == _SCM_PLACEHOLDER_CODE:
        return None
    return code


class ProcurementMasterDataAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._products = ProductService(db)
        self._uoms = UomService(db)
        self._vendors = VendorService(db)

    def get_vendor(self, ctx: TenantContext, vendor_id: UUID):
        return self._vendors.get_vendor(ctx, vendor_id)

    def list_vendors(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_scoped: bool = True,
    ):
        return self._vendors.list_vendors(
            ctx, company_id=company_id, branch_scoped=branch_scoped
        )

    @staticmethod
    def score_vendor_label_for_oem(label: str, oem: str) -> int:
        """Rank OEM→vendor name match. Higher is better (exact > first-word > token/prefix)."""
        key = label.strip().lower()
        if not key or not oem:
            return 0
        if key == oem:
            return 4
        words = key.split()
        first = words[0] if words else ""
        if first == oem:
            return 3
        oem_tokens = {t for t in oem.split() if t}
        if first and first in oem_tokens:
            return 2
        if key.startswith(f"{oem} ") or key.startswith(oem):
            return 1
        if any(t == first or key.startswith(f"{t} ") or key.startswith(t) for t in oem_tokens):
            return 1
        return 0

    def match_vendor_name_by_oem(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        oem_name: str | None,
        vendors: list | None = None,
    ) -> str | None:
        """Match OEM to vendor when OEM equals / starts vendor name (e.g. pacific → Pacific Parts)."""
        oem = (oem_name or "").strip().lower()
        if not oem:
            return None
        # Branch-unscoped: queue must suggest vendors even when user/OVF branch differs.
        pool = vendors
        if pool is None:
            pool = self.list_vendors(ctx, company_id=company_id, branch_scoped=False)
            if not pool:
                pool = self.list_vendors(ctx, company_id=None, branch_scoped=False)
        best: tuple[int, str] | None = None
        for vendor in pool:
            label = (
                getattr(vendor, "vendor_name", None)
                or getattr(vendor, "name", None)
                or getattr(vendor, "display_name", None)
                or ""
            ).strip()
            score = self.score_vendor_label_for_oem(label, oem)
            if score <= 0:
                continue
            if best is None or score > best[0] or (score == best[0] and len(label) < len(best[1])):
                best = (score, label)
        return best[1] if best else None

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

    def _find_scm_placeholder(
        self, ctx: TenantContext, company_id: UUID
    ) -> MasterProduct | None:
        stmt = select(MasterProduct).where(
            MasterProduct.tenant_id == ctx.tenant_id,
            MasterProduct.company_id == company_id,
            MasterProduct.is_deleted.is_(False),
            (
                (MasterProduct.product_code == _SCM_PLACEHOLDER_CODE)
                | (func.lower(MasterProduct.product_name) == _SCM_PLACEHOLDER_NAME.lower())
            ),
        )
        return self._db.scalars(stmt).first()

    def _get_or_create_scm_placeholder(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        uom_id: UUID,
    ) -> MasterProduct:
        existing = self._find_scm_placeholder(ctx, company_id)
        if existing is not None:
            return existing
        try:
            with self._db.begin_nested():
                return self._products.create_product(
                    ctx,
                    company_id=company_id,
                    product_code=_SCM_PLACEHOLDER_CODE,
                    product_name=_SCM_PLACEHOLDER_NAME,
                    product_type="goods",
                    uom_id=uom_id,
                    branch_id=branch_id,
                    is_inventory_tracked=False,
                )
        except (IntegrityError, DuplicateMasterCodeError):
            # Concurrent create or stale code sequence — reuse whatever won.
            recovered = self._find_scm_placeholder(ctx, company_id)
            if recovered is not None:
                return recovered
            raise

    def resolve_products_by_names(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        product_names: list[str],
        uom_id: UUID,
    ) -> dict[str, MasterProduct]:
        """Resolve many product names with one lookup query (create only when missing)."""
        normalized: list[tuple[str, str]] = []
        for raw_name in product_names:
            name = (raw_name or "").strip() or "SCM line item"
            normalized.append((name.lower(), name))

        unique_keys = list({key for key, _ in normalized})
        by_name: dict[str, MasterProduct] = {}
        if unique_keys:
            stmt = select(MasterProduct).where(
                MasterProduct.tenant_id == ctx.tenant_id,
                MasterProduct.company_id == company_id,
                MasterProduct.is_deleted.is_(False),
                func.lower(MasterProduct.product_name).in_(unique_keys),
            )
            for product in self._db.scalars(stmt).all():
                key = (product.product_name or "").strip().lower()
                if key and key not in by_name:
                    by_name[key] = product

        resolved: dict[str, MasterProduct] = {}
        placeholder: MasterProduct | None = None
        for key, _display_name in normalized:
            if key in resolved:
                continue
            existing = by_name.get(key)
            if existing is not None:
                resolved[key] = existing
                continue
            # Avoid N× create_product — reuse one generic SCM product; line keeps the real name.
            if placeholder is None:
                placeholder = self._get_or_create_scm_placeholder(
                    ctx,
                    company_id=company_id,
                    branch_id=branch_id,
                    uom_id=uom_id,
                )
            resolved[key] = placeholder
        return resolved

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
        mapped = self.resolve_products_by_names(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            product_names=[name],
            uom_id=uom_id,
        )
        return mapped[name.lower()]
