# ESS Phase 4 — Push & foreground notifications

Phase 4 wires HR events to in-app notifications and surfaces them in the employee PWA with polling, foreground toasts, and optional browser popups.

## Backend

### Leave lifecycle notifications

`LeaveRequestService` sends in-app notifications via `notify_employee` (employee only, `notify_manager=False`) for:

| Event | Template code | When |
|--------|----------------|------|
| Manager approved | `hr.leave_manager_approved` | After `manager_approve` |
| HR approved | `hr.leave_approved` | After `approve` |
| Rejected | `hr.leave_rejected` | After `reject` |

Submit and cancel notifications were already present from earlier work.

### Poll API

`GET /api/v1/ess/notifications/poll` returns:

```json
{
  "unread_count": 2,
  "latest": { "id": "...", "title": "...", "body": "...", "kind": "leave", "read": false, "created_at": "..." }
}
```

`latest` is the newest **unread** event (status not `delivered` or `read`).

### Delivery pipeline

1. `NotificationService.send()` creates `NtfEvent` + in-app delivery.
2. Celery task `foundation.send_notification` marks the event `sent` (in-app).
3. Registered `NtfDeviceToken` rows get a parallel `push` delivery.
4. If `FCM_SERVER_KEY` is set, FCM is used for real device tokens; otherwise push is stubbed.
5. If Celery broker is unavailable, in-app delivery runs **synchronously** (fallback on `.delay()` failure).

## Employee PWA

- **`NotificationCenterProvider`** (app shell): registers `web-{uuid}` device token on login, polls `/notifications/poll` every 30s, updates bell badge, shows bottom **toast** for new items.
- **Browser `Notification` API**: optional; user can tap **Enable alerts** on the notifications page.
- **Warm session**: first poll after login does not toast existing unread items.

### Web push vs polling

The PWA stores a stable `web-*` token for future FCM/Web Push. Today, foreground delivery is **poll-driven**. True background push requires FCM (native app or Firebase web messaging + service worker) and `FCM_SERVER_KEY` on the API.

## Operations

| Requirement | Purpose |
|-------------|---------|
| Celery worker | Process `foundation.send_notification` (mark events `sent`) |
| `FCM_SERVER_KEY` (optional) | Real push to Android/iOS/FCM web tokens |
| Postgres migrations through `0469` | Prior ESS phases |

## Smoke test

1. Log in as employee; open home (notification center starts polling).
2. As manager/HR, approve or reject the employee’s leave in HRMS or ESS approvals.
3. Within ~30s (or on next poll), employee sees toast + bell count increase.
4. On notifications page, tap **Enable alerts** and repeat with browser permission granted for OS-level popup.

## Related docs

- [ess-phase-2-manager.md](./ess-phase-2-manager.md) — bell, unread count, mark-read
- [ess-phase-3-attendance.md](./ess-phase-3-attendance.md) — attendance / WFH
