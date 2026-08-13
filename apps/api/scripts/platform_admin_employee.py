"""Link admin@example.com (Platform Admin) to a master_employee row for CRM lead owner FK."""

from __future__ import annotations

from datetime import date
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.models.security import SecTenant, SecUser
from modules.master_data.models.employee import MasterEmployee
from modules.organization.models.branch import OrgBranch
from modules.organization.models.company import OrgCompany
from modules.organization.models.hierarchy import OrgDepartment


def ensure_platform_admin_employee(
    db: Session,
    *,
    tenant: SecTenant,
    company: OrgCompany,
    branch: OrgBranch,
    admin: SecUser,
) -> MasterEmployee:
    dept = db.scalar(
        select(OrgDepartment).where(
            OrgDepartment.company_id == company.id,
            OrgDepartment.branch_id == branch.id,
            OrgDepartment.department_code == "ADMIN",
            OrgDepartment.is_deleted.is_(False),
        )
    )
    if dept is None:
        dept = OrgDepartment(
            id=uuid4(),
            tenant_id=tenant.id,
            company_id=company.id,
            branch_id=branch.id,
            department_code="ADMIN",
            department_name="Administration",
            status="active",
            created_by=admin.id,
            updated_by=admin.id,
        )
        db.add(dept)
        db.flush()

    emp = db.scalar(
        select(MasterEmployee).where(
            MasterEmployee.tenant_id == tenant.id,
            MasterEmployee.company_id == company.id,
            MasterEmployee.employee_code == "ADMIN",
            MasterEmployee.is_deleted.is_(False),
        )
    )
    if emp is None:
        emp = MasterEmployee(
            id=uuid4(),
            tenant_id=tenant.id,
            company_id=company.id,
            branch_id=branch.id,
            department_id=dept.id,
            employee_code="ADMIN",
            first_name="Platform",
            last_name="Admin",
            email=admin.email,
            mobile="+91-90000-00000",
            designation="Administrator",
            date_of_joining=date(2024, 1, 1),
            status="active",
            user_id=admin.id,
            created_by=admin.id,
            updated_by=admin.id,
        )
        db.add(emp)
    else:
        emp.email = admin.email
        emp.first_name = "Platform"
        emp.last_name = "Admin"
        emp.designation = "Administrator"
        emp.user_id = admin.id
        emp.status = "active"
        emp.updated_by = admin.id

    db.flush()
    admin.employee_id = emp.id
    db.flush()
    return emp


def main() -> None:
    import sys
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root / "src"))

    from database.session import SessionLocal  # noqa: E402

    db = SessionLocal()
    try:
        tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
        if tenant is None:
            raise RuntimeError("BOOTSTRAP tenant missing. Run seed_demo_data first.")
        company = db.scalar(
            select(OrgCompany).where(
                OrgCompany.tenant_id == tenant.id,
                OrgCompany.company_code == "DEMOCO",
                OrgCompany.is_deleted.is_(False),
            )
        )
        branch = db.scalar(
            select(OrgBranch).where(
                OrgBranch.company_id == company.id,
                OrgBranch.branch_code == "HQ",
                OrgBranch.is_deleted.is_(False),
            )
        ) if company else None
        admin = db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == tenant.id,
                SecUser.email == "admin@example.com",
                SecUser.is_deleted.is_(False),
            )
        )
        if not all([company, branch, admin]):
            raise RuntimeError("DEMOCO/HQ/admin@example.com missing. Run seed_demo_data first.")
        emp = ensure_platform_admin_employee(
            db, tenant=tenant, company=company, branch=branch, admin=admin
        )
        db.commit()
        print(f"Linked {admin.email} -> master employee {emp.employee_code} ({emp.id})")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
