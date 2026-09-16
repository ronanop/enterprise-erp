#!/usr/bin/env python3
"""Migrate local ERP file uploads into AWS S3 and rewrite DB references.

Uploads:
  - CRM attachments under CRM_UPLOAD_ROOT  → s3://…/crm/attachments/<name>
  - Asset storage under ASSET_STORAGE_PATH → s3://…/<same relative key>
  - ESS documents under var/ess-documents  → s3://…/hr/ess/<rel>
  - Project trackers under PROJECT_TRACKER_UPLOAD_ROOT → s3://…/project/trackers/<rel>
  - Marketing deliverables sibling folder → s3://…/marketing/deliverables/<rel>

Updates:
  - crm.crm_attachment.file_path (or public.crm_attachment)
  - ESS document storage_uri rows still using ess-doc: prefix

Usage (from apps/api, with S3 env configured):

  PYTHONPATH=src python scripts/migrate_local_storage_to_s3.py --dry-run
  PYTHONPATH=src python scripts/migrate_local_storage_to_s3.py
"""

from __future__ import annotations

import argparse
import mimetypes
import sys
from pathlib import Path

# Allow ``python scripts/...`` without installing the package.
_API_ROOT = Path(__file__).resolve().parents[1]
_SRC = _API_ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from sqlalchemy import text  # noqa: E402

from core import object_storage  # noqa: E402
from core.config import get_settings  # noqa: E402
from database.session import SessionLocal  # noqa: E402
from modules.ess.employee_document_storage import ESS_DOC_PREFIX, UPLOAD_ROOT as ESS_ROOT  # noqa: E402


