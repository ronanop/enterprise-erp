"""Seed demo data for the Sales CRM (Zoho-replacement) module.

Creates:
  - Team-role users used to drive the sales blueprint demo:
      sales.user@example.com       (CRM_SALES_MANAGER — creates companies,
                                     leads, quotes, OVFs)
      presales.user@example.com    (CRM_PRESALES — decides BOQ approvals)
      accounts.user@example.com    (CRM_ACCOUNTS — visibility into quotes/OVF)
      management.user@example.com  (CRM_MANAGEMENT — decides quote-margin and
                                     customer-PO approvals)
    All demo accounts share the password "Secure1!".
  - A handful of CrmProduct catalog rows (hardware / software / services).
  - A "Calipers Consulting" CrmCompany (Sales Account) with sane entity
    defaults so the happy-path demo script in
    docs/07_RELEASES/Sales_CRM_Demo_Guide.md can be followed end to end.
  - Demo CrmContact people under Calipers (and other accounts when re-seeded).

Usage (from apps/api):
  .venv\\Scripts\\python.exe -m scripts.seed_sales_crm_demo
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.crm.models import CrmCompany, CrmContact, CrmProduct  # noqa: E402
from modules.crm.permissions import (  # noqa: E402
    CRM_ACCOUNTS_PERMISSIONS,
    CRM_MANAGEMENT_PERMISSIONS,
    CRM_PRESALES_PERMISSIONS,
    CRM_SALES_MANAGER_PERMISSIONS,
)
from modules.crm.service.company_service import CompanyService  # noqa: E402
from modules.crm.service.contact_service import ContactService  # noqa: E402
from modules.crm.service.product_service import ProductService  # noqa: E402
from modules.foundation.domain.value_objects import TenantContext  # noqa: E402
from modules.foundation.models.security import (  # noqa: E402
    SecRole,
    SecRolePermission,
    SecTenant,
    SecUser,
    SecUserOrgScope,
    SecUserRole,
)
from modules.foundation.service.rbac_service import RBACService  # noqa: E402
from modules.foundation.service.user_service import UserService  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from security.password import PasswordHasher  # noqa: E402

DEMO_PASSWORD = "Secure1!"

TEAM_USERS: list[tuple[str, str, str, list[str]]] = [
    ("sales.user@example.com", "Sales User", "CRM_SALES_MANAGER", CRM_SALES_MANAGER_PERMISSIONS),
    ("presales.user@example.com", "Presales User", "CRM_PRESALES", CRM_PRESALES_PERMISSIONS),
    ("accounts.user@example.com", "Accounts User", "CRM_ACCOUNTS", CRM_ACCOUNTS_PERMISSIONS),
    ("management.user@example.com", "Management User", "CRM_MANAGEMENT", CRM_MANAGEMENT_PERMISSIONS),
]

PRODUCTS: list[tuple[str, str, str, Decimal]] = [
    ("Enterprise Server Rack Unit", "hardware", Decimal("185000.00")),
    ("ERP Platform License (per seat)", "software", Decimal("42000.00")),
    ("Implementation & Onboarding Services", "services", Decimal("95000.00")),
]

# (first_name, last_name, email, phone, title, is_primary)
CALIPERS_CONTACTS: list[tuple[str, str, str, str, str, bool]] = [
    ("Arjun", "Mehta", "arjun.mehta@calipersconsulting.example", "+91-98765-43210", "Head of IT Procurement", True),
    ("Priya", "Sharma", "priya.sharma@calipersconsulting.example", "+91-98111-22334", "Procurement Manager", False),
    ("Rahul", "Iyer", "rahul.iyer@calipersconsulting.example", "+91-98222-33445", "Technical Evaluator", False),
]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_bootstrap_tenant(db) -> SecTenant:
    tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
    if tenant is None:
        raise RuntimeError("BOOTSTRAP tenant not found. Run `python -m scripts.seed_demo_data` first.")
    return tenant


def get_demo_org(db, tenant_id) -> tuple[OrgCompany, OrgBranch]:
    company = db.scalar(
        select(OrgCompany).where(OrgCompany.tenant_id == tenant_id, OrgCompany.company_code == "DEMOCO")
    )
    if company is None:
        raise RuntimeError("DEMOCO company not found. Run `python -m scripts.seed_demo_data` first.")
    branch = db.scalar(select(OrgBranch).where(OrgBranch.company_id == company.id, OrgBranch.branch_code == "HQ"))
    if branch is None:
        raise RuntimeError("HQ branch not found. Run `python -m scripts.seed_demo_data` first.")
    return company, branch


def ensure_role(db, tenant_id, role_code: str, role_name: str) -> SecRole:
    role = db.scalar(
        select(SecRole).where(
            SecRole.tenant_id == tenant_id,
            SecRole.role_code == role_code,
            SecRole.is_deleted.is_(False),
        )
    )
    if role:
        return role
    role = SecRole(
        id=uuid4(),
        tenant_id=tenant_id,
        role_code=role_code,
        role_name=role_name,
        is_system_role=True,
        status="active",
    )
    db.add(role)
    db.flush()
    return role


def ensure_permission_ids(db, perm_map: dict[str, str], codes: list[str]) -> list[str]:
    return [perm_map[code] for code in codes if code in perm_map]


def grant_role_permissions(db, tenant_id, role_id, permission_ids: list[str]) -> None:
    for perm_id in permission_ids:
        exists = db.scalar(
            select(SecRolePermission).where(
                SecRolePermission.role_id == role_id, SecRolePermission.permission_id == perm_id
            )
        )
        if exists:
            continue
        db.add(
            SecRolePermission(
                id=uuid4(),
                tenant_id=tenant_id,
                role_id=role_id,
                permission_id=perm_id,
                granted_at=utcnow(),
            )
        )


def ensure_user(db, tenant: SecTenant, email: str, display_name: str) -> SecUser:
    service = UserService(db)
    existing = db.scalar(
        select(SecUser).where(
            SecUser.tenant_id == tenant.id, SecUser.email == email, SecUser.is_deleted.is_(False)
        )
    )
    if existing:
        existing.password_hash = PasswordHasher.hash_password(DEMO_PASSWORD)
        existing.failed_login_count = 0
        existing.locked_until = None
        if existing.status == "locked":
            existing.status = "active"
        return existing
    created = service.create_user(
        tenant_id=tenant.id,
        email=email,
        password=DEMO_PASSWORD,
        display_name=display_name,
        user_type="employee",
        created_by=None,
    )
    user = db.scalar(select(SecUser).where(SecUser.id == created.id))
    assert user is not None
    return user


def ensure_org_scope(db, tenant_id, user_id, company, branch) -> None:
    scope = db.scalar(
        select(SecUserOrgScope).where(
            SecUserOrgScope.user_id == user_id, SecUserOrgScope.company_id == company.id
        )
    )
    if scope:
        return
    db.add(
        SecUserOrgScope(
            id=uuid4(),
            tenant_id=tenant_id,
            user_id=user_id,
            company_id=company.id,
            branch_id=branch.id,
            is_default=True,
            assigned_at=utcnow(),
            assigned_by=None,
        )
    )


def seed_team_users(
    db, tenant: SecTenant, company: OrgCompany, branch: OrgBranch, perm_map: dict[str, str]
) -> dict[str, SecUser]:
    users: dict[str, SecUser] = {}
    for email, display_name, role_code, perm_codes in TEAM_USERS:
        user = ensure_user(db, tenant, email, display_name)
        db.flush()
        role = ensure_role(db, tenant.id, role_code, display_name.replace(" User", " Team"))
        perm_ids = ensure_permission_ids(db, perm_map, perm_codes)
        grant_role_permissions(db, tenant.id, role.id, perm_ids)
        already = db.scalar(
            select(SecUserRole).where(SecUserRole.user_id == user.id, SecUserRole.role_id == role.id)
        )
        if not already:
            db.add(
                SecUserRole(
                    id=uuid4(),
                    tenant_id=tenant.id,
                    user_id=user.id,
                    role_id=role.id,
                    assigned_at=utcnow(),
                    assigned_by=None,
                )
            )
        ensure_org_scope(db, tenant.id, user.id, company, branch)
        users[email] = user
    db.flush()
    return users


def seed_products(db, ctx: TenantContext, company: OrgCompany) -> list[CrmProduct]:
    svc = ProductService(db)
    rows: list[CrmProduct] = []
    for name, ptype, price in PRODUCTS:
        existing = db.scalar(
            select(CrmProduct).where(
                CrmProduct.company_id == company.id,
                CrmProduct.product_name == name,
                CrmProduct.is_deleted.is_(False),
            )
        )
        if existing:
            rows.append(existing)
            continue
        rows.append(
            svc.create(
                ctx,
                company_id=company.id,
                product_name=name,
                product_type=ptype,
                unit_price=price,
                hsn_sac="8471" if ptype == "hardware" else ("8523" if ptype == "software" else "9983"),
            )
        )
    return rows


def seed_calipers_company(db, ctx: TenantContext, branch: OrgBranch, owner: SecUser) -> CrmCompany:
    existing = db.scalar(
        select(CrmCompany).where(
            CrmCompany.company_id == ctx.company_id,
            CrmCompany.customer_name == "Calipers Consulting",
            CrmCompany.is_deleted.is_(False),
        )
    )
    if existing:
        return existing
    svc = CompanyService(db)
    return svc.create(
        ctx,
        branch_id=branch.id,
        customer_name="Calipers Consulting",
        account_type="prospect",
        industry="IT Services & Consulting",
        source="referral",
        rating="hot",
        first_name="Arjun",
        last_name="Mehta",
        customer_email="arjun.mehta@calipersconsulting.example",
        phone="+91-98765-43210",
        website="https://www.calipersconsulting.example",
        role="Head of IT Procurement",
        billing_street="14th Floor, Prestige Tech Park",
        billing_city="Bengaluru",
        billing_state="Karnataka",
        billing_code="560103",
        billing_country="India",
        shipping_street="14th Floor, Prestige Tech Park",
        shipping_city="Bengaluru",
        shipping_state="Karnataka",
        shipping_code="560103",
        shipping_country="India",
        description="Mid-market IT consulting firm — demo Sales Account for the CRM blueprint walkthrough.",
        account_owner_id=owner.id,
    )


def seed_calipers_contacts(db, ctx: TenantContext, account: CrmCompany) -> list[CrmContact]:
    svc = ContactService(db)
    rows: list[CrmContact] = []
    for first, last, email, phone, title, is_primary in CALIPERS_CONTACTS:
        existing = db.scalar(
            select(CrmContact).where(
                CrmContact.company_account_id == account.id,
                CrmContact.first_name == first,
                CrmContact.last_name == last,
                CrmContact.is_deleted.is_(False),
            )
        )
        if existing:
            rows.append(existing)
            continue
        rows.append(
            svc.create(
                ctx,
                company_account_id=account.id,
                branch_id=account.branch_id,
                first_name=first,
                last_name=last,
                email=email,
                phone=phone,
                mobile=phone,
                title=title,
                is_primary=is_primary,
            )
        )
    return rows


def main() -> None:
    db = SessionLocal()
    try:
        tenant = get_bootstrap_tenant(db)
        company, branch = get_demo_org(db, tenant.id)

        # Guarantee all crm.* (and other module) permission rows exist before
        # granting them to the new team roles below.
        from scripts.seed_all_permissions import ensure_permissions

        perm_map = ensure_permissions(db)
        db.commit()

        users = seed_team_users(db, tenant, company, branch, perm_map)
        db.commit()

        rbac = RBACService(db)
        for user in users.values():
            rbac.invalidate_user(user.id)

        sales_user = users["sales.user@example.com"]
        ctx = TenantContext(
            tenant_id=tenant.id,
            user_id=sales_user.id,
            user_type="employee",
            company_id=company.id,
            branch_id=branch.id,
        )

        products = seed_products(db, ctx, company)
        db.commit()

        calipers = seed_calipers_company(db, ctx, branch, sales_user)
        db.commit()

        contacts = seed_calipers_contacts(db, ctx, calipers)
        db.commit()

        print("=" * 70)
        print("Sales CRM demo data seeded")
        print("=" * 70)
        print(f"Tenant           : {tenant.tenant_code} ({tenant.id})")
        print(f"Company / Branch : {company.company_code} / {branch.branch_code}")
        print("-" * 70)
        print("Demo logins (password for all: Secure1!):")
        for email, _display_name, role_code, _perms in TEAM_USERS:
            print(f"  - {email:<32} role={role_code}")
        print("-" * 70)
        print(f"Products seeded   : {len(products)}")
        for p in products:
            print(f"  - [{p.product_type:<9}] {p.product_code}  {p.product_name}  @ {p.unit_price}")
        print("-" * 70)
        print(f"Sales account     : {calipers.account_number}  {calipers.customer_name}  (id={calipers.id})")
        print(f"Contacts seeded   : {len(contacts)}")
        for c in contacts:
            primary = "primary" if c.is_primary else "secondary"
            print(f"  - {c.first_name} {c.last_name}  ({c.title})  [{primary}]")
        print("=" * 70)
        print("Next: sign in as sales.user@example.com and POST")
        print(f"  /crm/companies/{calipers.id}/leads")
        print("to start the BOQ -> ... -> OVF -> Deal Won demo flow.")
        print("See docs/07_RELEASES/Sales_CRM_Demo_Guide.md for the full script.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
