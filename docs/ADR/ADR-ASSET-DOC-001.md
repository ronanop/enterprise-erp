# ADR-ASSET-DOC-001 — Asset Document Management

**Status:** Accepted  
**Date:** 2026-07-30  
**Package:** FP-ASSET-016  
**Depends on:** FP-ASSET-REG-001, Architecture Lock v1.1

---

## Problem

Asset documents existed as a thin CRUD scaffold without validator, lifecycle actions (supersede/archive), search/pagination, concurrency control, storage URI safety checks, or a dedicated workspace. Productization must stay within Architecture Lock without Workflow, Finance, Governance, or enterprise Document Management (`doc_*`) coupling.

## Decisions

| ID | Decision |
|----|----------|
| DOC-01 | Scope = `ast_asset_document` only; ERD §6.16 columns |
| DOC-02 | No Workflow / Finance / Governance / `doc_*` integration |
| DOC-03 | Lifecycle: `active` → `superseded` → `archived`; also `active` → `archived` |
| DOC-04 | Supersede + archive as explicit POST actions |
| DOC-05 | Limited PATCH on `active` only (`document_name`, `storage_uri`, `content_hash`, `branch_id`) |
| DOC-06 | Required: `asset_id`, `document_type`, `document_name` |
| DOC-07 | Block disposed / written-off assets |
| DOC-08 | Explicit `asset.company_id == document company_id` validation |
| DOC-09 | RBAC: `read`, `create`, `update`; supersede/archive use `:update` |
| DOC-10 | `AssetDocumentListResult` paginated list |
| DOC-11 | Migration `0481` indexes only |
| DOC-12 | Optimistic locking on update / supersede / archive |
| DOC-13 | Dedicated `AssetDocumentWorkspace` |
| DOC-14 | **Metadata only** — no binary upload; `storage_uri` / `content_hash` are pointers |
| DOC-15 | No auto-supersede on create; multiple active docs per asset allowed |

## storage_uri validation policy (DOC-14)

Allowed schemes (create and update identical):

| Scheme | Example | Notes |
|--------|---------|-------|
| `https` | `https://cdn.example.com/a.pdf` | Requires host |
| `s3` / `s3a` | `s3://bucket/key` | Object storage pointer |
| `file` | `file:///mnt/share/a.pdf` | Local path pointer (ops-controlled) |
| `asset-doc` | `asset-doc://tenant/key` | Internal opaque pointer |
| *(none)* | `tenant/folder/doc.pdf` | Relative object key |

**Rejected:** `http`, `javascript`, `data`, `ftp`, `//host/...`, empty strings, whitespace, URIs longer than 500 characters.

Binary file management remains the responsibility of the enterprise Documents platform.

## References

- ERD_15 §6.16
- `docs/08_IMPLEMENTATION/Asset_DOC_Feature_Package.md`
