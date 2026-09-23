# ADR-ASSET-REG-001 — Asset Registration

**Status:** Accepted  
**Package:** FP-ASSET-REG-001  
**Depends on:** FP-ASSET-WF-GOV-001, Architecture Lock v1.1

## Decisions

| ID | Decision |
|----|----------|
| REG-01 | Register activation only; no GL / `fin_asset_transaction` from Asset module |
| REG-02 | Reopen draft after reject (`cancelled` + `workflow_status=rejected`); resubmit creates new WF instance |
| REG-03 | Hybrid procurement: validate PO/GRN when set; optional `GET /registration/prefill` from GRN |
| REG-04 | Company + calendar-year atomic sequence table `ast_document_sequence` (`AST-YYYY-NNNNNN`) |

## References

- `docs/08_IMPLEMENTATION/Asset_REG_Implementation_Report.md`
