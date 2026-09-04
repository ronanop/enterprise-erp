"""Finance compliance signals — read-only checks on fin_* tables."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.finance.models.tax import FinTaxRegister
from modules.grc.service.compliance.signal_types import ComplianceSignalResult


def signal_gst_tax_register_populated(
    db: Session,
    ctx: TenantContext,
    company_id: UUID,
) -> ComplianceSignalResult:
    """India GST: tax register has posted lines for the company."""
    code = "IN-GST-TAX-REGISTER"
    stmt = (
        select(func.count())
        .select_from(FinTaxRegister)
        .where(
            FinTaxRegister.tenant_id == ctx.tenant_id,
            FinTaxRegister.company_id == company_id,
            FinTaxRegister.is_deleted.is_(False),
        )
    )
    count = int(db.scalar(stmt) or 0)
    if count > 0:
        return ComplianceSignalResult(
            requirement_code=code,
            status="partially_compliant",
            summary=(
                f"Tax register has {count} line(s). "
                "E-invoice / GSTR filing integration is not yet automated."
            ),
            details={"tax_register_lines": count},
        )
    return ComplianceSignalResult(
        requirement_code=code,
        status="non_compliant",
        summary="No GST/VAT/TDS lines in the finance tax register.",
        details={"tax_register_lines": 0},
    )
