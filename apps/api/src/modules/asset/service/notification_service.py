"""AssetNotificationService — asset alert metadata registry (FP-ASSET-017).

Metadata only. Foundation Notification owns delivery channels.
"""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import (
    AssetNotificationDeliveryStatus,
    AssetNotificationStatus,
)
from modules.asset.models import AstAssetNotification
from modules.asset.repository.asset_notification_repository import (
    AssetNotificationListFilters,
    AssetNotificationRepository,
)
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.engines import AssetNotificationEngine
from modules.asset.service.notification_validator import NotificationValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

ENTITY_AST_NOTIFICATION = "ast_asset_notification"


class AssetNotificationService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetNotificationRepository(db)
        self._scope = AssetScopeValidator(db)
        self._engine = AssetNotificationEngine()
        self._audit = AuditService(db)
        self._validator = NotificationValidator(db)

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        asset_id: UUID | None = None,
        notification_type: str | None = None,
        delivery_status: str | None = None,
        status: str | None = None,
        recipient_user_id: UUID | None = None,
        branch_id: UUID | None = None,
        search: str | None = None,
        sort: str = "created_at",
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstAssetNotification], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        if sort not in {"created_at", "sent_at"}:
            sort = "created_at"
        filters = AssetNotificationListFilters(
            company_id=cid,
            asset_id=asset_id,
            notification_type=notification_type,
            delivery_status=delivery_status,
            status=status,
            recipient_user_id=recipient_user_id,
            branch_id=branch_id,
            search=search,
            sort=sort,
        )
        return self._repo.search(ctx, filters, offset=offset, limit=limit)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetNotification:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Notification not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        branch_id = fields.get("branch_id")
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)

        fields.pop("status", None)
        fields.pop("delivery_status", None)
        fields.pop("sent_at", None)
        self._validator.validate_create_fields(ctx, company_id=cid, fields=fields)

        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=fields.get("branch_id"),
            asset_id=fields["asset_id"],
            notification_type=fields["notification_type"],
            recipient_user_id=fields.get("recipient_user_id"),
            recipient_employee_id=fields.get("recipient_employee_id"),
            payload_json=fields.get("payload_json"),
            delivery_status=AssetNotificationDeliveryStatus.PENDING.value,
            status=AssetNotificationStatus.ACTIVE.value,
            sent_at=None,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_NOTIFICATION,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={
                "asset_id": str(row.asset_id),
                "notification_type": row.notification_type,
                "delivery_status": row.delivery_status,
            },
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        branch_id = fields.get("branch_id")
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)
        self._validator.validate_update_fields(ctx, row, fields)
        allowed = {
            k: v
            for k, v in fields.items()
            if k
            in {
                "branch_id",
                "recipient_user_id",
                "recipient_employee_id",
                "payload_json",
                "version",
            }
        }
        self._engine.apply_metadata(row, {k: v for k, v in allowed.items() if k != "version"})
        updated = self._repo.update(ctx, row_id, **allowed)
        if updated is None:
            raise NotFoundException("Notification not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_NOTIFICATION,
            entity_id=row_id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return updated

    def archive(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_archive_readiness(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Notification not found")
        self._engine.archive(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_NOTIFICATION,
            entity_id=row_id,
            operation="archive",
            performed_by=ctx.user_id,
        )
        return updated

    def mark_sent(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_mark_sent_readiness(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Notification not found")
        self._engine.mark_sent(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            delivery_status=claimed.delivery_status,
            sent_at=claimed.sent_at,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_NOTIFICATION,
            entity_id=row_id,
            operation="mark_sent",
            performed_by=ctx.user_id,
        )
        return updated

    def mark_failed(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_mark_failed_readiness(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Notification not found")
        self._engine.mark_failed(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            delivery_status=claimed.delivery_status,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_NOTIFICATION,
            entity_id=row_id,
            operation="mark_failed",
            performed_by=ctx.user_id,
        )
        return updated

    def mark_read(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_mark_read_readiness(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Notification not found")
        self._engine.mark_read(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            delivery_status=claimed.delivery_status,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_NOTIFICATION,
            entity_id=row_id,
            operation="mark_read",
            performed_by=ctx.user_id,
        )
        return updated


# Backward-compatible alias for ApplicationService / older imports.
NotificationService = AssetNotificationService
