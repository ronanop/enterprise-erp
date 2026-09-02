# Asset Document Management — Release Notes (FP-ASSET-016)

**Release:** FP-ASSET-016  
**ADR:** ADR-ASSET-DOC-001

## Added

- Productized asset document metadata with validator, supersede/archive actions, search, filters, pagination.
- Dedicated `AssetDocumentWorkspace`.
- Migration `0481_ast_document_governance` (search indexes).
- `storage_uri` scheme allowlist validation.

## Breaking changes

- List response is now `AssetDocumentListResult` (`items`, `total`, `page`, `page_size`) instead of a bare array.
- Create/Update schemas no longer accept `status`.
- PATCH requires `version` and only applies to `active` documents.

## Out of scope

- Binary file upload
- Enterprise Documents (`doc_*`) integration
- Workflow / Finance
