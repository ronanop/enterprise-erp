# FP-ASSET-010 — Release Notes

## Asset Insurance Management

Productizes insurance policies for registered assets.

### Highlights

- Draft → Activate → Renew → Expire → Close (cancelled) lifecycle
- Search / pagination / filters
- Dedicated workspace at `/assets/asset-insurances`
- RBAC actions: activate, renew, expire, close
- Optimistic locking on lifecycle actions
- One open policy per asset (active or renewed)
- Coverage duration changes require Renew — PATCH cannot lengthen an active policy

### Not included

- Approval workflow
- Finance posting
- Document numbering (not in ERD)
- Premium tracking
- Claims module
- Attachments
