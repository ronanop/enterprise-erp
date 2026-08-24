# DBS — Marketing & Social Media

**Schema:** `marketing`  
**Prefix:** `mkt_`  
**Standards:** UUID PK, audit columns, soft delete, `tenant_id` + `company_id` (+ `branch_id` on transactional), Alembic-only

## Tables (v1)

| Table | Type | Notes |
|-------|------|-------|
| `mkt_platform` | Master | Channel catalog (linkedin, instagram, …) |
| `mkt_campaign` | Master | Marketing campaign; optional `crm_campaign_id` |
| `mkt_content_pillar` | Master | Strategic themes |
| `mkt_brand_voice` | Master | Voice profile |
| `mkt_brand_voice_source` | Detail | Training sources |
| `mkt_social_account` | Master | Connected account stub |
| `mkt_content_request` | Transaction | Generation request + job status |
| `mkt_generated_content` | Transaction | Draft body + scores JSON |
| `mkt_generated_content_version` | Detail | Version snapshots |
| `mkt_research_report` | Transaction | Research output |
| `mkt_trend_report` | Transaction | Trend output |
| `mkt_competitor` | Master | Competitor watchlist |
| `mkt_calendar_entry` | Transaction | Scheduled content |
| `mkt_publish_job` | Transaction | Outbound publish queue |

All transactional tables include `tenant_id`, `company_id`, `branch_id` (nullable where master), audit + soft delete + version.
