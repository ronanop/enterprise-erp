# DC Challan ↔ SCM contract (Asset module)

This document is the **outbound / inbound contract** for delivery challans. This phase does **not** modify Procurement or SCM modules. Outbound HTTP is a no-op (`AssetScmAdapter.send_dc_request` logs only).

## Auth flag (inbound)

| Item | Value |
|---|---|
| Header | `X-ERP-Service-Key` |
| Env | `ASSET_DC_CHALLAN_SCM_API_KEY` |
| User JWT | **Not** used on `POST /api/v1/assets/asset-dc-challans/{id}/scm-callback` |

If the env key is empty or the header does not match (constant-time compare), the callback returns **401**. Manual `POST .../documents/scm-issued` (multipart) and legacy `POST .../attach-scm-document` (JSON URL, which we download and store) stay on a user session with `asset.dc_challan:receive`.

**Later home:** Integration `int_api_credential` (not built in this phase).

## Branch / company pinning

`branch_id` and `company_id` are copied from the **asset at create**. Completing an asset transfer that changes `ast_asset.branch_id` does **not** rewrite the challan. Origin-branch IT still sees the paperwork via `apply_ast_filter` on the challan row; destination-branch users with branch scope may not. Super_admin / All-branches still sees it.

## Outbound payload (IT → SCM)

Sent conceptually when status moves `PENDING` → `SENT_TO_SCM`. Adapter is log-only; no email.

```json
{
  "dc_number": "DC-2026-000001",
  "dc_challan_id": "uuid",
  "asset": {
    "asset_name": "string",
    "asset_tag": "AST-…",
    "make": "string | null",
    "model": "string | null",
    "serial_number": "string | null",
    "purchase_cost": "string | null"
  },
  "employee": {
        "employee_code": "string | null",
        "employee_name": "string",
        "employee_phone": "string | null",
        "employee_email": "string | null",
        "deployed_to": "string | null"
      },
  "requested_by": "uuid",
  "callback_url": "/api/v1/assets/asset-dc-challans/{id}/scm-callback"
}
```

Send-to-SCM employee snapshot rules, branched by assignment `employee_source`:

| Source | Required | Optional | Notes |
|---|---|---|---|
| `MASTER_DATA` (directory) | `employee_code`, `employee_name`, `employee_email` | `employee_phone` (soft warning if blank) | Unchanged from the previous lock. |
| `MANUAL_ENTRY` (off-directory / deployed staff) | `employee_name`, `employee_phone` | `employee_email` (soft warning if blank: sending is still allowed) | `employee_code` is **absent / null** — it is not required and must not be treated as missing. `deployed_to` is snapshotted from the assignment (free text, e.g. `"Airtel — Gurugram office"`) and may be present on the outbound payload. |

`employee_code` may legitimately be null for manually-entered employees. `deployed_to` is null for directory employees.

## Outbound status update (Asset → SCM)

Emitted conceptually when status moves to `SIGNED` or `RECEIVED`. Adapter is **log-only** (`AssetScmAdapter.push_status_update`); no HTTP in this phase.

**Expected later endpoint:** `POST {scm_base}/delivery-challans/{dc_number}/status` (or equivalent). Payload contains metadata only — **never file bytes**. Emitted when status first becomes `SIGNED` or `RECEIVED`. Re-uploading a signed copy (correction) does **not** emit a second push.

```json
{
  "dc_number": "DC-2026-000001",
  "dc_challan_id": "uuid",
  "status": "SIGNED",
  "timestamp": "2026-08-25T12:00:00+00:00",
  "signed_document": {
    "original_filename": "DC-2026-000001-signed.pdf",
    "filename": "DC-2026-000001-signed.pdf",
    "checksum_sha256": "hex",
    "file_size_bytes": 128000,
    "content_type": "application/pdf"
  }
}
```

`signed_document` is null when no stored signed file exists (should not happen for `SIGNED`).

## Inbound callback (SCM → Asset)

`POST /api/v1/assets/asset-dc-challans/{id}/scm-callback`

Auth: `X-ERP-Service-Key` as above. SCM may deliver the issued challan document in **either** form:

### 1. Multipart file upload (preferred)

`Content-Type: multipart/form-data`

| Field | Notes |
|---|---|
| `file` | PDF, JPEG, or PNG, max `ASSET_DC_CHALLAN_MAX_UPLOAD_MB` (default 10). Magic bytes are sniffed; declared type/extension are not trusted. |
| `scm_reference_number` | optional string |

### 2. JSON with a fetchable URL

```json
{
  "document_url": "https://…",
  "scm_reference_number": "string | null"
}
```

`document_url` must be `http` or `https` with a host (max 500 chars). Asset **downloads the file server-side and stores its own copy**. `external_url` is provenance only — preview/print never depend on SCM’s link staying alive.

URL intake is SSRF-guarded: the hostname is resolved to IPs before fetch; loopback, private, link-local (including `169.254.169.254`), multicast, and reserved addresses are rejected. Redirects are not followed blindly — each hop is re-validated. Optional allowlist: `ASSET_DC_CHALLAN_SCM_ALLOWED_HOSTS` (comma-separated). Empty in non-production allows any **public** host; empty in production rejects all URL-based intake.

If the download fails (timeout, 404, empty body, disallowed content, or SSRF block), the callback returns a 422 with a clear message and the challan stays `SENT_TO_SCM`. Blocked hosts are audited (`document_url_blocked`).

Legacy JSON `POST .../attach-scm-document` and `POST .../mark-signed` remain for compatibility (OpenAPI `deprecated`). Prefer multipart `documents/scm-issued` and `documents/signed`. Both require `asset.dc_challan:receive`.

The UI upload path is `POST .../documents/scm-issued` (multipart).

## Callback / attach idempotency

| Current status | Payload | Result |
|---|---|---|
| `SENT_TO_SCM` | valid file or URL that we can store | `DOCUMENT_RECEIVED`, one audit |
| `DOCUMENT_RECEIVED` | **same** document (`checksum_sha256` for files; same URL for JSON retries) | **200 + current row**, no status rewrite, **no extra audit** |
| `DOCUMENT_RECEIVED` | **different** document on SCM callback | **409 conflict** (do not overwrite) |
| `DOCUMENT_RECEIVED` | different file on **manual** `documents/scm-issued` | re-upload allowed: previous row is soft-deleted, new row inserted |
| `SIGNED` / `RECEIVED` / `CANCELLED` / `PENDING` | any callback | invalid state (conflict / 422) |

Retry of a callback while still `SENT_TO_SCM` is the first real transition.

## Status machine

`PENDING` → `SENT_TO_SCM` → `DOCUMENT_RECEIVED` → `SIGNED` → `RECEIVED`. Any of the first four may go to `CANCELLED`. `RECEIVED` and `CANCELLED` are terminal.
