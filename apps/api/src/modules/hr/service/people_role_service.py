"""Assign hiring manager / recruiter / HR flags and related access."""

from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException, ValidationException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecRole, SecUserRole
from modules.foundation.service.audit_service import AuditService
from modules.foundation.service.user_service import UserService
from modules.master_data.models.employee import MasterEmployee
from modules.recruitment.models import RecRecruiter
from modules.recruitment.repository.base import utcnow

HR_MANAGER_ROLE = "HR_MANAGER"
PROTECTED_ROLE_CODES = {"SUPER_ADMIN", "TENANT_ADMIN", "HR_ADMIN", "HR_EXECUTIVE"}


class PeopleRoleService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._audit = AuditService(db)
        self._users = UserService(db)

    def list_rows(self, ctx: TenantContext) -> list[dict]:
        stmt = select(MasterEmployee).where(
            MasterEmployee.tenant_id == ctx.tenant_id,
            MasterEmployee.is_deleted.is_(False),
        )
        if ctx.company_id:
            stmt = stmt.where(MasterEmployee.company_id == ctx.company_id)
        rows = list(self._db.scalars(stmt.order_by(MasterEmployee.first_name, MasterEmployee.last_name)).all())
        ids = [r.id for r in rows]
        report_counts: dict[UUID, int] = {}
        if ids:
            count_rows = self._db.execute(
                select(MasterEmployee.reporting_manager_id, func.count())
                .where(
                    MasterEmployee.tenant_id == ctx.tenant_id,
                    MasterEmployee.is_deleted.is_(False),
                    MasterEmployee.reporting_manager_id.in_(ids),
                )
                .group_by(MasterEmployee.reporting_manager_id)
            ).all()
            report_counts = {mgr_id: int(n) for mgr_id, n in count_rows if mgr_id}

        by_id = {r.id: r for r in rows}
        missing_mgr_ids = {
            r.reporting_manager_id
            for r in rows
            if r.reporting_manager_id and r.reporting_manager_id not in by_id
        }
        if missing_mgr_ids:
            extras = self._db.scalars(
                select(MasterEmployee).where(MasterEmployee.id.in_(missing_mgr_ids))
            ).all()
            for mgr in extras:
                by_id[mgr.id] = mgr

        user_ids = [r.user_id for r in rows if r.user_id]
        roles_by_user: dict[UUID, list[str]] = {uid: [] for uid in user_ids}
        if user_ids:
            role_rows = self._db.execute(
                select(SecUserRole.user_id, SecRole.role_code)
                .join(SecRole, SecRole.id == SecUserRole.role_id)
                .where(
                    SecUserRole.user_id.in_(user_ids),
                    SecRole.is_deleted.is_(False),
                )
            ).all()
            for uid, code in role_rows:
                roles_by_user.setdefault(uid, []).append(code)

        out: list[dict] = []
        for r in rows:
            mgr = by_id.get(r.reporting_manager_id) if r.reporting_manager_id else None
            mgr_name, mgr_code = self._manager_label(mgr)
            role_codes = roles_by_user.get(r.user_id, []) if r.user_id else []
            out.append(
                self._to_dict(
                    r,
                    reports_count=report_counts.get(r.id, 0),
                    mgr_name=mgr_name,
                    mgr_code=mgr_code,
                    role_codes=role_codes,
                )
            )
        return out

    def update(
        self,
        ctx: TenantContext,
        employee_id: UUID,
        *,
        is_hiring_manager: bool | None = None,
        is_recruiter: bool | None = None,
        is_hr: bool | None = None,
        reporting_manager_id: UUID | None = None,
        clear_reporting_manager: bool = False,
    ) -> dict:
        row = self._get_employee(ctx, employee_id)
        if is_hiring_manager is not None:
            row.is_hiring_manager = is_hiring_manager
        if is_recruiter is not None:
            row.is_recruiter = is_recruiter
            self._sync_recruiter(ctx, row)
        if is_hr is not None:
            row.is_hr = is_hr
            self._sync_hr_role(ctx, row)
        if clear_reporting_manager:
            row.reporting_manager_id = None
        elif reporting_manager_id is not None:
            if reporting_manager_id == row.id:
                raise ValidationException("An employee cannot report to themselves")
            mgr = self._get_employee(ctx, reporting_manager_id)
            if mgr.company_id != row.company_id:
                raise ConflictException("Reporting manager must be in the same company")
            row.reporting_manager_id = mgr.id
            if not mgr.is_hiring_manager:
                mgr.is_hiring_manager = True

        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self._db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="master_employee",
            entity_id=row.id,
            operation="update",
            performed_by=ctx.user_id,
            new_value={
                "is_hiring_manager": row.is_hiring_manager,
                "is_recruiter": row.is_recruiter,
                "is_hr": row.is_hr,
                "reporting_manager_id": str(row.reporting_manager_id) if row.reporting_manager_id else None,
            },
        )
        return self._row_payload(ctx, row)

    def _row_payload(self, ctx: TenantContext, row: MasterEmployee) -> dict:
        mgr_name: str | None = None
        mgr_code: str | None = None
        if row.reporting_manager_id:
            mgr = self._db.get(MasterEmployee, row.reporting_manager_id)
            mgr_name, mgr_code = self._manager_label(mgr)
        reports = self._db.scalar(
            select(func.count())
            .select_from(MasterEmployee)
            .where(
                MasterEmployee.reporting_manager_id == row.id,
                MasterEmployee.is_deleted.is_(False),
            )
        )
        role_codes: list[str] = []
        if row.user_id:
            role_codes = list(
                self._db.scalars(
                    select(SecRole.role_code)
                    .join(SecUserRole, SecUserRole.role_id == SecRole.id)
                    .where(SecUserRole.user_id == row.user_id, SecRole.is_deleted.is_(False))
                ).all()
            )
        return self._to_dict(
            row,
            reports_count=int(reports or 0),
            mgr_name=mgr_name,
            mgr_code=mgr_code,
            role_codes=role_codes,
        )

    def _get_employee(self, ctx: TenantContext, employee_id: UUID) -> MasterEmployee:
        row = self._db.scalar(
            select(MasterEmployee).where(
                MasterEmployee.id == employee_id,
                MasterEmployee.tenant_id == ctx.tenant_id,
                MasterEmployee.is_deleted.is_(False),
            )
        )
        if row is None:
            raise NotFoundException("Employee not found")
        return row

    def _sync_recruiter(self, ctx: TenantContext, emp: MasterEmployee) -> None:
        display = f"{emp.first_name} {emp.last_name}".strip()
        existing = self._db.scalar(
            select(RecRecruiter).where(
                RecRecruiter.tenant_id == ctx.tenant_id,
                RecRecruiter.employee_id == emp.id,
            )
        )
        if emp.is_recruiter:
            if existing:
                existing.is_deleted = False
                existing.deleted_at = None
                existing.deleted_by = None
                existing.status = "active"
                existing.display_name = display or existing.display_name
                existing.updated_at = utcnow()
                existing.updated_by = ctx.user_id
            else:
                code = f"REC-{emp.employee_code}".upper()[:50]
                self._db.add(
                    RecRecruiter(
                        id=uuid4(),
                        tenant_id=ctx.tenant_id,
                        company_id=emp.company_id,
                        branch_id=emp.branch_id,
                        recruiter_code=code,
                        employee_id=emp.id,
                        display_name=display or emp.employee_code,
                        status="active",
                        created_by=ctx.user_id,
                        updated_by=ctx.user_id,
                    )
                )
            self._db.flush()
            return
        if existing and not existing.is_deleted:
            existing.status = "inactive"
            existing.updated_at = utcnow()
            existing.updated_by = ctx.user_id
            self._db.flush()

    def _sync_hr_role(self, ctx: TenantContext, emp: MasterEmployee) -> None:
        if not emp.user_id:
            return
        role = self._db.scalar(
            select(SecRole).where(
                SecRole.tenant_id == ctx.tenant_id,
                SecRole.role_code == HR_MANAGER_ROLE,
                SecRole.is_deleted.is_(False),
            )
        )
        if role is None:
            return
        if emp.is_hr:
            self._users.assign_role(
                tenant_id=ctx.tenant_id,
                user_id=emp.user_id,
                role_id=role.id,
                assigned_by=ctx.user_id,
            )
            return
        existing_codes = set(
            self._db.scalars(
                select(SecRole.role_code)
                .join(SecUserRole, SecUserRole.role_id == SecRole.id)
                .where(SecUserRole.user_id == emp.user_id, SecRole.is_deleted.is_(False))
            ).all()
        )
        if existing_codes & PROTECTED_ROLE_CODES:
            return
        self._users.revoke_role(
            tenant_id=ctx.tenant_id,
            user_id=emp.user_id,
            role_id=role.id,
            revoked_by=ctx.user_id,
        )

    @staticmethod
    def _manager_label(mgr: MasterEmployee | None) -> tuple[str | None, str | None]:
        if mgr is None:
            return None, None
        name = f"{mgr.first_name} {mgr.last_name}".strip() or None
        code = (mgr.employee_code or "").strip() or None
        return name, code

    @staticmethod
    def _to_dict(
        row: MasterEmployee,
        *,
        reports_count: int,
        mgr_name: str | None,
        mgr_code: str | None,
        role_codes: list[str],
    ) -> dict:
        has_login = bool(row.user_id)
        is_hr = bool(getattr(row, "is_hr", False))
        note = None
        if is_hr and not has_login:
            note = "HR flagged, but this employee has no login — ESS login links a user first."
        return {
            "id": row.id,
            "employee_code": row.employee_code,
            "first_name": row.first_name,
            "last_name": row.last_name,
            "display_name": f"{row.first_name} {row.last_name}".strip(),
            "designation": row.designation,
            "status": row.status,
            "reporting_manager_id": row.reporting_manager_id,
            "reporting_manager_name": mgr_name,
            "reporting_manager_code": mgr_code,
            "reports_count": reports_count,
            "is_hiring_manager": bool(getattr(row, "is_hiring_manager", False)),
            "is_recruiter": bool(getattr(row, "is_recruiter", False)),
            "is_hr": is_hr,
            "has_login": has_login,
            "role_codes": role_codes,
            "hr_note": note,
        }
