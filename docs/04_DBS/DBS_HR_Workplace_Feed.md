# DBS — HR Workplace Feed (ESS company social)

**Schema:** `hr`  
**Prefix:** `hr_workplace_feed_`  
**Standards:** UUID PK, audit columns, soft delete, `tenant_id` + `company_id` + `branch_id`, Alembic-only  
**Media:** MinIO via `object_storage` — keys under `hr/social-feed/{company_id}/{post_id}/…`; DB stores `storage_uri` (`s3://…`). No local-disk fallback.

## Tables

| Table | Type | Notes |
|-------|------|-------|
| `hr_workplace_feed_post` | Transaction | Author employee, caption, cover image (`storage_uri` = first photo), denormalized `like_count` / `comment_count` |
| `hr_workplace_feed_media` | Transaction | Up to **5** photos per post (`sort_order` 0–4); unique `(post_id, sort_order)` |
| `hr_workplace_feed_like` | Transaction | One row per `(post_id, employee_id)`; soft-delete toggles unlike |
| `hr_workplace_feed_comment` | Transaction | Comment body on a post |

## Visibility

Company-scoped ESS timeline: list/filter by `tenant_id` + author’s `company_id` (+ soft delete). Internal employees only — not Marketing `mkt_*` outbound social.

## API surface

Employee routes under `/api/v1/ess/feed/*` (auth via `get_ess_tenant_context`).
