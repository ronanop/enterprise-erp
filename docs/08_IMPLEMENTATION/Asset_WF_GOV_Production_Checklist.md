# Asset Workflow Governance — Production Deployment Checklist

**Feature:** FP-ASSET-WF-GOV-001  
**Date:** 2026-07-29

---

## Pre-deployment

- [ ] ADR-ASSET-WF-GOV-001 reviewed and accepted  
- [ ] API Change Log communicated to API consumers  
- [ ] Alembic head includes `0266_seed_asset_workflows` on target DB  
- [ ] Confirm `wf_definition` rows exist per tenant for all five `AST_*` codes  
- [ ] Confirm ASSET_* roles / permissions from `0265` are active  
- [ ] Notification templates seeded **or** silent-skip accepted in writing  
- [ ] Celery worker healthy if templates will send  
- [ ] `ASSET_WORKFLOW_GOVERNANCE_ENABLED` planned value documented (recommend start `false`)  
- [ ] Client/UI multi-step approve or inbox plan agreed  
- [ ] Integration tests INT-WF-01/02/06 green in CI  

---

## Deployment

- [ ] Deploy API build containing governance services  
- [ ] Env: `ASSET_WORKFLOW_GOVERNANCE_ENABLED=false` (initial)  
- [ ] Verify application starts; `/health` OK  
- [ ] Verify OpenAPI shows reject routes  
- [ ] (Optional canary) Enable flag for one tenant/company only via process control  

---

## Smoke Tests (flag on, non-prod first)

- [ ] Create draft asset → submit → `workflow_instance_id` set  
- [ ] Approve as non-creator → intermediate step leaves `status=submitted`  
- [ ] Final approve → `status=active` and `master_asset_id` set  
- [ ] Creator approve → SoD error  
- [ ] Reject submitted asset → `cancelled` / `workflow_status=rejected`  
- [ ] Assignment/maintenance/disposal/revaluation submit+approve smoke (one each)  
- [ ] With flag off → legacy single-step approve still works  

---

## Rollback

- [ ] Set `ASSET_WORKFLOW_GOVERNANCE_ENABLED=false`  
- [ ] Redeploy or hot-reload settings as applicable  
- [ ] Confirm legacy approve path  
- [ ] Triage in-flight WF instances (complete or cancel via Foundation)  
- [ ] Notify stakeholders of rollback  

---

## Monitoring

- [ ] Error rate on `/assets/*/approve` and `/reject`  
- [ ] Count of `Workflow definition not found` (missing seeds)  
- [ ] Notification send / Celery failure rate  
- [ ] Documents stuck in `submitted` longer than SLA  
- [ ] Audit log volume for entity submit/approve/reject  

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Backend Lead | | |
| QA Lead | | |
| DevOps | | |
| EARB | | |
