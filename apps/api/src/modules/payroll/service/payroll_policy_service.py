"""Payroll policy application service (Phase 0)."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.payroll.domain.payroll_policy_spec import default_company_payroll_policy_fields
from modules.payroll.models.payroll_policy import PayPayrollPolicy
from modules.payroll.repository.payroll_policy_repository import PayrollPolicyRepository
from modules.payroll.service.engines.payroll_policy_engine import PayrollPolicyEngine
from modules.payroll.service.payroll_scope_validator import PayrollScopeValidator


class PayrollPolicyService:
    def __init__(self, db: Session) -> None:
        self._repo = PayrollPolicyRepository(db)
        self._scope = PayrollScopeValidator(db)
        self._engine = PayrollPolicyEngine()
        self._audit = AuditService(db)

    @staticmethod
    def default_template() -> dict:
        """In-memory defaults (no DB)."""
        fields = default_company_payroll_policy_fields()
        fields.pop("status", None)
        return fields

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> PayPayrollPolicy:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Payroll policy not found")
        return row

    def get_active(self, ctx: TenantContext, company_id: UUID | None = None) -> PayPayrollPolicy | None:
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.get_active(ctx, cid)

    def get_active_or_defaults(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        """Resolved policy for calculators: DB active row merged over code defaults."""
        base = self.default_template()
        row = self.get_active(ctx, company_id)
        if row is None:
            return {"source": "defaults", **base}
        return {
            "source": "database",
            "id": row.id,
            "company_id": row.company_id,
            "policy_code": row.policy_code,
            "policy_name": row.policy_name,
            "effective_from": row.effective_from,
            "effective_to": row.effective_to,
            "status": row.status,
            "payroll_cycle_type": row.payroll_cycle_type,
            "payroll_cycle_start_day": row.payroll_cycle_start_day,
            "leave_cycle_type": row.leave_cycle_type,
            "leave_balance_credit_timing": row.leave_balance_credit_timing,
            "salary_proration_mode": row.salary_proration_mode,
            "period_day_denominator": row.period_day_denominator,
            "lop_source": row.lop_source,
            "basic_percent": row.basic_percent,
            "hra_percent_of_basic": row.hra_percent_of_basic,
            "pf_mode": row.pf_mode,
            "pf_employee_amount": row.pf_employee_amount,
            "pf_employer_amount": row.pf_employer_amount,
            "pf_total_amount": row.pf_total_amount,
            "net_pay_formula": row.net_pay_formula,
            "attendance_rules_json": row.attendance_rules_json,
            "notes": row.notes,
        }

    def ensure_default_active(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        *,
        effective_from: date | None = None,
    ) -> PayPayrollPolicy:
        """Create DEFAULT active policy for company if none exists."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        existing = self._repo.get_active(ctx, cid)
        if existing is not None:
            return existing
        fields = default_company_payroll_policy_fields()
        row = self._repo.create(
            ctx,
            company_id=cid,
            effective_from=effective_from or date.today(),
            **fields,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="pay_payroll_policy",
            entity_id=row.id,
            operation="ensure_default_active",
            performed_by=ctx.user_id,
        )
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        row = self._repo.create(ctx, company_id=cid, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="pay_payroll_policy",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Payroll policy not found")
        return row

    def activate(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.activate(row)
        self._repo.archive_other_active(ctx, row.company_id, row.id)
        updated = self._repo.update(ctx, row_id, status=row.status)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="pay_payroll_policy",
            entity_id=row_id,
            operation="activate",
            performed_by=ctx.user_id,
        )
        return updated

    def archive(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.archive(row)
        return self._repo.update(ctx, row_id, status=row.status)
