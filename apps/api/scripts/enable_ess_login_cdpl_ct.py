"""Unlock/activate CDPL + CT ESS accounts (password = CODE+DOB on first login)."""

from __future__ import annotations

from sqlalchemy import select, text

from database.session import SessionLocal
from modules.foundation.models import SecUser
from modules.master_data.models.employee import MasterEmployee
from modules.organization.models.company import OrgCompany
from security.ess_default_password import normalize_employee_code

TARGET_COMPANIES = ("CDPL", "CT")


def main() -> None:
    db = SessionLocal()
    activated = 0
    unlocked = 0
    try:
        company_ids = list(
            db.scalars(
                select(OrgCompany.id).where(
                    OrgCompany.company_code.in_(TARGET_COMPANIES),
                    OrgCompany.is_deleted.is_(False),
                )
            ).all()
        )
        employees = list(
            db.scalars(
                select(MasterEmployee).where(
                    MasterEmployee.company_id.in_(company_ids),
                    MasterEmployee.is_deleted.is_(False),
                    MasterEmployee.user_id.is_not(None),
                )
            ).all()
        )
        for emp in employees:
            if emp.status == "draft":
                emp.status = "active"
                activated += 1
            user = db.get(SecUser, emp.user_id)
            if user is None or getattr(user, "is_deleted", False):
                continue
            db.execute(
                text(
                    """
                    UPDATE foundation.sec_user
                    SET status = 'active',
                        failed_login_count = 0,
                        locked_until = NULL,
                        updated_at = NOW()
                    WHERE id = :id
                    """
                ),
                {"id": str(user.id)},
            )
            unlocked += 1
            print(
                f"ready,{normalize_employee_code(emp.employee_code)},{user.email}"
            )
        db.commit()
        print(f"summary employees={len(employees)} unlocked={unlocked} draft_activated={activated}")
        print("login_rule=employee_code + DOB(ddmmyyyy); first login bootstraps missing DOB")
    finally:
        db.close()


if __name__ == "__main__":
    main()
