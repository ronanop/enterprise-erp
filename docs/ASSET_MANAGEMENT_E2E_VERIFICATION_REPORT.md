# Asset Management E2E Verification Report

**Generated:** 2026-08-09 18:55 UTC  
**Mode:** Read/test only — no application code or schema changes  
**Harness:** Live API + Postgres (`psql`) + UI HTTP route smoke (no Playwright)  

## Summary (top)

| Area | Result |
|------|--------|
| Registration | **PASS** |
| Assignment | **PASS** |
| Components | **PASS** |
| Return | **PASS** |
| Location | **PASS*** |
| Delivery Challan | **PASS** |
| Retirement | **PASS** |
| Disposal | **PASS*** (post BLOCKED: finance period) |
| Reinstate | **PASS** |
| Maintenance | **PASS** |
| Transfer | **FAIL** (create 500) |
| Excel | **PASS** (API import) |
| Permissions | **PASS** |
| Concurrency | **PASS** |
| Audit | **PASS** |
| DB Integrity | **PASS** |
| Inventory | **PASS** |

## Environment

| Layer | Value |
|-------|-------|
| Frontend | `http://localhost:3000` (HTTP 200) |
| Backend | `http://localhost:8000` (health 200) |
| Database | Postgres `localhost:5433` / `erp` (ok=1) |
| Test date | 2026-08-09 |
| Branch/commit | `asset_phase1` / `91dfebc` |
| Auth | `admin@example.com` + `assets.user@example.com` (`Secure1!`) |
| Open finance periods | `[{"id": "ee605674-c4f0-4356-83ec-abccc9210525", "start": "2025-04-01", "end": "2025-04-30", "status": "open"}]` |
| Incoming queue | total=0 |

## Overall Result

| Status | Count |
|--------|------:|
| PASS | 97 |
| FAIL | 1 |
| BLOCKED | 4 |
| NOT_TESTED | 0 |
| TOTAL | 102 |

**Final Production Readiness:** 🟡 **READY WITH KNOWN ISSUES**

Core register→assign→component→return→retire→start-disposal→reinstate custody loop **PASSED** on live API/DB. Remaining: Transfer create HTTP 500 (code defect); Disposal POST cannot reach DISPOSED (finance open period Apr-2025 only); Incoming/QC queue empty.

## Workflow Results

| Workflow | PASS/FAIL/BLOCKED | Evidence | Issue |
|----------|-------------------|----------|-------|
| Assignment | PASS (P5/F0/B0) | employee+master approve |  |
| Audit | PASS (P3/F0/B0) | return JSON-safe UUID |  |
| Components | PASS (P7/F0/B0) | types + ISSUED timestamps |  |
| Concurrency | PASS (P3/F0/B0) | double approve/return/start-disposal |  |
| DB Integrity | PASS (P5/F0/B0) | no multi-current / stale ISSUED |  |
| Delivery Challan | PASS (P4/F0/B0) | pending/issued/received + signature |  |
| Disposal | PASS* (P7/F0/B1) | create/submit/approve OK; post blocked | ENV-FIN-PERIOD |
| Environment | PASS (P5/F0/B0) | health+auth |  |
| Excel | PASS (P1/F0/B0) | import 1 row make+location |  |
| Incoming | BLOCKED (P0/F0/B1) | empty queue | empty queue |
| Inventory | PASS (P14/F0/B0) | search/filters/pagination |  |
| Location | PASS* (P6/F0/B2) | draft/submitted/active/cancel gates |  |
| Maintenance | PASS (P3/F0/B0) | ASSIGNED block / READY allow |  |
| Permissions | PASS (P3/F0/B0) | 401 unauth; assets.user read |  |
| Registration | PASS (P8/F0/B0) | draft+location→active READY+master |  |
| Reinstate | PASS (P3/F0/B0) | PENDING→READY |  |
| Retirement | PASS (P2/F0/B0) | OUTDATED→RETIRED gates |  |
| Return | PASS (P9/F0/B0) | GOOD/OUTDATED/DEAD + outcomes |  |
| Transfer | FAIL (P2/F1/B0) | create TypeError asset_id kw | BUG-TRF-CREATE-01 |
| UI | PASS (P7/F0/B0) | module routes 200 |  |

## Detailed Test Cases

