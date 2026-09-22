"""Force ESS password reset for linked portal users."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.service.audit_service import AuditService
from modules.hr.service.hr_master_data_adapter import HrMasterDataAdapter


def force_ess_password_reset(db: Session, ctx: TenantContext, employee_id: UUID) -> dict:
    master = HrMasterDataAdapter(db)
    emp = master.get_employee(ctx, employee_id)
    if not emp.user_id:
        raise NotFoundException("Employee has no linked login user")
    user = db.get(SecUser, emp.user_id)
    if user is None or user.is_deleted:
        raise NotFoundException("Login user not found")
    user.must_change_password = True
    user.updated_by = ctx.user_id
    AuditService(db).log_security_event(
        tenant_id=ctx.tenant_id,
        event_type="auth.force_password_change",
        user_id=user.id,
        details_json={"employee_id": str(employee_id), "by": str(ctx.user_id)},
    )
    return {"employee_id": str(employee_id), "user_id": str(user.id), "must_change_password": True}
