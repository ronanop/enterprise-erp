# Asset Registration — Deployment Guide

1. Apply migration **`0465_ast_document_sequence`** (backfills sequences from existing `AST-YYYY-*` codes).
2. Keep **`ASSET_WORKFLOW_GOVERNANCE_ENABLED=false`** until WF-GOV production checklist is complete.
3. Seed notification templates (`AST_WF_*`) optional.
4. Deploy API + web; verify `/assets/assets` registration workspace.
5. Enable governance in staging; run UAT-001 (draft → submit → 3-step approve → active + `master_asset_id`).

## Finance

Registration does **not** post GL. Capitalization remains Finance `fin_asset_transaction` (`acquisition`) per ADR-REG-01.
