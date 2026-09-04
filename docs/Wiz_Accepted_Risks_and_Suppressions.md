# Wiz Accepted Risks & Suppressions

**Product:** Enterprise ERP Platform  
**Owner:** Platform / Security (connect)  
**Last updated:** 2026-09-04  
**Applies to:** Wiz SAST + dependency (SCA) findings that recur after remediation

Use this document when closing or suppressing findings in Wiz. Each row is an **accepted risk** or **false positive with mitigation already in place**. Do not suppress Critical/High production issues that are still unfixed.

---

## How to use in Wiz

1. Match finding by **rule name** (SAST) or **package + CVE** (SCA).
2. Set status to **Rejected / Risk Accepted / False Positive** as appropriate.
3. Paste the **Wiz note** from the matching row (short form below).
4. Re-review on the next major release or when the package/path changes.

Suggested Wiz resolution reasons:

| Category | Wiz reason |
|---|---|
| Intentional public endpoint | Risk Accepted |
| Scanner cannot see mitigation | False Positive |
| Vendor / protocol constraint | Risk Accepted |
| Dev-only tooling (not deployed) | Out of Scope / Risk Accepted |
| No upstream patch; fork applied | Risk Accepted |

---

## A. Recurring SAST — accept / suppress

### A1. Path Traversal (Node.js / TypeScript)

| Field | Value |
|---|---|
| **Rule names** | `Path Traversal Vulnerability in Node.js`; `Improper Limitation of Pathname to Restricted Directory (Path Traversal)` |
| **Typical paths** | `.cursor/skills/**`, `.cursor/skills/shared/safe-fs.cjs`, `apps/employee-app/scripts/generate-icons.mjs` |
| **Decision** | **False Positive** (mitigated) for production scripts; **Out of Scope** for `.cursor/skills/**` |
| **Rationale** | Paths are constrained with `resolveWithinRoot` / `assertWithinRoot` / `readFileWithinRoot` (see `safe-fs.cjs`). Wiz still flags `path.join` + `fs.*` even after containment. Cursor skill scripts are **not** deployed to production containers. |
| **Wiz note** | `Accepted FP: path contained via resolveWithinRoot/assertWithinRoot. .cursor/skills is local Cursor tooling, not shipped in ERP runtime images. See docs/Wiz_Accepted_Risks_and_Suppressions.md §A1.` |

### A2. CSV Injection

| Field | Value |
|---|---|
| **Rule name** | `CSV Injection Due to Unsafe CSV Generation` |
| **Paths** | `apps/api/src/modules/payroll/domain/bank_export_builder.py`; `apps/api/src/modules/hr/service/report_service.py` |
| **Decision** | **False Positive** (mitigated) |
| **Rationale** | Cells are neutralized for formula prefixes (`=`, `+`, `-`, `@`, tab/CR) via `_csv_cell` / `_csv_escape_field` before write. Scanner matches “CSV generation” pattern, not absence of sanitization. |
| **Wiz note** | `Accepted FP: CSV formula injection neutralized (_csv_cell / _csv_escape_field) before export. docs/Wiz_Accepted_Risks_and_Suppressions.md §A2.` |

### A3. Insecure React Anchor / href variable

| Field | Value |
|---|---|
| **Rule name** | `Insecure Use of Variable in React Anchor Tag` |
| **Paths** | `apps/web/src/components/finance/ap/ap-invoice-table.tsx`; `.../ar/ar-invoice-table.tsx` |
| **Decision** | **False Positive** (mitigated) |
| **Rationale** | Hrefs go through `safeAppHref` / `safeEntityHref` (`apps/web/src/lib/html.ts`): same-origin only, blocks `javascript:`, protocol-relative, and non-UUID entity IDs. |
| **Wiz note** | `Accepted FP: href sanitized via safeAppHref/safeEntityHref (same-origin + UUID check). docs/Wiz_Accepted_Risks_and_Suppressions.md §A3.` |

### A4. Prototype Pollution

