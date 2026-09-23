# Asset RPT Feature Package (FP-ASSET-018)

## Summary

Hybrid Asset reporting: live dashboard/runners + saved snapshots on `ast_asset_report`. Operational data is read-only.

## Architecture

Router → AssetReportService → ReportValidator → AssetReportEngine → AssetReportRepository

## APIs

| Method | Path | Permission |
|--------|------|------------|
| GET | `/assets/reports/catalog` | read |
| GET | `/assets/reports/dashboard` | read |
| GET | `/assets/reports/run/{report_key}` | read |
| GET | `/assets/reports/export/{report_key}` | export |
| POST | `/assets/reports/generate` | export |
| GET | `/assets/reports` | read |
| GET/PATCH | `/assets/reports/{id}` | read / export |
| POST | `/assets/reports/{id}/finalize` | export |

## Frontend

`AssetReportsWorkspace` — dashboard, run, export CSV/XLSX, snapshots.

## Migration

`0483_ast_report_governance`
