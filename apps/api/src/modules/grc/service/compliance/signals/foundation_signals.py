"""Foundation-layer compliance signals (audit, RBAC)."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.audit import AuditLog
from modules.grc.service.compliance.signal_types import ComplianceSignalResult


def signal_audit_trail_active(
    db: Session,
    ctx: TenantContext,
    company_id: UUID,
) -> ComplianceSignalResult:
    """DPDP / ISO: immutable audit trail has recent activity."""
    code = "IN-DPDP-AUDIT-TRAIL"
    since = datetime.now(timezone.utc) - timedelta(days=30)
    stmt = (
        select(func.count())
        .select_from(AuditLog)
        .where(
            AuditLog.tenant_id == ctx.tenant_id,
            AuditLog.performed_at >= since,
        )
    )
    count = int(db.scalar(stmt) or 0)
    if count > 0:
        return ComplianceSignalResult(
            requirement_code=code,
            status="compliant",
            summary=f"Audit trail active — {count} events in the last 30 days.",
            details={"event_count_30d": count},
        )
    return ComplianceSignalResult(
        requirement_code=code,
        status="non_compliant",
        summary="No audit log events in the last 30 days.",
        details={"event_count_30d": 0},
    )
