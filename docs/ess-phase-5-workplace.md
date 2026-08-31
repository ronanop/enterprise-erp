# ESS Phase 5 — Workplace services

Phase 5 adds meeting room booking, asset QR lookup, asset-linked helpdesk tickets, and employee IT/grievance tickets in the PWA.

## Meeting rooms

Built on HR **`hr_training_room`** and **`hr_training_request`** (meeting type).

| Endpoint | Description |
|----------|-------------|
| `GET /ess/meeting-rooms` | Active rooms for the employee’s company/branch |
| `GET /ess/meeting-rooms/availability?on_date=YYYY-MM-DD` | Per-room busy/free + booking slots |
| `GET /ess/meeting-rooms/bookings?on_date=` | Optional date filter |
| `POST /ess/meeting-rooms/bookings` | Book room (auto-**approved** for ESS; conflict check on time overlap) |

**HR setup:**
```bash
python -m scripts.seed_training_rooms
python -m scripts.seed_meeting_bookings   # optional demo bookings
```
(or HRMS **Training rooms**).

**PWA:** `/rooms`, `/rooms/book`

## Assets (QR + tickets)

| Endpoint | Description |
|----------|-------------|
| `GET /ess/assets/{id}` | Asset detail (assigned/custodian) |
| `GET /ess/assets/lookup?code=` | Resolve `qr_code`, `asset_code`, or `barcode` (company-scoped) |
| `POST /ess/assets/{id}/tickets` | Helpdesk ticket linked to `asset_id` |

**PWA:** `/assets/scan` (BarcodeDetector + manual code), report issue wired to API.

## Helpdesk (ESS wrapper)

Uses **`helpdesk.hd_ticket`** with auto-created categories `ESS_IT`, `ESS_GRIEVANCE`, `ESS_ASSET` and priority `ESS_MEDIUM` on first use.

| Endpoint | Description |
|----------|-------------|
| `GET /ess/support-tickets` | Tickets where requester = current employee |
| `POST /ess/support-tickets` | `kind`: `it` \| `grievance` \| `asset` |
| `GET /ess/support-tickets/{id}` | Detail (own tickets only) |
| `GET/POST .../comments` | List / add public comments |

Agents continue to work tickets in HRMS **Helpdesk** (`/helpdesk/tickets`).

**PWA:** `/support`, `/support/new`, `/support/[id]`

## Smoke test

1. Seed training rooms; open **Meeting rooms** → pick date → see busy/free → book a slot.
2. Set `qr_code` on an asset in HR; **Scan QR** or enter code → detail → **Report issue** → ticket appears under **Help & tickets**.
3. Create **Grievance** and **IT** tickets; add a comment on the detail screen.

## Next

Phase 6 — policy walkthroughs, RBAC admin polish, password hardening (`docs` roadmap).
