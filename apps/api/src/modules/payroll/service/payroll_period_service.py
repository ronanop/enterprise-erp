"""PayrollPeriod application service."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.payroll.domain.enums import PayrollPeriodStatus
from modules.payroll.domain.payroll_period_calendar import (
    default_payment_date,
    iter_payroll_months,
    payroll_period_bounds_day_to_day,
    payroll_period_code,
    payroll_period_display_name,
)
from modules.payroll.models import PayPayrollPeriod
from modules.payroll.repository.payroll_period_repository import PayrollPeriodRepository
from modules.payroll.service.engines import PayrollPeriodEngine
from modules.payroll.service.payroll_policy_service import PayrollPolicyService
from modules.payroll.service.payroll_scope_validator import PayrollScopeValidator


class PayrollPeriodService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = PayrollPeriodRepository(db)
        self._scope = PayrollScopeValidator(db)
        self._engine = PayrollPeriodEngine()
        self._policy = PayrollPolicyService(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> PayPayrollPeriod:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("PayrollPeriod not found")
        return row

    def _cycle_start_day(self, ctx: TenantContext, company_id: UUID) -> int:
        resolved = self._policy.get_active_or_defaults(ctx, company_id)
        return int(resolved.get("payroll_cycle_start_day") or 20)

    def build_period_fields(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        payroll_year: int,
        payroll_month: int,
        cycle_start_day: int | None = None,
    ) -> dict:
        start_day = cycle_start_day if cycle_start_day is not None else self._cycle_start_day(ctx, company_id)
        start, end = payroll_period_bounds_day_to_day(
            payroll_year, payroll_month, cycle_start_day=start_day
        )
        code = payroll_period_code(payroll_year, payroll_month)
        return {
            "period_code": code,
            "period_name": payroll_period_display_name(start, end, payroll_year, payroll_month),
            "payroll_year": payroll_year,
            "payroll_month": payroll_month,
            "start_date": start,
            "end_date": end,
            "payment_date": default_payment_date(payroll_year, payroll_month, start_day),
            "status": PayrollPeriodStatus.OPEN.value,
        }

    def generate(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        payroll_year: int,
        payroll_month: int,
        count: int = 1,
        cycle_start_day: int | None = None,
        skip_existing: bool = True,
    ) -> list[PayPayrollPeriod]:
        """Create 20–20 (or policy) payroll periods; idempotent when ``skip_existing``."""
        if count < 1 or count > 24:
            raise AppException("count must be between 1 and 24")
        cid = self._scope.resolve_company_id(ctx, company_id)
        created: list[PayPayrollPeriod] = []
        for y, m in iter_payroll_months(payroll_year, payroll_month, count):
            fields = self.build_period_fields(
                ctx, cid, payroll_year=y, payroll_month=m, cycle_start_day=cycle_start_day
            )
            if skip_existing:
                existing = self._repo.get_by_period_code(ctx, cid, fields["period_code"])
                if existing is not None:
                    created.append(existing)
                    continue
            row = self._repo.create(ctx, company_id=cid, **fields)
            self._audit.log_entity_change(
                tenant_id=ctx.tenant_id,
                entity_name="pay_payroll_period",
                entity_id=row.id,
                operation="generate",
                performed_by=ctx.user_id,
            )
            created.append(row)
        return created

    def ensure_current_period(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        *,
        on_date: date | None = None,
    ) -> PayPayrollPeriod:
        """Ensure the payroll period containing ``on_date`` (default today) exists."""
        from modules.payroll.domain.payroll_period_calendar import payroll_anchor_for_date

        cid = self._scope.resolve_company_id(ctx, company_id)
        ref = on_date or date.today()
        start_day = self._cycle_start_day(ctx, cid)
        y, m = payroll_anchor_for_date(ref, cycle_start_day=start_day)
        return self.generate(
            ctx, company_id=cid, payroll_year=y, payroll_month=m, count=1, skip_existing=True
        )[0]

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)

        row = self._repo.create(ctx, company_id=cid, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="pay_payroll_period",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("PayrollPeriod not found")
        return row

    def _transition(self, ctx: TenantContext, row_id: UUID, action: str, fn) -> PayPayrollPeriod:
        row = self.get(ctx, row_id)
        fn(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="pay_payroll_period",
            entity_id=row_id,
            operation=action,
            performed_by=ctx.user_id,
        )
        return updated

    def start_processing(self, ctx: TenantContext, row_id: UUID):
        return self._transition(ctx, row_id, "start_processing", self._engine.start_processing)

    def approve(self, ctx: TenantContext, row_id: UUID):
        return self._transition(ctx, row_id, "approve", self._engine.approve)

    def close(self, ctx: TenantContext, row_id: UUID):
        return self._transition(ctx, row_id, "close", self._engine.close)

    def reopen(self, ctx: TenantContext, row_id: UUID):
        return self._transition(ctx, row_id, "reopen", self._engine.reopen)

    def cancel(self, ctx: TenantContext, row_id: UUID):
        return self._transition(ctx, row_id, "cancel", self._engine.cancel)
