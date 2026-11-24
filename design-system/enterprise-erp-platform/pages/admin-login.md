# Admin Login / Admin Panel — Page Override

> Overrides `MASTER.md` for **domain content only**. Shell, fonts, and primary palette stay global.

**Routes:** `/admin-login` (public), `/admin` (authenticated, ERP admins only)

## Purpose

Separate entry for platform / tenant admins (`super_admin`, `tenant_admin`) into a configuration hub, distinct from employee `/login`.

## Section order

### `/admin-login`

1. AuthCardShell — title “Admin sign-in”
2. Email + password (MFA when required)
3. Footer link to employee `/login`

### `/admin`

1. PageHeader — “Admin panel”
2. Link grid — Foundation, Organization, Users, Master Data, Platform dashboard

## Access

- Non-admins who authenticate via `/admin-login` are signed out with an error.
- Unauthenticated visits to `/admin*` redirect to `/admin-login`.
- Sidebar “Admin panel” item is ERP-admin-only via `canAccessHref`.

## Do not

- Reuse purple/pink gradients or dark-mode-by-default
- Expose raw `/api/v1` paths as product copy
- Put module ops navigation in the admin login card
