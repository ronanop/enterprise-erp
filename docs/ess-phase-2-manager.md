# ESS PWA — Phase 2 (Manager workflow + notifications)

## Delivered

### Approvals hub
- **API:** `GET /ess/approvals` — pending items for **direct reports** only (leave submitted, on-duty, comp-off, attendance corrections).
- **Actions:**  
  - `POST /ess/team-leave/{id}/manager-approve` | `reject` (existing)  
  - `POST /ess/team-compoff/{id}/manager-approve` | `reject`  
  - `POST /ess/team-on-duty/{id}/approve` | `reject`  
  - `POST /ess/team-corrections/{id}/approve` | `reject`
- **PWA:** `/approvals` with filters; home card with pending count; `ManagerRouteGuard`.

### RBAC
- `/ess/me` includes `pending_approvals_count` (when `can_approve_team_leave`).

### Notifications (in-app)
- `GET /ess/notifications/unread-count`
- `POST /ess/notifications/read-all`
- `POST /ess/notifications/{id}/read`
- Bell badge on headers (`NotificationBellLink`, 60s poll).

## Testing

Use a manager linked in `seed_manager_team` with direct reports who have submitted requests.

## Not in Phase 2

- Push / FCM popups (Phase 4)
- WFH approvals (Phase 3)
- Company-wide HR inbox (`/hr/ess-inbox`) — remains on HRMS web
