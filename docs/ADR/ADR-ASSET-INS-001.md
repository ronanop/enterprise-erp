# ADR-ASSET-INS-001 — Asset Insurance Management

**Status:** Accepted  
**Date:** 2026-07-30  
**Package:** FP-ASSET-010  
**Depends on:** FP-ASSET-REG-001, Architecture Lock v1.1

---

## Problem

Asset insurance existed as a thin scaffold without validator, lifecycle actions, search/pagination, action permissions, or a dedicated workspace. Productization must stay within Architecture Lock without Finance or Workflow.

## Decisions

| ID | Decision |
|----|----------|
| INS-01 | Scope = insurance policy rows on `ast_asset_insurance`; no warranty |
| INS-02 | No approval workflow / no `AssetGovernanceService` / no Finance |
| INS-03 | Lifecycle: draft → active → renewed → expired → cancelled |
| INS-04 | Close maps to `cancelled` (ERD terminal; not `closed`) |
| INS-05 | Fields = ERD columns only (`coverage_amount`, not premium) |
| INS-06 | Updates draft\|active; active blocks `end_date` change |
| INS-07 | Renew from active only; one open policy per asset |
| INS-08 | Expire from active or renewed; close from expired only |
| INS-09 | Seed activate/renew/expire/close; PATCH `:update` |
| INS-10 | Dedicated `AssetInsuranceWorkspace` |
| INS-11 | Additive migration `0475` only |
| INS-12 | Optimistic claim on lifecycle actions |
| INS-13 | No document_number |
| INS-14 | API `expiry_date` filter maps to `end_date` |
| INS-15 | Claims / premium / attachments out of scope |

## References

- ERD_15 §6.8
- `docs/08_IMPLEMENTATION/Asset_INS_Feature_Package.md`
