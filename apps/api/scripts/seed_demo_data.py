"""Seed demo tenant users and sample org/master data for local testing.

Usage (from apps/api):
  .venv\\Scripts\\python.exe -m scripts.seed_demo_data
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select, text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import (  # noqa: E402
    SecRole,
    SecTenant,
    SecUser,
    SecUserOrgScope,
    SecUserRole,
)
from modules.foundation.service.user_service import UserService  # noqa: E402
from modules.master_data.models.party import MasterCustomer, MasterVendor  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from security.password import PasswordHasher  # noqa: E402

DEMO_PASSWORD = "Secure1!"

# Module keys must match apps/web/src/config/modules.ts (email = `{key}.user@example.com`).
MODULE_DEMO_USERS = [
    ("foundation", "Foundation User"),
    ("organization", "Organization User"),
    ("master-data", "Master Data User"),
    ("finance", "Finance User"),
    ("sales", "Sales User"),
    ("procurement", "Procurement User"),
    ("inventory", "Inventory User"),
    ("manufacturing", "Manufacturing User"),
    ("quality", "Quality User"),
    ("crm", "CRM User"),
    ("hr", "HR User"),
    ("payroll", "Payroll User"),
    ("recruitment", "Recruitment User"),
    ("projects", "Projects User"),
    ("assets", "Assets User"),
    ("service", "Service User"),
    ("helpdesk", "Helpdesk User"),
    ("documents", "Documents User"),
    ("grc", "GRC User"),
    ("analytics", "Analytics User"),
    ("integration", "Integration User"),
    ("ecommerce", "Ecommerce User"),
    ("portal", "Portal User"),
]

DEMO_USERS = [
    {
        "email": "admin@example.com",
        "display_name": "Platform Admin",
        "user_type": "super_admin",
        "role_code": "SUPER_ADMIN",
    },
    {
        "email": "tenant.admin@example.com",
        "display_name": "Tenant Admin",
        "user_type": "tenant_admin",
        "role_code": "TENANT_ADMIN",
    },
    *[
        {
            "email": f"{module_key}.user@example.com",
            "display_name": display_name,
            "user_type": "employee",
            "role_code": "TENANT_ADMIN",
        }
        for module_key, display_name in MODULE_DEMO_USERS
    ],
]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_or_create_bootstrap_tenant(db) -> SecTenant:
    tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
    if tenant:
        return tenant
    tenant = SecTenant(
        id=uuid4(),
        tenant_code="BOOTSTRAP",
        tenant_name="Bootstrap Demo Tenant",
        status="active",
        timezone="UTC",
        locale="en",
    )
    db.add(tenant)
    db.flush()
    return tenant


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


def grant_all_permissions_to_super_admin(db, tenant_id, role_id) -> None:
    db.execute(
        text(
            """
            INSERT INTO foundation.sec_role_permission (
                id, tenant_id, role_id, permission_id, granted_at
            )
            SELECT gen_random_uuid(), :tenant_id, :role_id, p.id, NOW()
            FROM foundation.sec_permission p
            WHERE p.is_active = true
              AND NOT EXISTS (
                SELECT 1 FROM foundation.sec_role_permission rp
                WHERE rp.role_id = :role_id AND rp.permission_id = p.id
              )
            """
        ),
        {"tenant_id": str(tenant_id), "role_id": str(role_id)},
    )


def seed_users(db, tenant: SecTenant) -> dict[str, SecUser]:
    users: dict[str, SecUser] = {}
    service = UserService(db)
    roles = {
        "SUPER_ADMIN": ensure_role(db, tenant.id, "SUPER_ADMIN", "Super Admin"),
        "TENANT_ADMIN": ensure_role(db, tenant.id, "TENANT_ADMIN", "Tenant Admin"),
    }
    grant_all_permissions_to_super_admin(db, tenant.id, roles["SUPER_ADMIN"].id)

    # Also grant all permissions to TENANT_ADMIN for demo convenience
    grant_all_permissions_to_super_admin(db, tenant.id, roles["TENANT_ADMIN"].id)

    demo_password_hash = PasswordHasher.hash_password(DEMO_PASSWORD)

    for spec in DEMO_USERS:
        existing = db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == tenant.id,
                SecUser.email == spec["email"],
                SecUser.is_deleted.is_(False),
            )
        )
        if existing:
            # Keep all demo / module accounts on the shared default password.
            existing.password_hash = demo_password_hash
            existing.failed_login_count = 0
            existing.locked_until = None
            if existing.status == "locked":
                existing.status = "active"
            users[spec["email"]] = existing
            user = existing
        else:
            created = service.create_user(
                tenant_id=tenant.id,
                email=spec["email"],
                password=DEMO_PASSWORD,
                display_name=spec["display_name"],
                user_type=spec["user_type"],
                created_by=None,
            )
            user = db.scalar(select(SecUser).where(SecUser.id == created.id))
            assert user is not None
            users[spec["email"]] = user

        role = roles[spec["role_code"]]
        already = db.scalar(
            select(SecUserRole).where(
                SecUserRole.user_id == user.id,
                SecUserRole.role_id == role.id,
            )
        )
        if not already:
            service.assign_role(
                tenant_id=tenant.id,
                user_id=user.id,
                role_id=role.id,
                assigned_by=None,
            )

    return users


def seed_organization(db, tenant: SecTenant, admin: SecUser) -> tuple[OrgCompany, OrgBranch]:
    company = db.scalar(
        select(OrgCompany).where(
            OrgCompany.tenant_id == tenant.id,
            OrgCompany.company_code == "DEMOCO",
            OrgCompany.is_deleted.is_(False),
        )
    )
    if not company:
        company = OrgCompany(
            id=uuid4(),
            tenant_id=tenant.id,
            company_code="DEMOCO",
            company_name="Demo Industries Pvt Ltd",
            legal_name="Demo Industries Private Limited",
            country_code="IN",
            currency_code="INR",
            registration_number="CIN-DEMO-001",
            tax_number="GSTIN-DEMO-001",
            fiscal_year_start_month=4,
            timezone="Asia/Kolkata",
            status="active",
            created_by=admin.id,
            updated_by=admin.id,
        )
        db.add(company)
        db.flush()

    branch = db.scalar(
        select(OrgBranch).where(
            OrgBranch.company_id == company.id,
            OrgBranch.branch_code == "HQ",
            OrgBranch.is_deleted.is_(False),
        )
    )
    if not branch:
        branch = OrgBranch(
            id=uuid4(),
            tenant_id=tenant.id,
            company_id=company.id,
            branch_code="HQ",
            branch_name="Head Office",
            branch_type="head_office",
            address_line1="100 Demo Park",
            city="Bengaluru",
            state_code="KA",
            country_code="IN",
            postal_code="560001",
            phone="+91-80-0000-0000",
            email="hq@demo.local",
            status="active",
            created_by=admin.id,
            updated_by=admin.id,
        )
        db.add(branch)
        db.flush()

    # Default org scope for all demo users
    for user in db.scalars(
        select(SecUser).where(SecUser.tenant_id == tenant.id, SecUser.is_deleted.is_(False))
    ).all():
        scope = db.scalar(
            select(SecUserOrgScope).where(
                SecUserOrgScope.user_id == user.id,
                SecUserOrgScope.company_id == company.id,
            )
        )
        if not scope:
            db.add(
                SecUserOrgScope(
                    id=uuid4(),
                    tenant_id=tenant.id,
                    user_id=user.id,
                    company_id=company.id,
                    branch_id=branch.id,
                    is_default=True,
                    assigned_at=utcnow(),
                    assigned_by=admin.id,
                )
            )

    return company, branch


def seed_master_data(
    db,
    tenant: SecTenant,
    company: OrgCompany,
    branch: OrgBranch,
    admin: SecUser,
) -> None:
    customers = [
        ("CUST-001", "Acme Retail", "corporate", "billing@acme.example", "+91-90000-00001"),
        ("CUST-002", "Northwind Traders", "corporate", "ap@northwind.example", "+91-90000-00002"),
        ("CUST-003", "Priya Sharma", "individual", "priya@example.com", "+91-90000-00003"),
    ]
    for code, name, ctype, email, mobile in customers:
        exists = db.scalar(
            select(MasterCustomer).where(
                MasterCustomer.company_id == company.id,
                MasterCustomer.customer_code == code,
                MasterCustomer.is_deleted.is_(False),
            )
        )
        if exists:
            continue
        db.add(
            MasterCustomer(
                id=uuid4(),
                tenant_id=tenant.id,
                company_id=company.id,
                branch_id=branch.id,
                customer_code=code,
                customer_name=name,
                customer_type=ctype,
                email=email,
                mobile=mobile,
                billing_address_json={
                    "line1": "Sample Street",
                    "city": "Bengaluru",
                    "country_code": "IN",
                },
                shipping_address_json={
                    "line1": "Warehouse Road",
                    "city": "Bengaluru",
                    "country_code": "IN",
                },
                credit_limit=250000,
                currency_code="INR",
                status="active",
                created_by=admin.id,
                updated_by=admin.id,
            )
        )

    vendors = [
        ("VEND-001", "Global Supplies", "domestic", "sales@globalsupplies.example"),
        ("VEND-002", "Pacific Parts", "international", "orders@pacificparts.example"),
        ("VEND-003", "QuickServe Logistics", "service", "ops@quickserve.example"),
    ]
    for code, name, vtype, email in vendors:
        exists = db.scalar(
            select(MasterVendor).where(
                MasterVendor.company_id == company.id,
                MasterVendor.vendor_code == code,
                MasterVendor.is_deleted.is_(False),
            )
        )
        if exists:
            continue
        db.add(
            MasterVendor(
                id=uuid4(),
                tenant_id=tenant.id,
                company_id=company.id,
                branch_id=branch.id,
                vendor_code=code,
                vendor_name=name,
                vendor_type=vtype,
                email=email,
                mobile="+91-80000-00000",
                payment_terms="Net 30",
                address_json={"line1": "Vendor Lane", "city": "Chennai", "country_code": "IN"},
                status="active",
                created_by=admin.id,
                updated_by=admin.id,
            )
        )


def main() -> None:
    # Ensure password policy hash works once (imported for clarity / fail-fast)
    PasswordHasher.hash_password(DEMO_PASSWORD)

    db = SessionLocal()
    try:
        tenant = get_or_create_bootstrap_tenant(db)
        users = seed_users(db, tenant)
        admin = users["admin@example.com"]
        company, branch = seed_organization(db, tenant, admin)
        seed_master_data(db, tenant, company, branch, admin)
        db.commit()

        # Grant every module permission to demo admin roles
        print("Granting all-module permissions to demo roles…")
        from scripts.seed_all_permissions import (  # local import to avoid cycles
            ensure_permissions,
            ensure_role,
            grant_all_to_roles,
            invalidate_user_caches,
        )

        perm_map = ensure_permissions(db)
        role_ids = [
            ensure_role(db, tenant.id, "SUPER_ADMIN", "Super Admin"),
            ensure_role(db, tenant.id, "TENANT_ADMIN", "Tenant Admin"),
        ]
        grant_all_to_roles(db, tenant.id, role_ids, list(perm_map.values()))
        db.commit()
        invalidate_user_caches(db, tenant.id)
        db.commit()

        print("=" * 60)
        print("Demo data seeded successfully")
        print("=" * 60)
        print(f"Tenant ID   : {tenant.id}")
        print(f"Tenant code : {tenant.tenant_code}")
        print(f"Company     : {company.company_code} / {company.company_name}")
        print(f"Branch      : {branch.branch_code} / {branch.branch_name}")
        print(f"Password    : {DEMO_PASSWORD}")
        print(f"Module users: {len(MODULE_DEMO_USERS)}  (email = {{moduleKey}}.user@example.com)")
        print("-" * 60)
        print("Users:")
        for email, user in users.items():
            print(f"  - {user.display_name:<22} {email}")
        print("=" * 60)
        print("Login JSON examples:")
        print(f'  {{"email":"admin@example.com","password":"{DEMO_PASSWORD}"}}')
        print(f'  {{"email":"finance.user@example.com","password":"{DEMO_PASSWORD}"}}')
        print(f'  {{"email":"crm.user@example.com","password":"{DEMO_PASSWORD}"}}')
        print("Permissions for all modules granted to SUPER_ADMIN / TENANT_ADMIN.")
        print("Sign out and sign in again on the website after seeding.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