| Field | Value |
|---|---|
| **Rule names** | `Prototype Pollution in Object Loops`; `Prototype Pollution via Insecure Object Assignment` |
| **Paths** | `apps/web/src/utils/receipt-serials-excel.ts`; `.cursor/skills/design-system/scripts/generate-tokens.cjs` |
| **Decision** | **False Positive** (mitigated) / Out of Scope for skills |
| **Rationale** | Keys gated with `isSafeObjectKey` (blocks `__proto__`, `constructor`, `prototype`). Skill scripts are non-runtime. |
| **Wiz note** | `Accepted FP: object keys filtered with isSafeObjectKey before assignment. docs/Wiz_Accepted_Risks_and_Suppressions.md §A4.` |

### A5. FastAPI Route Missing Authentication

| Field | Value |
|---|---|
| **Rule name** | `FastAPI Route Handler Missing Authentication Dependency` |
| **Paths** | `apps/api/src/shared/health.py` (`GET /health`); `apps/api/src/modules/foundation/routers/auth.py` (`/auth/microsoft/config`, login, callback) |
| **Decision** | **Risk Accepted** (intentional public) |
| **Rationale** | Load-balancer health probes and Microsoft SSO bootstrap **must** be unauthenticated. Routes use `Security(optional_authentication)` / `Depends(optional_authentication)` to mark them public explicitly (`apps/api/src/security/public_routes.py`). No secrets are returned from config. |
| **Wiz note** | `Risk accepted: intentional public probe/SSO endpoints; marked with optional_authentication Security(). No secrets exposed. docs/Wiz_Accepted_Risks_and_Suppressions.md §A5.` |

### A6. Quantum-vulnerable JWT signing (PyJWT RS256)

| Field | Value |
|---|---|
| **Rule name** | `Usage of quantum-vulnerable signing algorithm in PyJWT` |
| **Path** | `apps/api/src/modules/foundation/service/microsoft_oauth_service.py` |
| **Decision** | **Risk Accepted** (vendor constraint) |
| **Severity in scan** | Informational |
| **Rationale** | Microsoft Entra ID `id_token` signatures are **RS256** per issuer metadata. Changing algorithm would break SSO. Post-quantum JWT is not available from Microsoft for this flow today. |
| **Wiz note** | `Risk accepted: Microsoft Entra id_token requires RS256; algorithm fixed by IdP. Informational only. docs/Wiz_Accepted_Risks_and_Suppressions.md §A6.` |

### A7. Arbitrary Code Execution via Insecure Import

| Field | Value |
|---|---|
| **Rule name** | `Arbitrary Code Execution via Insecure Import` |
| **Path** | `apps/api/scripts/expand_response_schemas.py` |
| **Decision** | **Out of Scope** / **Risk Accepted** |
| **Rationale** | Offline codegen utility under `apps/api/scripts/`. Module names come from `pkgutil.walk_packages` and are allowlisted with `_MODEL_MOD_RE` + `modules.*.models*` prefix checks — not HTTP user input. Not part of the FastAPI runtime image entrypoint. |
| **Wiz note** | `Out of scope: offline allowlisted importlib in codegen script, not runtime API. docs/Wiz_Accepted_Risks_and_Suppressions.md §A7.` |

### A8. Caught Error Details Written to Console

| Field | Value |
|---|---|
| **Rule name** | `Caught Error Details Written to Console` |
| **Paths** | Primarily `.cursor/skills/**` scripts |
| **Decision** | **Out of Scope** (skills); mitigated in web app via `dev-log` |
| **Rationale** | Skill CLI tools log to the developer terminal only. Production web services use structured / redacted logging helpers. |
| **Wiz note** | `Out of scope: Cursor skill CLI console logging only; not end-user browser path. docs/Wiz_Accepted_Risks_and_Suppressions.md §A8.` |

### A9. ReDoS / Non-literal RegExp

| Field | Value |
|---|---|
| **Rule names** | `Potential Regular Expression Denial of Service (ReDoS)`; `Non-literal regular expression usage leading to ReDoS vulnerability` |
| **Paths** | `.cursor/skills/brand/scripts/sync-brand-to-tokens.cjs` (and similar) |
| **Decision** | **Out of Scope** / False Positive when using `extractSection` literals |
| **Rationale** | Brand token sync is a local developer script on trusted markdown. Not exposed to untrusted network input in production. |
| **Wiz note** | `Out of scope: local skill script on trusted brand markdown, not production request path. docs/Wiz_Accepted_Risks_and_Suppressions.md §A9.` |

