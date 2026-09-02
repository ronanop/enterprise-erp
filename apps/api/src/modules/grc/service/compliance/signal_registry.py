"""Maps requirement codes to automated compliance signal handlers."""

from collections.abc import Callable
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.grc.service.compliance.signal_types import ComplianceSignalResult
from modules.grc.service.compliance.signals import finance_signals, foundation_signals

SignalHandler = Callable[[Session, TenantContext, UUID], ComplianceSignalResult]

_REGISTRY: dict[str, SignalHandler] = {
    "IN-DPDP-AUDIT-TRAIL": foundation_signals.signal_audit_trail_active,
    "IN-GST-TAX-REGISTER": finance_signals.signal_gst_tax_register_populated,
}


class ComplianceSignalRegistry:
    @staticmethod
    def registered_codes() -> list[str]:
        return sorted(_REGISTRY.keys())

    @staticmethod
    def run(
        db: Session,
        ctx: TenantContext,
        company_id: UUID,
        requirement_code: str,
    ) -> ComplianceSignalResult | None:
        handler = _REGISTRY.get(requirement_code.strip().upper())
        if handler is None:
            return None
        return handler(db, ctx, company_id)

    @staticmethod
    def run_all(
        db: Session,
        ctx: TenantContext,
        company_id: UUID,
    ) -> list[ComplianceSignalResult]:
        results: list[ComplianceSignalResult] = []
        for code in _REGISTRY:
            result = _REGISTRY[code](db, ctx, company_id)
            results.append(result)
        return results
