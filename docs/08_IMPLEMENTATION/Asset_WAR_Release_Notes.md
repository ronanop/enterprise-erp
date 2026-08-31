# FP-ASSET-009 — Release Notes

## Asset Warranty Management

Productizes warranty coverage for registered assets.

### Highlights

- Draft → Activate → Extend → Expire lifecycle
- Search / pagination / filters
- Dedicated workspace at `/assets/asset-warranties`
- RBAC actions: activate, extend, expire
- Optimistic locking on lifecycle actions
- One open warranty per asset (active or extended)
- **Coverage duration changes require Extend** — PATCH cannot change `end_date` on an active warranty (lifecycle preserved)

### Not included

- Approval workflow
- Finance posting
- Document numbering (not in ERD)
- Insurance productization
