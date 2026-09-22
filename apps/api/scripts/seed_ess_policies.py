"""Seed mandatory ESS policies for demo company.

Usage (from apps/api):
  python -m scripts.seed_ess_policies
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import SecTenant, SecUser  # noqa: E402
from modules.hr.models.ess_policy import HrEssPolicy  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402

POLICIES = [
    (
        "CODE_OF_CONDUCT",
        "Code of Conduct",
        """## Our values
We treat colleagues, customers, and partners with respect.

## Workplace behaviour
Harassment, discrimination, and retaliation are not tolerated.

## Conflicts of interest
Disclose any personal interest that could affect business decisions.

## Acknowledgment
By accepting, you confirm you have read and will follow this code.
""",
    ),
    (
        "IT_ACCEPTABLE_USE",
        "IT Acceptable Use",
        """## Devices and accounts
Use company devices and credentials only for authorized work.

## Data protection
Do not share confidential data outside approved channels.

## Security
Report suspected phishing or malware to IT immediately.

## Acknowledgment
You agree to use IT resources responsibly and report incidents promptly.
""",
    ),
    (
        "LEAVE_ESSENTIALS",
        "Leave & attendance essentials",
        """## Applying leave
Submit leave requests in advance except for emergencies.

## Attendance
Punch in/out honestly; WFH and on-duty require approval when required by policy.

## Balances
Leave balances update monthly; used leave is deducted on approval.

## Acknowledgment
You understand how leave and attendance work in this organization.
""",
    ),
]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def main() -> None:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
        if tenant is None:
            raise SystemExit("Run seed_demo_data first")
        company = db.scalar(
            select(OrgCompany).where(
                OrgCompany.tenant_id == tenant.id,
                OrgCompany.company_code == "DEMOCO",
                OrgCompany.is_deleted.is_(False),
            )
        )
        if company is None:
            raise SystemExit("Demo company missing")
        admin = db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == tenant.id,
                SecUser.email == "admin@example.com",
                SecUser.is_deleted.is_(False),
            )
        )
        admin_id = admin.id if admin else None
        now = utcnow()
        for order, (code, title, body) in enumerate(POLICIES):
            existing = db.scalar(
                select(HrEssPolicy).where(
                    HrEssPolicy.company_id == company.id,
                    HrEssPolicy.policy_code == code,
                    HrEssPolicy.is_deleted.is_(False),
                )
            )
            if existing:
                existing.title = title
                existing.content_markdown = body
                existing.display_order = order
                existing.status = "published"
                existing.is_mandatory = True
                existing.published_at = now
                existing.updated_by = admin_id
                continue
            db.add(
                HrEssPolicy(
                    id=uuid4(),
                    tenant_id=tenant.id,
                    company_id=company.id,
                    policy_code=code,
                    title=title,
                    policy_version=1,
                    content_markdown=body,
                    is_mandatory=True,
                    display_order=order,
                    published_at=now,
                    status="published",
                    created_by=admin_id,
                    updated_by=admin_id,
                )
            )
        db.commit()
        print(f"Seeded {len(POLICIES)} ESS policies for {company.company_code}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
