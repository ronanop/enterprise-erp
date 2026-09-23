# ADR-ASSET-NTF-001 — Asset Notification Metadata Registry

**Status:** Accepted  
**Date:** 2026-07-30  
**Package:** FP-ASSET-017  
**Depends on:** FP-ASSET-REG-001, Architecture Lock v1.1, Foundation Notification

---

## Problem

Asset notifications existed as a thin CRUD scaffold bound to `asset.asset:*`, without validator, delivery lifecycle, search/pagination, dedicated RBAC, or a workspace. Productization must register asset-domain alert **metadata** without becoming a second delivery engine.

## Decisions

| ID | Decision |
|----|----------|
| NTF-01 | Scope = `ast_asset_notification` only; ERD §6.19 columns |
| NTF-02 | Foundation Notification owns all delivery (email/SMS/WhatsApp/push/queue/retry/templates) |
| NTF-03 | Asset module stores metadata only; no SMTP/Celery/template/rendering |
| NTF-04 | Types: `maintenance_due`, `warranty_expiry`, `insurance_expiry`, `audit_due`, `depreciation`, `other` |
| NTF-05 | `other` requires `payload_json.event_subtype` ∈ assignment, disposal, custom, maintenance_completed, asset_returned |
| NTF-06 | Lifecycle status: `active` → `archived` |
| NTF-07 | Delivery: `pending` → `sent` → `read`; `pending` → `failed`; `failed` → `sent` allowed |
| NTF-08 | After `sent`/`read`, immutable: asset_id, type, recipients, payload, company_id |
| NTF-09 | Explicit POST actions: archive, mark-read, mark-sent, mark-failed |
| NTF-10 | RBAC: `asset.notification:read\|create\|update` (replace `asset.asset:*`) |
| NTF-11 | Rename service to `AssetNotificationService` (alias `NotificationService`) |
| NTF-12 | Migration `0482` indexes + permission seeds |
| NTF-13 | Dedicated `AssetNotificationWorkspace` — no composer/preview/template editor |
| NTF-14 | Disposed/written-off assets blocked except `other` + `disposal` subtype |
| NTF-15 | Payload max 32 KB, depth ≤ 4; reject secret-like keys |
| NTF-16 | Dispatch to Foundation is optional/deferred — Phase 1 is metadata + delivery status recording |

## Foundation boundary

```text
Asset producers → AssetNotificationService → ast_asset_notification
                      │
                      └── (optional future) Foundation NotificationService.send()
```

## References

- ERD_15 §6.19, §11, §13
- FRD-12 §16
- `docs/08_IMPLEMENTATION/Asset_NTF_Feature_Package.md`
