"""Sync ERP users from Microsoft Entra ID (Microsoft Graph).

Removes legacy @example.com demo users and provisions tenant users from the
organization directory. Platform admin emails are kept/elevated per env.

Usage (from apps/api):
  .venv\\Scripts\\python.exe -m scripts.sync_entra_organization_users
"""

from __future__ import annotations

import secrets
import sys
from pathlib import Path

import httpx
from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from core.config import settings  # noqa: E402
from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import SecRole, SecTenant, SecUser, SecUserRole  # noqa: E402
from modules.foundation.domain.value_objects import TenantContext  # noqa: E402
from modules.foundation.service.org_context_service import OrgContextService  # noqa: E402
from modules.foundation.service.user_employee_link_service import UserEmployeeLinkService
from modules.foundation.service.user_service import UserService  # noqa: E402

GRAPH_SCOPE = "https://graph.microsoft.com/.default"
GRAPH_USERS_URL = "https://graph.microsoft.com/v1.0/users"


def _sso_placeholder_password() -> str:
    return f"Ms0!{secrets.token_urlsafe(18)}"


def _graph_token() -> str:
    tenant = settings.microsoft_tenant_id.strip() or "common"
    token_url = f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
    data = {
        "client_id": settings.microsoft_client_id,
        "client_secret": settings.microsoft_client_secret,
        "scope": GRAPH_SCOPE,
        "grant_type": "client_credentials",
    }
    with httpx.Client(timeout=30.0) as client:
        response = client.post(token_url, data=data)
    response.raise_for_status()
    payload = response.json()
    token = payload.get("access_token")
    if not isinstance(token, str) or not token:
        raise RuntimeError("Microsoft Graph token response missing access_token")
    return token


def _list_entra_users(token: str) -> list[dict]:
    domain = settings.microsoft_user_email_domain.strip().lower().lstrip("@")
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "$select": "id,displayName,mail,userPrincipalName,accountEnabled",
        "$top": "999",
    }
    rows: list[dict] = []
    url: str | None = GRAPH_USERS_URL
    with httpx.Client(timeout=60.0) as client:
        while url:
            response = client.get(
                url,
                headers=headers,
                params=params if url == GRAPH_USERS_URL else None,
            )
            response.raise_for_status()
            body = response.json()
            for item in body.get("value", []):
                if not item.get("accountEnabled", True):
                    continue
                mail = (item.get("mail") or item.get("userPrincipalName") or "").strip().lower()
                if not mail or "@" not in mail:
                    continue
                if domain and not mail.endswith(f"@{domain}"):
                    continue
                rows.append(
                    {
                        "email": mail,
                        "display_name": str(item.get("displayName") or mail.split("@")[0]),
                        "external_id": str(item.get("id") or ""),
                    }
                )
            url = body.get("@odata.nextLink")
            params = None
    return rows


def _ensure_role(db, tenant_id, role_code: str, role_name: str) -> SecRole:
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
        tenant_id=tenant_id,
        role_code=role_code,
        role_name=role_name,
        is_system_role=True,
        status="active",
    )
    db.add(role)
    db.flush()
    return role


def main() -> None:
    if not settings.microsoft_login_enabled:
        raise SystemExit("Microsoft credentials are not configured in .env")

    entra_users = _list_entra_users(_graph_token())
    if not entra_users:
        print("No Entra users found for domain", settings.microsoft_user_email_domain)
        return

    admin_emails = settings.microsoft_platform_admin_email_set()
    db = SessionLocal()
    try:
        tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
        if not tenant:
            raise SystemExit("BOOTSTRAP tenant not found — run seed_demo_data first")

        super_admin_role = _ensure_role(db, tenant.id, "SUPER_ADMIN", "Super Admin")
        tenant_admin_role = _ensure_role(db, tenant.id, "TENANT_ADMIN", "Tenant Admin")
        service = UserService(db)
        org_context = OrgContextService(db)
        user_employee = UserEmployeeLinkService(db)
        primary_company, primary_branch = org_context.get_tenant_primary_org(tenant.id)
        if primary_company is None:
            print("Warning: no organization company found — run seed_demo_data for DEMOCO")

        synced_emails: set[str] = set()
        created = 0
        updated = 0

        for spec in entra_users:
            email = spec["email"]
            synced_emails.add(email)
            is_admin = email in admin_emails
            user = db.scalar(
                select(SecUser).where(
                    SecUser.tenant_id == tenant.id,
                    SecUser.email == email,
                    SecUser.is_deleted.is_(False),
                )
            )
            if user is None:
                user_row = service.create_user(
                    tenant_id=tenant.id,
                    email=email,
                    password=_sso_placeholder_password(),
                    display_name=spec["display_name"],
                    user_type="super_admin" if is_admin else "employee",
                )
                user = db.scalar(select(SecUser).where(SecUser.id == user_row.id))
                created += 1
            else:
                user.display_name = spec["display_name"]
                user.status = "active"
                if is_admin:
                    user.user_type = "super_admin"
                updated += 1

            assert user is not None
            role = super_admin_role if is_admin else tenant_admin_role
            link = db.scalar(
                select(SecUserRole).where(
                    SecUserRole.user_id == user.id,
                    SecUserRole.role_id == role.id,
                )
            )
            if not link:
                service.assign_role(
                    tenant_id=tenant.id,
                    user_id=user.id,
                    role_id=role.id,
                    assigned_by=None,
                )

            if primary_company is not None:
                org_context.ensure_default_scope(
                    tenant_id=tenant.id,
                    user_id=user.id,
                    company_id=primary_company.id,
                    branch_id=primary_branch.id if primary_branch else None,
                )

            link_ctx = TenantContext(
                tenant_id=tenant.id,
                user_id=user.id,
                user_type=user.user_type,
                company_id=primary_company.id if primary_company else None,
                branch_id=primary_branch.id if primary_branch else None,
            )
            user_employee.ensure_employee_for_user(link_ctx, user)

        removed = 0
        all_users = db.scalars(
            select(SecUser).where(
                SecUser.tenant_id == tenant.id,
                SecUser.is_deleted.is_(False),
            )
        ).all()
        for user in all_users:
            email = user.email.lower()
            if email.endswith("@example.com"):
                service.delete_user(tenant.id, user.id, deleted_by=None)
                removed += 1
                continue
            if email.endswith(f"@{settings.microsoft_user_email_domain.strip().lower().lstrip('@')}"):
                if email not in synced_emails and email not in admin_emails:
                    service.delete_user(tenant.id, user.id, deleted_by=None)
                    removed += 1

        db.commit()
        print(
            f"Entra sync complete: {len(entra_users)} directory users, "
            f"{created} created, {updated} updated, {removed} demo/stale removed."
        )
        print("Platform admins:", ", ".join(sorted(admin_emails)))
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
