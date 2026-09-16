"""Pricing repository - price lists, items, discount rules."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from modules.foundation.domain.value_objects import TenantContext
from modules.sales.models.pricing import SalesDiscountRule, SalesPriceList, SalesPriceListItem
from modules.sales.repository.base import SalesScopedRepository, utcnow


class PricingRepository(SalesScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_price_lists(self, ctx: TenantContext, company_id: UUID) -> list[SalesPriceList]:
        stmt = select(SalesPriceList).where(SalesPriceList.company_id == company_id)
        stmt = self.apply_sales_filter(stmt, SalesPriceList, ctx)
        return list(self.db.scalars(stmt.order_by(SalesPriceList.priority.asc())).all())

    def get_price_list(self, ctx: TenantContext, price_list_id: UUID) -> SalesPriceList | None:
        stmt = (
            select(SalesPriceList)
            .options(selectinload(SalesPriceList.items))
            .where(
                SalesPriceList.id == price_list_id,
                SalesPriceList.tenant_id == ctx.tenant_id,
                SalesPriceList.is_deleted.is_(False),
            )
        )
        return self.db.scalar(stmt)

    def create_price_list(
        self, ctx: TenantContext, *, company_id: UUID, **fields: object
    ) -> SalesPriceList:
        row = SalesPriceList(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update_price_list(
        self, ctx: TenantContext, price_list_id: UUID, **fields: object
    ) -> SalesPriceList | None:
        row = self.get_price_list(ctx, price_list_id)
        if row is None:
            return None
        for key, value in fields.items():
            if hasattr(row, key):
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version += 1
        self.db.flush()
        return row

    def soft_delete_price_list(self, ctx: TenantContext, price_list_id: UUID) -> bool:
        row = self.get_price_list(ctx, price_list_id)
        if row is None:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        self.db.flush()
        return True

    def add_price_list_item(
        self, ctx: TenantContext, price_list: SalesPriceList, **fields: object
    ) -> SalesPriceListItem:
        row = SalesPriceListItem(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=price_list.company_id,
            price_list_id=price_list.id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def get_price_list_item(
        self, ctx: TenantContext, item_id: UUID
    ) -> SalesPriceListItem | None:
        stmt = select(SalesPriceListItem).where(
            SalesPriceListItem.id == item_id,
            SalesPriceListItem.tenant_id == ctx.tenant_id,
            SalesPriceListItem.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def update_price_list_item(
        self, ctx: TenantContext, item_id: UUID, **fields: object
    ) -> SalesPriceListItem | None:
        row = self.get_price_list_item(ctx, item_id)
        if row is None:
            return None
        for key, value in fields.items():
            if hasattr(row, key):
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version += 1
        self.db.flush()
        return row

    def soft_delete_price_list_item(self, ctx: TenantContext, item_id: UUID) -> bool:
        row = self.get_price_list_item(ctx, item_id)
        if row is None:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        self.db.flush()
        return True

    def find_active_price_lists(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        customer_id: UUID | None,
        as_of: date,
    ) -> list[SalesPriceList]:
        stmt = (
            select(SalesPriceList)
            .options(selectinload(SalesPriceList.items))
            .where(
                SalesPriceList.company_id == company_id,
                SalesPriceList.status == "active",
                SalesPriceList.effective_from <= as_of,
                or_(
                    SalesPriceList.effective_to.is_(None),
                    SalesPriceList.effective_to >= as_of,
                ),
                or_(
                    SalesPriceList.customer_id.is_(None),
                    SalesPriceList.customer_id == customer_id,
                ),
            )
        )
        stmt = self.apply_sales_filter(stmt, SalesPriceList, ctx)
        return list(self.db.scalars(stmt.order_by(SalesPriceList.priority.asc())).all())

    def list_discount_rules(
        self, ctx: TenantContext, company_id: UUID
    ) -> list[SalesDiscountRule]:
        stmt = select(SalesDiscountRule).where(SalesDiscountRule.company_id == company_id)
        stmt = self.apply_sales_filter(stmt, SalesDiscountRule, ctx)
        return list(self.db.scalars(stmt).all())

    def get_discount_rule(
        self, ctx: TenantContext, rule_id: UUID
    ) -> SalesDiscountRule | None:
        stmt = select(SalesDiscountRule).where(
            SalesDiscountRule.id == rule_id,
            SalesDiscountRule.tenant_id == ctx.tenant_id,
            SalesDiscountRule.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def create_discount_rule(
        self, ctx: TenantContext, *, company_id: UUID, **fields: object
    ) -> SalesDiscountRule:
        row = SalesDiscountRule(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update_discount_rule(
        self, ctx: TenantContext, rule_id: UUID, **fields: object
    ) -> SalesDiscountRule | None:
        row = self.get_discount_rule(ctx, rule_id)
        if row is None:
            return None
        for key, value in fields.items():
            if hasattr(row, key):
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version += 1
        self.db.flush()
        return row

    def soft_delete_discount_rule(self, ctx: TenantContext, rule_id: UUID) -> bool:
        row = self.get_discount_rule(ctx, rule_id)
        if row is None:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        self.db.flush()
        return True
