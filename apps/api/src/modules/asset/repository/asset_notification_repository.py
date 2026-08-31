"""Asset notification repository (FP-ASSET-017).

Search joins ``ast_asset`` only when ``q`` is supplied.
"""

from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.asset.models import AstAsset, AstAssetNotification
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext

SORT_COLUMNS = {
    "created_at": AstAssetNotification.created_at,
    "sent_at": AstAssetNotification.sent_at,
}


@dataclass(frozen=True)
class AssetNotificationListFilters:
    company_id: UUID
    asset_id: UUID | None = None
    notification_type: str | None = None
    delivery_status: str | None = None
    status: str | None = None
    recipient_user_id: UUID | None = None
    branch_id: UUID | None = None
    search: str | None = None
    sort: str = "created_at"


class AssetNotificationRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetNotification | None:
        stmt = select(AstAssetNotification).where(
            AstAssetNotification.id == row_id,
            AstAssetNotification.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetNotification, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        items, _ = self.search(
            ctx,
            AssetNotificationListFilters(company_id=company_id),
            offset=0,
            limit=10_000,
        )
        return items

    def search(
        self,
        ctx: TenantContext,
        filters: AssetNotificationListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAssetNotification], int]:
        stmt = select(AstAssetNotification).where(
            AstAssetNotification.company_id == filters.company_id,
            AstAssetNotification.is_deleted.is_(False),
        )
        if filters.asset_id is not None:
            stmt = stmt.where(AstAssetNotification.asset_id == filters.asset_id)
        if filters.notification_type is not None:
            stmt = stmt.where(
                AstAssetNotification.notification_type == filters.notification_type
            )
        if filters.delivery_status is not None:
            stmt = stmt.where(AstAssetNotification.delivery_status == filters.delivery_status)
        if filters.status is not None:
            stmt = stmt.where(AstAssetNotification.status == filters.status)
        if filters.recipient_user_id is not None:
            stmt = stmt.where(
                AstAssetNotification.recipient_user_id == filters.recipient_user_id
            )
        if filters.branch_id is not None:
            stmt = stmt.where(AstAssetNotification.branch_id == filters.branch_id)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.outerjoin(AstAsset, AstAsset.id == AstAssetNotification.asset_id).where(
                or_(
                    AstAssetNotification.notification_type.ilike(term),
                    AstAssetNotification.delivery_status.ilike(term),
                    AstAsset.asset_code.ilike(term),
                    AstAsset.asset_name.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetNotification, ctx, branch_scoped=False)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        sort_col = SORT_COLUMNS.get(filters.sort, AstAssetNotification.created_at)
        rows = list(
            self.db.scalars(stmt.order_by(sort_col.desc()).offset(offset).limit(limit)).all()
        )
        return rows, total

    def create(self, ctx: TenantContext, **fields) -> AstAssetNotification:
        row = AstAssetNotification(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetNotification | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise ConflictException(
                "Asset notification has been modified by another user; reload and retry"
            )
        for key, value in fields.items():
            if value is not None or key in {
                "branch_id",
                "recipient_user_id",
                "recipient_employee_id",
                "payload_json",
                "sent_at",
            }:
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
