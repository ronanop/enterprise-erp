# FP-ASSET-008 — Release Notes

## Summary

Productizes physical Asset Audit with validator gates, start/complete/cancel, search/pagination, `:update` permission, and `AssetAuditWorkspace`.

## Breaking changes

- Create requires `asset_id`, `auditor_employee_id`
- List returns `AssetAuditListResult`
- PATCH requires `asset.audit:update`
- Start requires `audit_date`; complete requires `found_status`

## Known limitations

- No approval workflow (by ERD design)
- No Finance posting
- Checklist linkage not productized
- Reminder Celery task remains count-only
- Auditor entered as employee UUID in workspace
