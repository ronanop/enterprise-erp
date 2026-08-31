"""DepreciationService — period depreciation governance (FP-ASSET-006)."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.finance_port import AssetFinanceAdapter
from modules.asset.domain.enums import AssetDepreciationStatus, AssetStatus, AstEntityType
from modules.asset.domain.exceptions import DepreciationValidationError
from modules.asset.domain.workflow_codes import ENTITY_AST_DEPRECIATION
from modules.asset.models import AstAsset, AstAssetDepreciation
from modules.asset.repository.asset_depreciation_repository import (
    AssetDepreciationListFilters,
    AssetDepreciationRepository,
)
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.depreciation_validator import DepreciationValidator
from modules.asset.service.document_number_service import DocumentNumberService
from modules.asset.service.engines import AssetDepreciationEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


def period_idempotency_key(asset_id: UUID, period_year: int, period_month: int) -> str:
    return f"{asset_id}:{period_year}:{period_month:02d}"


class DepreciationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = AssetDepreciationRepository(db)
        self._assets = AssetRepository(db)
        self._scope = AssetScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = AssetDepreciationEngine()
        self._finance = AssetFinanceAdapter(db)
        self._audit = AuditService(db)
        self._validator = DepreciationValidator(db)

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        asset_id: UUID | None = None,
        status: str | None = None,
        method: str | None = None,
        period_year: int | None = None,
        period_month: int | None = None,
        depreciation_batch_id: UUID | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstAssetDepreciation], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        filters = AssetDepreciationListFilters(
            company_id=cid,
            asset_id=asset_id,
            status=status,
            method=method,
            period_year=period_year,
            period_month=period_month,
            depreciation_batch_id=depreciation_batch_id,
            search=search,
        )
        return self._repo.search(ctx, filters, offset=offset, limit=limit)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetDepreciation:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Asset depreciation not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._validator.validate_create_fields(ctx, company_id=cid, fields=fields)
        asset = self._assets.get(ctx, fields["asset_id"])
        if asset is None:
            raise NotFoundException("Asset not found")

        method = fields.get("method") or asset.depreciation_method
        if method is None:
            raise DepreciationValidationError("method is required")
        fields["method"] = method

        period_year = int(fields["period_year"])
        period_month = int(fields["period_month"])
        key = period_idempotency_key(asset.id, period_year, period_month)

        doc = self._numbers.generate(
            AstEntityType.DEPRECIATION,
            cid,
            AstAssetDepreciation,
            "document_number",
            ctx=ctx,
        )
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=asset.branch_id,
            document_number=doc,
            asset_id=asset.id,
            period_year=period_year,
            period_month=period_month,
            method=method,
            units_produced=fields.get("units_produced"),
            depreciation_batch_id=fields.get("depreciation_batch_id"),
            idempotency_key=fields.get("idempotency_key") or key,
            status=AssetDepreciationStatus.DRAFT.value,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_DEPRECIATION,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"document_number": row.document_number, "asset_id": str(asset.id)},
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        self._validator.validate_update_fields(ctx, row, fields)
        updated = self._repo.update(ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Asset depreciation not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_DEPRECIATION,
            entity_id=row_id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return updated

    def calculate(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        estimated_total_units: Decimal | None = None,
        units_produced: Decimal | None = None,
    ):
        row = self.get(ctx, row_id)
        if units_produced is not None:
            row.units_produced = units_produced

        self._validator.validate_calculate_readiness(
            ctx, row, estimated_total_units=estimated_total_units
        )
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")

        result = self._engine.calculate(
            row, asset=asset, estimated_total_units=estimated_total_units
        )
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            depreciation_amount=result.amount,
            book_value_after=result.book_value_after,
            units_produced=row.units_produced,
            version=int(row.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_DEPRECIATION,
            entity_id=row_id,
            operation="calculate",
            performed_by=ctx.user_id,
            new_value={
                "depreciation_amount": str(result.amount),
                "book_value_after": str(result.book_value_after),
            },
        )
        return updated

    def post(
        self,
        ctx: TenantContext,
        row_id: UUID,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ):
        row = self.get(ctx, row_id)
        self._validator.validate_post_readiness(ctx, row)

        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Asset depreciation not found")

        try:
            journal_id = self._finance.post_depreciation(
                ctx,
                claimed,
                amount=Decimal(str(claimed.depreciation_amount or 0)),
                debit_account_id=debit_account_id,
                credit_account_id=credit_account_id,
                fiscal_year_id=fiscal_year_id,
            )
            self._engine.post(claimed)
            updated = self._repo.update(
                ctx,
                row_id,
                status=claimed.status,
                finance_journal_id=journal_id,
                version=int(claimed.version or 1),
            )
            asset = self._assets.get(ctx, claimed.asset_id)
            if asset is not None and claimed.book_value_after is not None:
                self._assets.update(
                    ctx, asset.id, current_book_value=claimed.book_value_after
                )

            self._audit.log_entity_change(
                tenant_id=ctx.tenant_id,
                entity_name=ENTITY_AST_DEPRECIATION,
                entity_id=row_id,
                operation="post",
                performed_by=ctx.user_id,
                new_value={
                    "finance_journal_id": str(journal_id),
                    "current_book_value": str(claimed.book_value_after)
                    if claimed.book_value_after is not None
                    else None,
                },
            )
            return updated
        except Exception:
            self._engine.fail(claimed)
            self._repo.update(
                ctx,
                row_id,
                status=claimed.status,
                version=int(claimed.version or 1),
            )
            raise

    def reverse(
        self,
        ctx: TenantContext,
        row_id: UUID,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ):
        """Reverse a posted depreciation.

        Operators supply the same account orientation used at post
        (debit = depreciation expense, credit = accumulated depreciation).
        This method swaps accounts when calling Finance so the journal is a
        true reversing entry, without changing the Finance adapter.
        Optimistic version claim runs before Finance to prevent duplicate journals.
        """
        row = self.get(ctx, row_id)
        self._validator.validate_reverse_readiness(ctx, row)

        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Asset depreciation not found")

        # Swap original post orientation → reversing Dr Accum / Cr Expense.
        reversing_debit = credit_account_id
        reversing_credit = debit_account_id

        journal_id = self._finance.post_depreciation(
            ctx,
            claimed,
            amount=Decimal(str(claimed.depreciation_amount or 0)),
            debit_account_id=reversing_debit,
            credit_account_id=reversing_credit,
            fiscal_year_id=fiscal_year_id,
        )
        self._engine.reverse(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )

        asset = self._assets.get(ctx, claimed.asset_id)
        if asset is not None and claimed.depreciation_amount is not None:
            book = Decimal(
                str(
                    asset.current_book_value
                    if asset.current_book_value is not None
                    else 0
                )
            )
            restored = book + Decimal(str(claimed.depreciation_amount))
            self._assets.update(ctx, asset.id, current_book_value=restored)

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_DEPRECIATION,
            entity_id=row_id,
            operation="reverse",
            performed_by=ctx.user_id,
            new_value={
                "reversing_journal_id": str(journal_id),
                "accounts_swapped": True,
            },
        )
        return updated

    def generate_period_run(
        self,
        ctx: TenantContext,
        *,
        period_year: int,
        period_month: int,
        company_id: UUID | None = None,
    ) -> dict:
        if not (1 <= int(period_month) <= 12):
            raise DepreciationValidationError("period_month must be between 1 and 12")
        cid = self._scope.resolve_company_id(ctx, company_id)
        batch_id = uuid4()
        created: list[AstAssetDepreciation] = []
        skipped = 0

        assets = self._list_depreciable_assets(ctx, cid)
        for asset in assets:
            method = asset.depreciation_method or "straight_line"
            existing = self._repo.find_for_asset_period(
                ctx,
                asset.id,
                period_year,
                period_month,
                exclude_reversed=True,
            )
            if existing is not None:
                skipped += 1
                continue
            try:
                self._validator.validate_create_fields(
                    ctx,
                    company_id=cid,
                    fields={
                        "asset_id": asset.id,
                        "period_year": period_year,
                        "period_month": period_month,
                        "method": method,
                    },
                )
            except (DepreciationValidationError, NotFoundException):
                skipped += 1
                continue

            row = self.create(
                ctx,
                company_id=cid,
                asset_id=asset.id,
                period_year=period_year,
                period_month=period_month,
                method=method,
                depreciation_batch_id=batch_id,
                idempotency_key=period_idempotency_key(asset.id, period_year, period_month),
            )
            created.append(row)

        # entity_id is the batch correlation UUID (depreciation_batch_id), not a row PK.
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_DEPRECIATION,
            entity_id=batch_id,
            operation="generate_run",
            performed_by=ctx.user_id,
            new_value={
                "depreciation_batch_id": str(batch_id),
                "period_year": period_year,
                "period_month": period_month,
                "created": len(created),
                "skipped": skipped,
            },
        )
        return {
            "depreciation_batch_id": batch_id,
            "period_year": period_year,
            "period_month": period_month,
            "created_count": len(created),
            "skipped_count": skipped,
            "items": created,
        }

    def _list_depreciable_assets(self, ctx: TenantContext, company_id: UUID) -> list[AstAsset]:
        stmt = select(AstAsset).where(
            AstAsset.company_id == company_id,
            AstAsset.is_deleted.is_(False),
            AstAsset.status.in_(
                [AssetStatus.ACTIVE.value, AssetStatus.IN_MAINTENANCE.value]
            ),
            AstAsset.purchase_cost.is_not(None),
            AstAsset.useful_life_months.is_not(None),
        )
        stmt = self._assets.apply_ast_filter(stmt, AstAsset, ctx, branch_scoped=True)
        return list(self._db.scalars(stmt).all())
