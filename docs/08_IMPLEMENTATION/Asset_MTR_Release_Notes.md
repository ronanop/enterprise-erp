# Asset Meter Reading — Release Notes (FP-ASSET-015)

**Release:** FP-ASSET-015  
**Date:** 2026-07-30

## Added

- Productized meter reading with validator, void action, search, filters, pagination.
- `MeterReadingValidator`, `AssetMeterReadingEngine`, `MeterReadingService`.
- `AssetMeterReadingWorkspace` at `/assets/meter-readings`.
- Migration `0480_ast_meter_reading_governance` (search indexes).
- Create concurrency via `lock_create_scope`.

## Changed

- GET list returns `MeterReadingListResult` (paginated object).

## Removed

- PATCH `/meter-readings/{id}` (immutable operational records).

## Unchanged

- No Workflow, Finance, or Governance integration.
- Maintenance plan `frequency_meter_units` remains stored-only (MPL-14).
