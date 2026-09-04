# FP-ASSET-016 — Asset Document Management (Feature Package)

**Status:** Implemented  
**ADR:** ADR-ASSET-DOC-001

## Scope

Asset document **metadata** register. Lifecycle: active → superseded → archived (or active → archived). No approval workflow. No Finance. No `doc_*` binary storage.

## Lifecycle fidelity

- **Create:** `POST /` — creates `active` row; client cannot override `status`.
- **Update:** `PATCH /{id}` — active metadata only; requires `version`.
- **Supersede:** `POST /{id}/supersede` — active only.
- **Archive:** `POST /{id}/archive` — active or superseded.

## API (`/api/v1/assets/asset-documents`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `asset.document:read` |
| GET | `/{id}` | `asset.document:read` |
| POST | `/` | `asset.document:create` |
| PATCH | `/{id}` | `asset.document:update` |
| POST | `/{id}/supersede` | `asset.document:update` |
| POST | `/{id}/archive` | `asset.document:update` |

List: `page`, `page_size`, `company_id`, `asset_id`, `document_type`, `branch_id`, `status`, `q`.

List response: `AssetDocumentListResult`.

## UI

`AssetDocumentWorkspace` at `/assets/asset-documents`. Server-side search, filters, metadata edit, supersede/archive. Helper text explains metadata-only scope.