def _guess_type(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(str(path))
    return guessed or "application/octet-stream"


def _iter_files(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return [p for p in root.rglob("*") if p.is_file() and not p.name.startswith(".")]


def _upload_tree(root: Path, key_prefix: str, *, dry_run: bool) -> list[tuple[Path, str]]:
    uploaded: list[tuple[Path, str]] = []
    prefix_parts = [p for p in key_prefix.split("/") if p]
    for path in _iter_files(root):
        rel = path.relative_to(root).as_posix()
        rel_parts = [p for p in rel.split("/") if p]
        key = object_storage.module_key(*(prefix_parts + rel_parts))
        if dry_run:
            print(f"[dry-run] put {path} -> {key}")
            uploaded.append((path, key))
            continue
        uri = object_storage.put_bytes(key, path.read_bytes(), _guess_type(path))
        print(f"uploaded {path} -> {uri}")
        uploaded.append((path, key))
    return uploaded


def _rewrite_crm_attachments(*, dry_run: bool) -> int:
    settings = get_settings()
    root = settings.resolved_crm_upload_root.resolve()
    updated = 0
    with SessionLocal() as db:
        rows = db.execute(
            text(
                "SELECT id, file_path FROM crm.crm_attachment "
                "WHERE file_path IS NOT NULL AND file_path <> '' "
                "AND COALESCE(is_deleted, false) = false"
            )
        ).mappings().all()
        for row in rows:
            stored = (row["file_path"] or "").strip()
            if object_storage.is_object_uri(stored):
                continue
            path = Path(stored)
            if not path.is_file():
                candidate = root / path.name
                if candidate.is_file():
                    path = candidate
                else:
                    print(f"skip missing CRM attachment {row['id']}: {stored}")
                    continue
            key = object_storage.module_key("crm", "attachments", path.name)
            uri = object_storage.to_uri(key)
            if dry_run:
                print(f"[dry-run] crm.crm_attachment {row['id']}: {stored} -> {uri}")
            else:
                if not object_storage.exists(key):
                    object_storage.put_bytes(key, path.read_bytes(), _guess_type(path))
                db.execute(
                    text("UPDATE crm.crm_attachment SET file_path = :uri WHERE id = :id"),
                    {"uri": uri, "id": row["id"]},
                )
                print(f"crm.crm_attachment {row['id']}: {uri}")
            updated += 1
        if not dry_run:
            db.commit()
    return updated


def _rewrite_ess_documents(*, dry_run: bool) -> int:
    updated = 0
    with SessionLocal() as db:
        table = "hr.hr_employee_document"
        exists = db.execute(text("SELECT to_regclass('hr.hr_employee_document') IS NOT NULL")).scalar()
        if not exists:
            print("hr.hr_employee_document not found; skipping ESS rewrite")
            return 0

        rows = db.execute(
            text(
                f"SELECT id, storage_uri FROM {table} "
                "WHERE storage_uri LIKE :pfx AND COALESCE(is_deleted, false) = false"
            ),
            {"pfx": f"{ESS_DOC_PREFIX}%"},
        ).mappings().all()
        for row in rows:
            stored = (row["storage_uri"] or "").strip()
            rel = stored[len(ESS_DOC_PREFIX) :]
            path = (ESS_ROOT / rel).resolve()
            try:
                path.relative_to(ESS_ROOT.resolve())
            except ValueError:
                print(f"skip invalid ESS path {row['id']}: {stored}")
                continue
            if not path.is_file():
                print(f"skip missing ESS document {row['id']}: {path}")
                continue
            key = object_storage.module_key("hr", "ess", *rel.split("/"))
            uri = object_storage.to_uri(key)
            if dry_run:
                print(f"[dry-run] {table} {row['id']}: {stored} -> {uri}")
            else:
                if not object_storage.exists(key):
                    object_storage.put_bytes(key, path.read_bytes(), _guess_type(path))
                db.execute(
                    text(f"UPDATE {table} SET storage_uri = :uri WHERE id = :id"),
                    {"uri": uri, "id": row["id"]},
                )
                print(f"{table} {row['id']}: {uri}")
            updated += 1
        if not dry_run:
            db.commit()
    return updated


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--skip-trees",
        action="store_true",
        help="Only rewrite DB rows (upload missing objects as needed)",
    )
    args = parser.parse_args()
    settings = get_settings()

    if not settings.s3_configured:
        print("S3_BUCKET and S3_REGION must be set", file=sys.stderr)
        return 1
    # Temporarily force enabled for put_* during migration even if backend=local.
    object_storage.reset_client_cache()
    get_settings.cache_clear()

    # Patch is_enabled for migration when user has credentials but has not flipped
    # OBJECT_STORAGE_BACKEND yet.
    original_enabled = object_storage.is_enabled
    object_storage.is_enabled = lambda: settings.s3_configured  # type: ignore[method-assign]

    try:
        if not args.skip_trees:
            crm_root = settings.resolved_crm_upload_root
            asset_root = settings.resolved_asset_storage_path
            tracker_root = settings.resolved_project_tracker_upload_root
            marketing_root = Path(settings.resolved_crm_upload_root).parent / "marketing-deliverables"

            print(f"CRM root: {crm_root}")
            _upload_tree(crm_root, "crm/attachments", dry_run=args.dry_run)
            print(f"Asset root: {asset_root}")
            _upload_tree(asset_root, "", dry_run=args.dry_run)
            print(f"ESS root: {ESS_ROOT}")
            _upload_tree(ESS_ROOT, "hr/ess", dry_run=args.dry_run)
            print(f"Project trackers: {tracker_root}")
            _upload_tree(tracker_root, "project/trackers", dry_run=args.dry_run)
            print(f"Marketing deliverables: {marketing_root}")
            _upload_tree(marketing_root, "marketing/deliverables", dry_run=args.dry_run)

        crm_n = _rewrite_crm_attachments(dry_run=args.dry_run)
        ess_n = _rewrite_ess_documents(dry_run=args.dry_run)
        print(f"Done. CRM rows touched={crm_n}, ESS rows touched={ess_n}")
        return 0
    finally:
        object_storage.is_enabled = original_enabled  # type: ignore[method-assign]


if __name__ == "__main__":
    raise SystemExit(main())
