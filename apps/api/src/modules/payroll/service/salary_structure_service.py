"""SalaryStructure application service."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.payroll.domain.exceptions import InvalidSalaryStructureState
from modules.payroll.domain.salary_structure_calculator import compute_ctc_split
from modules.payroll.models import PaySalaryStructure
from modules.payroll.repository.employee_salary_repository import EmployeeSalaryRepository
from modules.payroll.repository.salary_structure_line_repository import SalaryStructureLineRepository
from modules.payroll.repository.salary_structure_repository import SalaryStructureRepository
from modules.payroll.service.engines import SalaryStructureEngine
from modules.payroll.service.payroll_scope_validator import PayrollScopeValidator

_SPLIT_INPUTS = (
    "gross_ctc",
    "basic_percent",
    "hra_percent_of_basic",
    "telephone_allowance",
    "employer_contribution",
)


def _apply_ctc_split(fields: dict, existing: PaySalaryStructure | None = None) -> dict:
    payload = {**fields}
    gross = payload.get("gross_ctc", existing.gross_ctc if existing else Decimal("0"))
    split = compute_ctc_split(
        gross_ctc=gross or Decimal("0"),
        basic_percent=payload.get(
            "basic_percent", existing.basic_percent if existing else Decimal("0.6")
        ),
        hra_percent_of_basic=payload.get(
            "hra_percent_of_basic",
            existing.hra_percent_of_basic if existing else Decimal("0.5"),
        ),
        telephone_allowance=payload.get(
            "telephone_allowance", existing.telephone_allowance if existing else Decimal("0")
        ),
        employer_contribution=payload.get(
            "employer_contribution",
            existing.employer_contribution if existing else Decimal("1800"),
        ),
    )
    payload["basic_amount"] = split["basic"]
    payload["hra_amount"] = split["hra"]
    payload["special_allowance"] = split["special_allowance"]
    payload["ctc_amount"] = split["ctc"]
    payload["gross_ctc"] = split["monthly_ctc"]
    return payload


class SalaryStructureService:
    def __init__(self, db: Session) -> None:
        self._repo = SalaryStructureRepository(db)
        self._salaries = EmployeeSalaryRepository(db)
        self._lines = SalaryStructureLineRepository(db)
        self._scope = PayrollScopeValidator(db)
        self._engine = SalaryStructureEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> PaySalaryStructure:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("SalaryStructure not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        if not fields.get("structure_code"):
            import uuid as _uuid

            fields["structure_code"] = f"STR-{str(_uuid.uuid4())[:8].upper()}"
        fields.setdefault("currency_code", "INR")
        fields.setdefault("status", "draft")
        fields = _apply_ctc_split(fields)
        row = self._repo.create(ctx, company_id=cid, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="pay_salary_structure",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        existing = self.get(ctx, row_id)
        if any(k in fields for k in _SPLIT_INPUTS):
            fields = _apply_ctc_split(fields, existing)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("SalaryStructure not found")
        return row

    def delete(self, ctx: TenantContext, row_id: UUID) -> None:
        row = self.get(ctx, row_id)
        assigned = self._salaries.count_by_structure(ctx, row_id)
        if assigned > 0:
            raise InvalidSalaryStructureState(
                f"Cannot delete salary structure assigned to {assigned} employee(s)"
            )
        for line in self._lines.list_for_structure(ctx, row_id):
            self._lines.soft_delete(ctx, line.id)
        if not self._repo.soft_delete(ctx, row_id):
            raise NotFoundException("SalaryStructure not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="pay_salary_structure",
            entity_id=row.id,
            operation="delete",
            performed_by=ctx.user_id,
            old_value={"structure_code": row.structure_code, "structure_name": row.structure_name},
        )
