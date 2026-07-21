"""Accounting period service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.finance.models.fiscal import FinPeriod
from modules.finance.repository.fiscal_repository import FiscalRepository
from modules.finance.schemas import BulkPeriodActionResult, PeriodResponse
from modules.finance.service.engines.period_closing_engine import PeriodClosingEngine
from modules.finance.service.finance_scope_validator import FinanceScopeValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class PeriodService:
    BULK_ACTIONS = {
        "open",
        "close",
        "lock",
        "unlock",
        "reopen",
        "soft_close",
        "hard_close",
    }

    def __init__(self, db: Session) -> None:
        self._repo = FiscalRepository(db)
        self._scope = FinanceScopeValidator(db)
        self._closing = PeriodClosingEngine(db)
        self._audit = AuditService(db)

    def list_periods(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        fiscal_year_id: UUID | None = None,
        *,
        status: str | None = None,
        search: str | None = None,
        sort_by: str = "period_number",
        sort_dir: str = "asc",
    ) -> list[PeriodResponse]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        periods = self._repo.list_periods(
            ctx,
            company_id=cid,
            fiscal_year_id=fiscal_year_id,
            status=status,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
        return [self._to_response(ctx, p) for p in periods]

    def get_period(self, ctx: TenantContext, period_id: UUID) -> PeriodResponse:
        period = self._repo.get_period(ctx, period_id)
        if period is None:
            raise NotFoundException("Period not found")
        self._scope.validate_company_access(ctx, period.company_id)
        return self._to_response(ctx, period)

    def get_period_entity(self, ctx: TenantContext, period_id: UUID) -> FinPeriod:
        period = self._repo.get_period(ctx, period_id)
        if period is None:
            raise NotFoundException("Period not found")
        self._scope.validate_company_access(ctx, period.company_id)
        return period

    def soft_close(self, ctx: TenantContext, period_id: UUID):
        period = self.get_period_entity(ctx, period_id)
        closed = self._closing.soft_close(ctx, period)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_period",
            entity_id=period_id,
            operation="period_close",
            performed_by=ctx.user_id,
            new_value={"status": "soft_closed"},
        )
        return self._to_response(ctx, closed)

    def hard_close(self, ctx: TenantContext, period_id: UUID):
        period = self.get_period_entity(ctx, period_id)
        closed = self._closing.hard_close(ctx, period)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_period",
            entity_id=period_id,
            operation="period_close",
            performed_by=ctx.user_id,
            new_value={"status": "hard_closed"},
        )
        return self._to_response(ctx, closed)

    def reopen(self, ctx: TenantContext, period_id: UUID):
        period = self.get_period_entity(ctx, period_id)
        reopened = self._closing.reopen(ctx, period)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_period",
            entity_id=period_id,
            operation="reopen",
            performed_by=ctx.user_id,
        )
        return self._to_response(ctx, reopened)

    def lock_period(self, ctx: TenantContext, period_id: UUID):
        period = self.get_period_entity(ctx, period_id)
        if period.status == "hard_closed":
            raise AppException("Period is already hard closed")
        updated = self._repo.update_period(
            ctx,
            period_id,
            gl_closed=True,
            ar_closed=True,
            ap_closed=True,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_period",
            entity_id=period_id,
            operation="lock",
            performed_by=ctx.user_id,
        )
        return self._to_response(ctx, updated)  # type: ignore[arg-type]

    def unlock_period(self, ctx: TenantContext, period_id: UUID):
        period = self.get_period_entity(ctx, period_id)
        if period.status == "hard_closed":
            raise AppException("Hard closed periods must be reopened first")
        updated = self._repo.update_period(
            ctx,
            period_id,
            gl_closed=False,
            ar_closed=False,
            ap_closed=False,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_period",
            entity_id=period_id,
            operation="unlock",
            performed_by=ctx.user_id,
        )
        return self._to_response(ctx, updated)  # type: ignore[arg-type]

    def open_period(self, ctx: TenantContext, period_id: UUID):
        return self.reopen(ctx, period_id)

    def close_period(self, ctx: TenantContext, period_id: UUID):
        return self.soft_close(ctx, period_id)

    def update_close_flags(self, ctx: TenantContext, period_id: UUID, **flags):
        self.get_period_entity(ctx, period_id)
        updated = self._repo.update_period(ctx, period_id, **flags)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_period",
            entity_id=period_id,
            operation="update",
            performed_by=ctx.user_id,
            new_value=flags,
        )
        return self._to_response(ctx, updated)  # type: ignore[arg-type]

    def bulk_action(
        self, ctx: TenantContext, period_ids: list[UUID], action: str, comments: str | None = None
    ) -> BulkPeriodActionResult:
        action_key = action.lower().replace("-", "_")
        if action_key not in self.BULK_ACTIONS:
            raise AppException(f"Unsupported bulk action: {action}")
        succeeded = 0
        errors: list[str] = []
        dispatch = {
            "open": self.open_period,
            "reopen": self.reopen,
            "close": self.close_period,
            "soft_close": self.soft_close,
            "hard_close": self.hard_close,
            "lock": self.lock_period,
            "unlock": self.unlock_period,
        }
        handler = dispatch[action_key]
        for pid in period_ids:
            try:
                handler(ctx, pid)
                succeeded += 1
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{pid}: {exc}")
        if comments:
            self._audit.log_entity_change(
                tenant_id=ctx.tenant_id,
                entity_name="fin_period",
                entity_id=period_ids[0] if period_ids else None,
                operation=f"bulk_{action_key}",
                performed_by=ctx.user_id,
                new_value={"comments": comments, "count": succeeded},
            )
        return BulkPeriodActionResult(
            succeeded=succeeded, failed=len(errors), errors=errors
        )

    def _to_response(self, ctx: TenantContext, period: FinPeriod) -> PeriodResponse:
        fy = self._repo.get_fiscal_year(ctx, period.fiscal_year_id)
        jc = self._repo.count_journals_in_period(ctx, period.id)
        posting = period.status == "open" and not period.gl_closed
        return PeriodResponse(
            id=period.id,
            company_id=period.company_id,
            fiscal_year_id=period.fiscal_year_id,
            period_number=period.period_number,
            period_name=period.period_name,
            start_date=period.start_date,
            end_date=period.end_date,
            status=period.status,
            ar_closed=period.ar_closed,
            ap_closed=period.ap_closed,
            inventory_closed=period.inventory_closed,
            payroll_closed=period.payroll_closed,
            gl_closed=period.gl_closed,
            closed_at=period.closed_at,
            closed_by=period.closed_by,
            created_by=period.created_by,
            created_at=period.created_at,
            updated_by=period.updated_by,
            updated_at=period.updated_at,
            version=period.version,
            fiscal_year_code=fy.fiscal_year_code if fy else None,
            fiscal_year_name=fy.fiscal_year_name if fy else None,
            journal_count=jc,
            journal_posting_allowed=posting,
            quarter=((period.period_number - 1) // 3) + 1,
        )