---

## B. Recurring SCA / dependency CVEs — accept or re-verify

### B1. `image-size` (CVE-2025-71329 / CVE-2025-71330)

| Field | Value |
|---|---|
| **Apps** | `apps/employee-mobile` (Metro / RN transitive) |
| **Decision** | **Risk Accepted** (compensating control) until upstream publishes ≥2.0.3 |
| **Mitigation applied** | npm override: `"image-size": "npm:image-size-safe@2.0.3"` |
| **Rationale** | Official `image-size@2.0.3` was never published on npm; all upstream versions ≤2.0.2 remain vulnerable. Security fork `image-size-safe@2.0.3` is pinned via override. Wiz may still label the package as `image-size`. |
| **Wiz note** | `Risk accepted: upstream image-size has no published patch; overridden to image-size-safe@2.0.3. Re-check when image-size>=2.0.3 exists on npm. docs/Wiz_Accepted_Risks_and_Suppressions.md §B1.` |
| **Re-open when** | Official `image-size` ≥ 2.0.3 is published — then drop the fork alias. |

### B2. Transitive npm packages (keep overrides current)

These should be **fixed by version bump**, not permanently accepted. If a scan still shows an old version after a bump, treat as **scan lag / lockfile not rebuilt** and re-run after `npm install` + redeploy.

| Package | Target pin (as of 2026-09-04) | Apps |
|---|---|---|
| `qs` | `6.16.0` | web |
| `fast-uri` | `3.1.6` | web, employee-app |
| `browserslist` | `4.28.8` | web, employee-app, employee-mobile |
| `nanoid` | `3.3.18` (app) / `5.1.16` (web) | employee-app / web |
| `serialize-javascript` | `7.1.1` | employee-app |
| `@xmldom/xmldom` | `0.9.12` | employee-mobile |
| `decode-uri-component` | `0.5.0` | employee-mobile |
| `uuid` | `14.0.2` | employee-mobile |

**Wiz note (if still open after pin):**  
`Remediated in lockfile overrides (see package.json overrides). Re-scan after deploy of commit on main. docs/Wiz_Accepted_Risks_and_Suppressions.md §B2.`

---

## C. Recommended Wiz scope exclusions

Exclude or de-prioritize these paths from **production** SAST policy (or mark folder as non-production):

| Path | Reason |
|---|---|
| `.cursor/skills/**` | Local Cursor agent skills; not in Docker runtime images |
| `apps/api/scripts/**` | Offline / ops codegen utilities |
| `docs/security/**` | Local scan report storage (gitignored) |
| `**/node_modules/**` | Covered by SCA, not SAST |

Production focus:

- `apps/api/src/**`
- `apps/web/src/**`
- `apps/employee-app/` (app source, not only scripts)
- `apps/employee-mobile/` (app source)

---

## D. Quick paste cards (for Wiz UI)

```
[A1 PATH] FP — resolveWithinRoot containment; .cursor/skills not in runtime. Ref §A1.
[A2 CSV] FP — _csv_cell formula neutralization. Ref §A2.
[A3 HREF] FP — safeAppHref/safeEntityHref. Ref §A3.
[A4 PROTO] FP — isSafeObjectKey. Ref §A4.
[A5 AUTH] Accepted — intentional public health/SSO; optional_authentication. Ref §A5.
[A6 JWT] Accepted — Entra RS256 required. Informational. Ref §A6.
[A7 IMPORT] OOS — allowlisted codegen script. Ref §A7.
[A8 CONSOLE] OOS — skill CLI only. Ref §A8.
[A9 REDOS] OOS — local skill on trusted markdown. Ref §A9.
[B1 IMAGE] Accepted — image-size-safe@2.0.3 override; no upstream patch. Ref §B1.
```

---

## E. Review cadence

| Trigger | Action |
|---|---|
| New Wiz report | Match against this doc first; only open tickets for **new** rules or **unpinned** CVEs |
| Quarterly | Re-validate A5–A6 and B1 with security owner |
| `image-size` upstream release | Replace fork override; close B1 |
| New public API route | Must either require auth or be added here under A5 with justification |

**Document owner:** connect (ERP platform)  
**Approver:** Security / VAPT lead (CACHE Digitech)