| ID | Scenario | Expected | Actual | Result |
|----|----------|----------|--------|--------|
| ENV-01 | API/Web/DB health | 200/200/1 | {'branch': 'asset_phase1', 'commit': '91dfebc', 'date': '2026-08-09', 'api': 200, 'web': 200, 'db': '1'} | PASS |
| UI-01 | UI route /assets | 200 | 200 | PASS |
| UI-02 | UI route /assets/assets | 200 | 200 | PASS |
| UI-03 | UI route /assets/assets/new | 200 | 200 | PASS |
| UI-04 | UI route /assets/asset-assignments | 200 | 200 | PASS |
| UI-05 | UI route /assets/asset-locations | 200 | 200 | PASS |
| UI-06 | UI route /assets/asset-disposals | 200 | 200 | PASS |
| UI-07 | UI route /login | 200 | 200 | PASS |
| ENV-02 | Admin login | token | ok | PASS |
| ENV-03 | assets.user login | token | ok | PASS |
| ENV-04 | Finance open periods | >=1 open period | [{"id": "ee605674-c4f0-4356-83ec-abccc9210525", "start": "2025-04-01", "end": "2025-04-30", "status": "open"}] | PASS |
| ENV-05 | Incoming queue populated | >0 incoming | total=0 http=200 | BLOCKED |
| ENV-06 | Bootstrap masters |  | cat/branch/emp ok | PASS |
| REG-01 | Create asset with make/model/config/location | draft + attrs + location label | http=200 status=draft make=Dell loc=Bldg A · Floor 1 · Room 4e76118a msg=Created | PASS |
| REG-02 | ast_asset_location current row after create | 1 current location | count=1 | PASS |
| REG-03 | Create without location/optional attrs | draft, no location required | http=200 Created | PASS |
| REG-04 | No location row when location_label omitted | 0 | 0 | PASS |
| REG-05 | Duplicate serial rejected | 4xx conflict | http=409 Serial number 'E2E-4e76118a' is already registered | PASS |
| REG-06 | Missing required fields rejected | 422 | http=422 | PASS |
| REG-07 | Submit+Approve → active READY_TO_MOVE + master + location retained | active/READY_TO_MOVE/master/loc=1/asn=0 | http=200 life=active ops=READY_TO_MOVE master=t loc=1 asn=0 msg=approve | PASS |
| REG-08 | Registration creates no assignment | 0 assignments | 0 | PASS |
| REG-09 | Cancelled asset cannot get location | 422 | http=422 Cancelled assets cannot have location records | PASS |
| INV-01 | Search asset code | 200 + server filter | http=200 total=1 found=True | PASS |
| INV-02 | Search name | 200 + server filter | http=200 total=1 found=True | PASS |
| INV-03 | Search serial | 200 + server filter | http=200 total=1 found=True | PASS |
| INV-04 | Search make | 200 + server filter | http=200 total=51 found=True | PASS |
| INV-05 | Filter by branch |  | http=200 total=77 | PASS |
| INV-06 | Filter operational_status READY_TO_MOVE |  | http=200 total=46 | PASS |
| INV-07 | Filter lifecycle active |  | http=200 total=61 | PASS |
| INV-08 | Filter asset_type |  | http=200 total=77 | PASS |
| INV-09 | Pagination page 1 vs 2 |  | p1=200 n=25 p2=200 n=1 | PASS |
| INV-10 | Empty search results | total=0 | http=200 total=0 | PASS |
| INV-11 | Location-oriented search (q) |  | http=200 total=0 | PASS |
| INV-12 | Export prerequisites (assets+assignments list APIs) |  | assets_ok assignments=200 | PASS |
| CMP-01 | Create CHARGER component |  | http=200 id=bc039d43-14f3-45e3-8bdd-bdee481a6a82 type=CHARGER Created | PASS |
| CMP-TYPE-MOUSE | Create MOUSE component |  | http=200 Created | PASS |
| CMP-TYPE-KEYBOARD | Create KEYBOARD component |  | http=200 Created | PASS |
| CMP-TYPE-CABLE | Create CABLE component |  | http=200 Created | PASS |
| CMP-TYPE-PENDRIVE | Create PENDRIVE component |  | http=200 Created | PASS |
| ASN-01 | Create employee assignment with component_ids |  | http=200 asn=739b9151-3d3a-4833-8209-2e721b5565ee Created | PASS |
| DC-01 | DC number/status/signature on create |  | {"num": "DC-d1fce8", "status": "issued", "sig": "signed"} | PASS |
| ASN-02 | Submit+Approve employee assignment (master-linked) |  | http=200 status=active approve | PASS |
| ASN-03 | Asset ASSIGNED + custodian set | ASSIGNED + custodian | ops=ASSIGNED custodian=t | PASS |
| ASN-04 | Assignment stores employee_id |  | employee_id=e0982ea7-11c4-4840-921b-a63f624c11b6 allocated_at=2026-08-09T18:35:56.377983Z | PASS |
| RET-01 | Return GOOD with RETURNED component |  | http=200 ops=READY_TO_MOVE asn=returned comp=RETURNED return | PASS |
| RET-02 | Custodian cleared on return |  | custodian_null=t | PASS |
| AUD-01 | Return audit JSON-safe component_id |  | safe=True snippet={"return_remarks": "e2e good", "return_condition": "good", "component_returns": [{"component_id": "bc0 | PASS |
| ASN-NEG-01 | Assign non-READY asset blocked at create |  | http=422 Only active or in_maintenance assets can be assigned | PASS |
| CMP-NEG-01 | Duplicate issue of already-issued component blocked |  | http=422 Asset is already assigned. | PASS |
| RET-OUT-RETURNED | Component outcome RETURNED on GOOD return |  | http=200 comp=RETURNED ops=READY_TO_MOVE return | PASS |
| RET-OUT-MISSING | Component outcome MISSING on GOOD return |  | http=200 comp=MISSING ops=READY_TO_MOVE return | PASS |
| RET-OUT-DAMAGED | Component outcome DAMAGED on GOOD return |  | http=200 comp=DAMAGED ops=READY_TO_MOVE return | PASS |
| RET-OUT-RETAINED | Component outcome RETAINED on GOOD return |  | http=200 comp=RETAINED ops=READY_TO_MOVE return | PASS |
| RET-COND-OUTDATED | Return condition outdated → RETIRED |  | http=200 ops=RETIRED return | PASS |
| RET-COND-DEAD | Return condition dead → PENDING_DISPOSAL |  | http=200 ops=PENDING_DISPOSAL return | PASS |
| RET-NEG-01 | Return with issued comps but no component_returns rejected |  | http=422 component_returns is required when the assignment has issued components | PASS |
| LOC-DRAFT | Location create on draft asset | allow | http=200 Created | PASS |
| LOC-SUBMITTED | Location create on submitted asset | allow | http=200 Created | PASS |
| LOC-ACTIVE | Location create on active asset | allow | http=200 Created | PASS |
| LOC-CANCELLED | Location create on cancelled asset | 422 | http=422 Cancelled assets cannot have location records | PASS |
| LOC-SUPERSEDE | New location supersedes prior current |  | current=1 historical=1 | PASS |
| DC-PENDING-not_signed | Assignment DC status=pending sig=not_signed |  | http=200 Created | PASS |
| DC-ISSUED-signed | Assignment DC status=issued sig=signed |  | http=200 Created | PASS |
| DC-RECEIVED-signed | Assignment DC status=received sig=signed |  | http=200 Created | PASS |
| RETIRE-01 | OUTDATED return → RETIRED |  | ops=RETIRED | PASS |
| RETIRE-02 | RETIRED cannot be assigned |  | Retired assets cannot be assigned. | PASS |
| MNT-RETIRED | RETIRED maintenance create blocked/rejected |  | http=422 Retired, pending disposal, or disposed assets cannot enter maintenance. | PASS |
| XFR-RETIRED | RETIRED transfer create blocked/rejected |  | http=422 Retired, pending disposal, or disposed assets cannot be transferred. | PASS |
| DSP-01 | Start Disposal → PENDING_DISPOSAL |  | http=200 ops=PENDING_DISPOSAL start_disposal | PASS |
| REIN-00 | DEAD return → PENDING_DISPOSAL |  | ops=PENDING_DISPOSAL | PASS |
| REIN-01 | Reinstate PENDING → READY_TO_MOVE |  | http=200 ops=READY_TO_MOVE life=active reinstate | PASS |
| REIN-NEG-01 | Reinstate when already READY rejected |  | http=422 Asset is already ready to move and cannot be reinstated. | PASS |
| MNT-ASSIGNED | ASSIGNED blocks maintenance |  | http=422 Asset is currently assigned. Return the asset before starting maintenance. | PASS |
| XFR-ASSIGNED | ASSIGNED blocks transfer |  | http=422 Asset is currently assigned. Return the asset before transferring it. | PASS |
| MNT-READY | READY_TO_MOVE allows maintenance create |  | http=200 Created | PASS |
| SEC-01 | Unauthenticated asset list rejected |  | http=401 | PASS |
| SEC-02 | assets.user can read assets |  | http=200 | PASS |
| SEC-03 | assets.user approve without permission rejected or not-found |  | http=404 Asset not found | PASS |
| CONC-01 | Concurrent double approve assignment |  | codes=[200, 422] active_count=1 | PASS |
| CONC-02 | Duplicate return rejected |  | first=200 second=422 Only active assignments can be returned | PASS |
| AUD-02 | Asset has audit rows after lifecycle |  | count=5 | PASS |
| DBI-01 | No asset with multiple current locations |  | violations=0 | PASS |
| DBI-02 | No active assignment with returned_at set |  | count=0 | PASS |
| DBI-03 | No ISSUED custody on returned assignments |  | count=0 | PASS |
| DBI-04 | No DISPOSED asset with active assignment |  | count=0 | PASS |
| DBI-05 | ASSIGNED ops implies active assignment |  | orphans=0 | PASS |
| CMP-02 | Assignment component ISSUED with timestamps |  | ISSUED/true/true/true | PASS |
| DSP-02 | Create disposal request |  | http=200 Created | PASS |
| DSP-02S | Submit disposal |  | http=200 submit | PASS |
| DSP-03R | Approve does not dispose |  | ops=PENDING_DISPOSAL life=active http=200 | PASS |
| DSP-04R | Post → DISPOSED |  | http=404 ops=PENDING_DISPOSAL No open period for journal date | BLOCKED |
| DSP-NEG-READY | Disposal create on READY blocked |  | http=422 Asset must be in PENDING_DISPOSAL status before creating a disposal request. Return the asset with condition 'D | PASS |
| DSP-NEG-ASSIGNED | Disposal create on ASSIGNED blocked |  | http=422 Asset must be in PENDING_DISPOSAL status before creating a disposal request. Return the asset with condition 'D | PASS |
| INV-EMP | Custodian set for FE employee_code mapping |  | custodian=e0982ea7-11c4-4840-921b-a63f624c11b6 | PASS |
| AUD-03 | Asset audit operations present |  | OperationalStatusChanged,approve,create | PASS |
| LOC-DISPOSED | Location on disposed |  | no asset in status | BLOCKED |
| LOC-WRITTEN_OFF | Location on written_off |  | no asset in status | BLOCKED |
| DSP-NEG-DUP | Duplicate Start Disposal rejected |  | http=422 Asset is already pending disposal. | PASS |
| CONC-03 | Concurrent Start Disposal |  | codes=[200, 422] ops=PENDING_DISPOSAL | PASS |
| INV-EMP-Q | Inventory search endpoint accepts q |  | http=200 total=0 | PASS |
| XLS-01 | Excel import POST /assets/assets/import with operational_status | imported row | {'success': True, 'message': 'Import completed', 'data': {'total_rows': 1, 'imported': 1, 'skipped': 0, 'duplicates': 0, | PASS |
| XFR-READY | Transfer create when READY | 200 draft transfer | http=500 TypeError: create() got multiple values for keyword argument 'asset_id'; same_branch_only=True | FAIL |

## Critical Production Bugs

### BUG-TRF-CREATE-01 — HIGH

- **Workflow:** Transfer create (`POST /assets/asset-transfers`)
- **Reproduction:** READY asset → create transfer with `to_branch_id` + `to_location_label` (seed has a single branch; same-branch location move attempted)
- **Expected:** HTTP 200 draft transfer
- **Actual:** HTTP **500** `TypeError: AssetTransferRepository.create() got multiple values for keyword argument 'asset_id'`
- **API status:** 500
- **Root cause:** `TransferService.create` passes `asset_id=asset.id` and also `**fields` containing `asset_id` (`apps/api/src/modules/asset/service/transfer_service.py` ~107–119)
- **DB state:** no transfer row (request failed before commit)
- **Production impact:** Transfer workspace cannot create transfers

### ENV-FIN-PERIOD / DSP-POST — HIGH (environment)

- **Workflow:** Disposal post → DISPOSED
- **Reproduction:** PENDING_DISPOSAL → disposal create/submit/approve → `POST .../post`
- **Expected:** ops `DISPOSED` + finance journal
- **Actual:** HTTP **404** `No open period for journal date`; ops stayed `PENDING_DISPOSAL`
- **Evidence:** Only open period `2025-04-01`–`2025-04-30`
- **Production impact:** Cannot complete terminal disposal in this environment

## Edge Case Results

| Area | Result | Notes |
|------|--------|-------|
| Duplicate serial | PASS | rejected |
| Missing required create fields | PASS | 422 |
| Cancelled asset location | PASS | 422 |
| Disposed/written_off location | BLOCKED | no terminal assets (post never succeeded) |
| Non-READY assign | PASS | blocked |
| Duplicate component issue | PASS | blocked |
| Return without component_returns | PASS | 422 |
| RETIRED assign/maint/transfer | PASS | blocked |
| Disposal on READY/ASSIGNED | PASS | blocked |
| Duplicate Start Disposal | PASS | blocked |
| Reinstate when READY | PASS | 422 |
| Component outcomes matrix | PASS | RETURNED/MISSING/DAMAGED/RETAINED |
| Return GOOD/OUTDATED/DEAD | PASS | READY/RETIRED/PENDING |

## Security / Permission Results

| ID | Result | Notes |
|----|--------|-------|
| SEC-01 | PASS | unauthenticated list denied |
| SEC-02 | PASS | assets.user can read |
| SEC-03 | PASS | assets.user approve denied/not-found |
| UI routes | PASS | `/assets*` HTTP 200 smoke |

## Concurrency Results

| ID | Result | Notes |
|----|--------|-------|
| CONC-01 | PASS | concurrent assignment approve → one active |
| CONC-02 | PASS | duplicate return rejected |
| CONC-03 | PASS | concurrent Start Disposal → PENDING |

## Database Integrity Results

| Check | Result |
|-------|--------|
| Multiple current locations | PASS (0) |
| Active assignment with returned_at | PASS |
| ISSUED custody on returned assignment | PASS |
| DISPOSED + active assignment | PASS |
| ASSIGNED ops without active assignment | PASS |

## Audit Verification

| Check | Result |
|-------|--------|
| Return audit `component_id` JSON-safe string | PASS |
| Asset lifecycle audit rows present | PASS |
| No UUID JSON 500 on return/assign paths tested | PASS |

## Regression Results (prior session fixes re-verified)

| Prior bug | Live retest |
|-----------|-------------|
| BUG-ASN-EMP-01 employee+master assign approve | **PASS** |
| Component issue timestamps / false already-issued | **PASS** |
| Return `component_returns` UUID audit 500 | **PASS** |
| BUG-REG-LOC-01 draft `location_label` | **PASS** |

## Known Limitations

- No Playwright/Cypress: UI verified via route HTTP smoke + production APIs the UI calls.
- Inventory export is client-side over list APIs; list prerequisites PASS; browser download not automated.
- Incoming→QC→Register **BLOCKED** (queue empty).
- Single seed branch: cross-branch transfer not exercised; same-branch create still 500 (code bug).
- Finance open period only Apr 2025 → disposal post BLOCKED.

## Final Production Readiness

### 🟡 READY WITH KNOWN ISSUES

**Core IT custody is usable:** register with location, employee assign with components, return matrix, retire, start disposal, reinstate.

**Not full-module READY** until:
1. Transfer create `asset_id` double-kwarg 500 is fixed and retested
2. Disposal post reaches `DISPOSED` with a valid open finance period
3. Incoming/QC path exercised when GRN data exists

## Recommended Fix Order

1. **BUG-TRF-CREATE-01** — remove duplicate `asset_id` kwarg in `TransferService.create`
2. **Disposal post / finance period** — align `journal_date` with open periods or seed a current open period
3. **Incoming/QC seed data** — enable receiving track E2E
4. Optional: Playwright for Add Asset / Issue / Return wizards

