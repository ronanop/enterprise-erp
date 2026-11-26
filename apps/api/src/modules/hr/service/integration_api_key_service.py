"""Create/manage integration API keys and serve scoped employee data."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import AppException, ForbiddenException, NotFoundException, UnauthorizedException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.base import hash_token
from modules.hr.integration_catalog import (
    INTEGRATION_EMPLOYEE_FIELDS,
    INTEGRATION_ENDPOINTS,
    normalize_endpoints,
    normalize_fields,
)
from modules.hr.models.employee_profile import HrEmployeeProfile
from modules.hr.models.employment import HrEmployment
from modules.hr.models.integration_api_key import HrIntegrationApiKey
from modules.hr.models.leave_balance import HrLeaveBalance
from modules.hr.models.leave_type import HrLeaveType
from modules.hr.models.shift import HrShift
from modules.hr.models.shift_assignment import HrShiftAssignment
from modules.hr.repository.integration_api_key_repository import HrIntegrationApiKeyRepository
from modules.hr.schemas import (
    HrIntegrationApiKeyCreated,
    HrIntegrationApiKeyRecord,
    HrIntegrationCatalog,
    HrIntegrationEmployeeRow,
)
from modules.master_data.models.employee import MasterEmployee
from modules.organization.models.branch import OrgBranch
from modules.organization.models.company import OrgCompany
from modules.organization.models.hierarchy import OrgDepartment
from modules.payroll.models.employee_salary import PayEmployeeSalary
from modules.payroll.models.payroll_period import PayPayrollPeriod
from modules.payroll.models.payroll_run import PayPayrollRun
from modules.payroll.models.payroll_run_line import PayPayrollRunLine
from modules.payroll.models.payslip import PayPayslip
from modules.payroll.models.salary_structure import PaySalaryStructure


class HrIntegrationApiKeyService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = HrIntegrationApiKeyRepository(db)

    def catalog(self) -> HrIntegrationCatalog:
        return HrIntegrationCatalog(
            endpoints=INTEGRATION_ENDPOINTS,
            fields=INTEGRATION_EMPLOYEE_FIELDS,
        )

    def list_keys(self, ctx: TenantContext) -> list[HrIntegrationApiKeyRecord]:
        return [self._to_record(row) for row in self._repo.list_active(ctx.tenant_id)]

    def create(
        self,
        ctx: TenantContext,
        *,
        name: str,
        endpoints: list[str],
        fields: list[str],
        company_ids: list[UUID] | None = None,
        notes: str | None = None,
        expires_at: datetime | None = None,
        ttl_days: int | None = None,
    ) -> HrIntegrationApiKeyCreated:
        label = (name or "").strip()
        if not label:
            raise AppException("API key name is required")
        eps = normalize_endpoints(endpoints)
        flds = normalize_fields(fields)
        if not eps:
            raise AppException("Select at least one endpoint")
        if not flds:
            raise AppException("Select at least one data field")

        resolved_expiry = expires_at
        if resolved_expiry is None and ttl_days is not None:
            if ttl_days < 1 or ttl_days > 3650:
                raise AppException("TTL must be between 1 and 3650 days")
            resolved_expiry = datetime.now(timezone.utc) + timedelta(days=ttl_days)
        if resolved_expiry is not None:
            if resolved_expiry.tzinfo is None:
                resolved_expiry = resolved_expiry.replace(tzinfo=timezone.utc)
            if resolved_expiry <= datetime.now(timezone.utc):
                raise AppException("Expiry must be in the future")

        plaintext = f"hrms_{secrets.token_urlsafe(32)}"
        prefix = plaintext[:12]
        row = self._repo.create(
            tenant_id=ctx.tenant_id,
            name=label,
            key_prefix=prefix,
            key_hash=hash_token(plaintext),
            endpoints=eps,
            fields=flds,
            company_ids=[str(x) for x in (company_ids or [])],
            notes=(notes or "").strip() or None,
            expires_at=resolved_expiry,
            actor_id=ctx.user_id,
        )
        self._db.commit()
        return HrIntegrationApiKeyCreated(
            **self._to_record(row).model_dump(),
            api_key=plaintext,
        )

    def revoke(self, ctx: TenantContext, key_id: UUID) -> None:
        row = self._repo.get(ctx.tenant_id, key_id)
        if row is None:
            raise NotFoundException("API key not found")
        self._repo.revoke(row, ctx.user_id)
        self._db.commit()

    def resolve_key(self, plaintext: str | None) -> HrIntegrationApiKey:
        raw = (plaintext or "").strip()
        if not raw.startswith("hrms_"):
            raise UnauthorizedException("Invalid API key")
        prefix = raw[:12]
        row = self._repo.find_by_prefix(prefix)
        if row is None or row.key_hash != hash_token(raw):
            raise UnauthorizedException("Invalid API key")
        if row.status != "active" or row.is_deleted:
            raise UnauthorizedException("API key revoked")
        if row.expires_at and row.expires_at <= datetime.now(timezone.utc):
            raise UnauthorizedException("API key expired")
        self._repo.touch_last_used(row)
        self._db.commit()
        return row

    def list_employees(
        self,
        row: HrIntegrationApiKey,
        *,
        page: int = 1,
        page_size: int = 100,
    ) -> tuple[list[HrIntegrationEmployeeRow], int]:
        if "employees" not in (row.endpoints or []):
            raise ForbiddenException("This API key cannot access the employees endpoint")
        fields = normalize_fields(row.fields)
        if not fields:
            raise ForbiddenException("This API key has no employee fields enabled")

        company_filter = [UUID(str(x)) for x in (row.company_ids or []) if str(x).strip()]
        stmt = select(MasterEmployee).where(
            MasterEmployee.tenant_id == row.tenant_id,
            MasterEmployee.is_deleted.is_(False),
        )
        if company_filter:
            stmt = stmt.where(MasterEmployee.company_id.in_(company_filter))
        stmt = stmt.order_by(MasterEmployee.employee_code.asc())

        employees = list(self._db.scalars(stmt).all())
        total = len(employees)
        start = max(0, (page - 1) * page_size)
        page_rows = employees[start : start + page_size]

        emp_ids = [e.id for e in page_rows]
        dept_ids = {e.department_id for e in page_rows if e.department_id}
        branch_ids = {e.branch_id for e in page_rows if getattr(e, "branch_id", None)}
        company_ids = {e.company_id for e in page_rows if e.company_id}
        manager_ids = {e.reporting_manager_id for e in page_rows if e.reporting_manager_id}
        need_profile = bool({"gender", "date_of_birth"} & set(fields))
        need_employment = bool({"employment_type", "work_location"} & set(fields))
        need_leaves = bool({"leave_balances", "leave_balance_total", "leave_used_total"} & set(fields))
        need_salary = "salary" in fields
        need_payroll = "payroll" in fields
        need_payslip = "payslip" in fields
        need_shift = "shift" in fields
        today = datetime.now(timezone.utc).date()

        dept_map = {
            d.id: d.department_name
            for d in self._db.scalars(
                select(OrgDepartment).where(OrgDepartment.id.in_(dept_ids))
            ).all()
        } if dept_ids else {}
        branch_map = {
            b.id: b.branch_name
            for b in self._db.scalars(select(OrgBranch).where(OrgBranch.id.in_(branch_ids))).all()
        } if branch_ids else {}
        company_map = {
            c.id: c.company_name
            for c in self._db.scalars(select(OrgCompany).where(OrgCompany.id.in_(company_ids))).all()
        } if company_ids else {}
        managers = (
            list(
                self._db.scalars(
                    select(MasterEmployee).where(MasterEmployee.id.in_(manager_ids))
                ).all()
            )
            if manager_ids
            else []
        )
        manager_name_map = {
            m.id: f"{m.first_name} {m.last_name}".strip() for m in managers
        }
        manager_code_map = {m.id: m.employee_code for m in managers}

        profile_map: dict[UUID, HrEmployeeProfile] = {}
        if need_profile and emp_ids:
            for p in self._db.scalars(
                select(HrEmployeeProfile).where(
                    HrEmployeeProfile.employee_id.in_(emp_ids),
                    HrEmployeeProfile.is_deleted.is_(False),
                )
            ).all():
                profile_map[p.employee_id] = p

        employment_map: dict[UUID, HrEmployment] = {}
        if need_employment and emp_ids:
            for em in self._db.scalars(
                select(HrEmployment).where(
                    HrEmployment.employee_id.in_(emp_ids),
                    HrEmployment.is_deleted.is_(False),
                )
            ).all():
                # Prefer the first open/active row per employee
                if em.employee_id not in employment_map:
                    employment_map[em.employee_id] = em

        leave_by_emp: dict[UUID, list[dict[str, object]]] = {eid: [] for eid in emp_ids}
        if need_leaves and emp_ids:
            year = datetime.now(timezone.utc).year
            type_rows = {
                t.id: t
                for t in self._db.scalars(
                    select(HrLeaveType).where(
                        HrLeaveType.tenant_id == row.tenant_id,
                        HrLeaveType.is_deleted.is_(False),
                    )
                ).all()
            }
            balances = self._db.scalars(
                select(HrLeaveBalance).where(
                    HrLeaveBalance.employee_id.in_(emp_ids),
                    HrLeaveBalance.balance_year == year,
                    HrLeaveBalance.is_deleted.is_(False),
                )
            ).all()
            for bal in balances:
                lt = type_rows.get(bal.leave_type_id)
                leave_by_emp.setdefault(bal.employee_id, []).append(
                    {
                        "leave_type_code": lt.leave_type_code if lt else str(bal.leave_type_id),
                        "leave_type_name": lt.leave_type_name if lt else None,
                        "opening_balance": float(bal.opening_balance or 0),
                        "accrued": float(bal.accrued or 0),
                        "used": float(bal.used or 0),
                        "closing_balance": float(bal.closing_balance or 0),
                        "year": bal.balance_year,
                    }
                )

        salary_by_emp: dict[UUID, dict[str, object]] = {}
        if need_salary and emp_ids:
            salaries = list(
                self._db.scalars(
                    select(PayEmployeeSalary)
                    .where(
                        PayEmployeeSalary.employee_id.in_(emp_ids),
                        PayEmployeeSalary.is_deleted.is_(False),
                        PayEmployeeSalary.status.in_(("active", "ended")),
                    )
                    .order_by(PayEmployeeSalary.effective_from.desc())
                ).all()
            )
            structure_ids = {s.salary_structure_id for s in salaries if s.salary_structure_id}
            structure_map = {
                s.id: s
                for s in (
                    self._db.scalars(
                        select(PaySalaryStructure).where(PaySalaryStructure.id.in_(structure_ids))
                    ).all()
                    if structure_ids
                    else []
                )
            }
            for sal in salaries:
                if sal.employee_id in salary_by_emp:
                    continue
                structure = structure_map.get(sal.salary_structure_id)
                salary_by_emp[sal.employee_id] = {
                    "ctc_amount": float(sal.ctc_amount or 0),
                    "gross_amount": float(sal.gross_amount or 0),
                    "currency_code": sal.currency_code,
                    "status": sal.status,
                    "effective_from": sal.effective_from.isoformat() if sal.effective_from else None,
                    "effective_to": sal.effective_to.isoformat() if sal.effective_to else None,
                    "structure_code": structure.structure_code if structure else None,
                    "structure_name": structure.structure_name if structure else None,
                }

        payroll_by_emp: dict[UUID, dict[str, object]] = {}
        if need_payroll and emp_ids:
            lines = list(
                self._db.scalars(
                    select(PayPayrollRunLine)
                    .where(
                        PayPayrollRunLine.employee_id.in_(emp_ids),
                        PayPayrollRunLine.is_deleted.is_(False),
                        PayPayrollRunLine.status != "cancelled",
                    )
                    .order_by(PayPayrollRunLine.created_at.desc())
                ).all()
            )
            run_ids = {ln.payroll_run_id for ln in lines if ln.payroll_run_id}
            runs = {
                r.id: r
                for r in (
                    self._db.scalars(select(PayPayrollRun).where(PayPayrollRun.id.in_(run_ids))).all()
                    if run_ids
                    else []
                )
            }
            period_ids = {r.payroll_period_id for r in runs.values() if r.payroll_period_id}
            periods = {
                p.id: p
                for p in (
                    self._db.scalars(
                        select(PayPayrollPeriod).where(PayPayrollPeriod.id.in_(period_ids))
                    ).all()
                    if period_ids
                    else []
                )
            }
            for ln in lines:
                if ln.employee_id in payroll_by_emp:
                    continue
                run = runs.get(ln.payroll_run_id)
                period = periods.get(run.payroll_period_id) if run else None
                payroll_by_emp[ln.employee_id] = {
                    "run_number": run.document_number if run else None,
                    "run_date": run.run_date.isoformat() if run and run.run_date else None,
                    "run_status": run.status if run else None,
                    "period_code": period.period_code if period else None,
                    "period_name": period.period_name if period else None,
                    "payroll_year": period.payroll_year if period else None,
                    "payroll_month": period.payroll_month if period else None,
                    "paid_days": float(ln.paid_days or 0),
                    "lop_days": float(ln.lop_days or 0),
                    "leave_days": float(ln.leave_days or 0),
                    "gross_earnings": float(ln.gross_earnings or 0),
                    "total_deductions": float(ln.total_deductions or 0),
                    "net_pay": float(ln.net_pay or 0),
                    "employer_contribution": float(ln.employer_contribution or 0),
                    "status": ln.status,
                    "component_breakdown": ln.component_breakdown_json or None,
                }

        payslip_by_emp: dict[UUID, dict[str, object]] = {}
        if need_payslip and emp_ids:
            slips = list(
                self._db.scalars(
                    select(PayPayslip)
                    .where(
                        PayPayslip.employee_id.in_(emp_ids),
                        PayPayslip.is_deleted.is_(False),
                        PayPayslip.status != "void",
                    )
                    .order_by(PayPayslip.created_at.desc())
                ).all()
            )
            for slip in slips:
                if slip.employee_id in payslip_by_emp:
                    continue
                payslip_by_emp[slip.employee_id] = {
                    "document_number": slip.document_number,
                    "gross_salary": float(slip.gross_salary or 0),
                    "total_deductions": float(slip.total_deductions or 0),
                    "net_salary": float(slip.net_salary or 0),
                    "payment_status": slip.payment_status,
                    "delivery_status": slip.delivery_status,
                    "status": slip.status,
                    "issued_at": slip.issued_at.isoformat() if slip.issued_at else None,
                    "payslip": slip.payslip_json or None,
                }

        shift_by_emp: dict[UUID, dict[str, object]] = {}
        if need_shift and emp_ids:
            assignments = list(
                self._db.scalars(
                    select(HrShiftAssignment)
                    .where(
                        HrShiftAssignment.employee_id.in_(emp_ids),
                        HrShiftAssignment.is_deleted.is_(False),
                        HrShiftAssignment.status.in_(("active", "approved")),
                        HrShiftAssignment.effective_from <= today,
                    )
                    .order_by(HrShiftAssignment.effective_from.desc())
                ).all()
            )
            shift_ids = {a.shift_id for a in assignments if a.shift_id}
            shift_map = {
                s.id: s
                for s in (
                    self._db.scalars(select(HrShift).where(HrShift.id.in_(shift_ids))).all()
                    if shift_ids
                    else []
                )
            }
            for asn in assignments:
                if asn.employee_id in shift_by_emp:
                    continue
                if asn.effective_to and asn.effective_to < today:
                    continue
                sh = shift_map.get(asn.shift_id)
                shift_by_emp[asn.employee_id] = {
                    "shift_code": sh.shift_code if sh else None,
                    "shift_name": sh.shift_name if sh else None,
                    "shift_type": sh.shift_type if sh else None,
                    "start_time": sh.start_time.isoformat() if sh and sh.start_time else None,
                    "end_time": sh.end_time.isoformat() if sh and sh.end_time else None,
                    "is_overnight": bool(sh.is_overnight) if sh else None,
                    "grace_minutes": sh.grace_minutes if sh else None,
                    "break_minutes": sh.break_minutes if sh else None,
                    "effective_from": asn.effective_from.isoformat() if asn.effective_from else None,
                    "effective_to": asn.effective_to.isoformat() if asn.effective_to else None,
                    "assignment_status": asn.status,
                }

        out: list[HrIntegrationEmployeeRow] = []
        for emp in page_rows:
            payload: dict[str, object] = {}
            profile = profile_map.get(emp.id)
            employment = employment_map.get(emp.id)
            leaves = leave_by_emp.get(emp.id, [])

            if "employee_code" in fields:
                payload["employee_code"] = emp.employee_code
            if "name" in fields:
                payload["name"] = f"{emp.first_name} {emp.last_name}".strip()
            if "first_name" in fields:
                payload["first_name"] = emp.first_name
            if "last_name" in fields:
                payload["last_name"] = emp.last_name
            if "email" in fields:
                payload["email"] = emp.email
            if "mobile" in fields:
                payload["mobile"] = emp.mobile
            if "designation" in fields:
                payload["designation"] = emp.designation
            if "department" in fields:
                payload["department"] = dept_map.get(emp.department_id) or None
            if "manager" in fields:
                payload["manager"] = (
                    manager_name_map.get(emp.reporting_manager_id)
                    if emp.reporting_manager_id
                    else None
                )
            if "manager_code" in fields:
                payload["manager_code"] = (
                    manager_code_map.get(emp.reporting_manager_id)
                    if emp.reporting_manager_id
                    else None
                )
            if "branch" in fields:
                bid = getattr(emp, "branch_id", None)
                payload["branch"] = branch_map.get(bid) if bid else None
            if "company" in fields:
                payload["company"] = company_map.get(emp.company_id) or None
            if "status" in fields:
                payload["status"] = emp.status
            if "date_of_joining" in fields:
                payload["date_of_joining"] = (
                    emp.date_of_joining.isoformat() if emp.date_of_joining else None
                )
            if "date_of_leaving" in fields:
                payload["date_of_leaving"] = (
                    emp.date_of_leaving.isoformat() if emp.date_of_leaving else None
                )
            if "gender" in fields:
                payload["gender"] = profile.gender if profile else None
            if "date_of_birth" in fields:
                payload["date_of_birth"] = (
                    profile.date_of_birth.isoformat()
                    if profile and profile.date_of_birth
                    else None
                )
            if "employment_type" in fields:
                payload["employment_type"] = employment.employment_type if employment else None
            if "work_location" in fields:
                payload["work_location"] = (
                    employment.work_location_text if employment else None
                )
            if "is_manager" in fields:
                payload["is_manager"] = bool(emp.is_manager)
            if "leave_balances" in fields:
                payload["leave_balances"] = leaves
            if "leave_balance_total" in fields:
                payload["leave_balance_total"] = round(
                    sum(float(x.get("closing_balance") or 0) for x in leaves), 2
                )
            if "leave_used_total" in fields:
                payload["leave_used_total"] = round(
                    sum(float(x.get("used") or 0) for x in leaves), 2
                )
            if "salary" in fields:
                payload["salary"] = salary_by_emp.get(emp.id)
            if "payroll" in fields:
                payload["payroll"] = payroll_by_emp.get(emp.id)
            if "payslip" in fields:
                payload["payslip"] = payslip_by_emp.get(emp.id)
            if "shift" in fields:
                payload["shift"] = shift_by_emp.get(emp.id)
            out.append(HrIntegrationEmployeeRow(id=str(emp.id), data=payload))
        return out, total

    def _to_record(self, row: HrIntegrationApiKey) -> HrIntegrationApiKeyRecord:
        return HrIntegrationApiKeyRecord(
            id=row.id,
            name=row.name,
            key_prefix=row.key_prefix,
            endpoints=list(row.endpoints or []),
            fields=list(row.fields or []),
            company_ids=[UUID(str(x)) for x in (row.company_ids or []) if str(x).strip()],
            status=row.status,
            notes=row.notes,
            created_at=row.created_at,
            last_used_at=row.last_used_at,
            expires_at=row.expires_at,
        )
