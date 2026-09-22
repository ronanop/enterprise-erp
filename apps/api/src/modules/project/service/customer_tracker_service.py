"""Application service for versioned customer tracker sheets (in-app grids)."""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import NotFoundException, ValidationException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.project.repository.customer_tracker_repository import CustomerTrackerRepository
from modules.project.repository.project_repository import ProjectRepository
from modules.project.schemas import (
    CustomerTrackerColumn,
    CustomerTrackerGridPayload,
    CustomerTrackerGridResponse,
)
from modules.project.service.project_module_admin import ProjectModuleAdminService
from modules.project.service.project_scope_validator import ProjectScopeValidator

GRID_FORMAT = "erp.tracker.grid.v1"
GRID_CONTENT_TYPE = "application/vnd.erp.tracker.grid+json"


def _normalize_grid(grid: CustomerTrackerGridPayload) -> dict:
    seen: set[str] = set()
    columns: list[dict[str, str]] = []
    for col in grid.columns:
        cid = col.id.strip()
        label = col.label.strip()
        if not cid or not label:
            raise ValidationException("Each column needs an id and label")
        if cid in seen:
            raise ValidationException(f"Duplicate column id '{cid}'")
        seen.add(cid)
        columns.append({"id": cid, "label": label})
    if not columns:
        raise ValidationException("Add at least one column")

    rows: list[dict[str, str]] = []
    for raw in grid.rows:
        row: dict[str, str] = {}
        for col in columns:
            value = raw.get(col["id"], "")
            row[col["id"]] = "" if value is None else str(value)
        rows.append(row)

    return {
        "format": GRID_FORMAT,
        "title": None,
        "columns": columns,
        "rows": rows,
    }


def _parse_grid_bytes(raw: bytes) -> dict | None:
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError, TypeError):
        return None
    if not isinstance(data, dict) or data.get("format") != GRID_FORMAT:
        return None
    columns = data.get("columns")
    rows = data.get("rows")
    if not isinstance(columns, list) or not columns:
        return None
    if not isinstance(rows, list):
        return None
    return data


def _grid_meta_from_row(row, raw: bytes | None = None) -> dict:
    meta = {"is_grid": False, "column_count": None, "row_count": None}
    if row.content_type == GRID_CONTENT_TYPE or (
        row.file_name and str(row.file_name).endswith(".tracker.json")
    ):
        meta["is_grid"] = True
    payload = _parse_grid_bytes(raw) if raw is not None else None
    if payload is None and meta["is_grid"]:
        path = Path(row.storage_uri)
        if path.is_file():
            payload = _parse_grid_bytes(path.read_bytes())
    if payload is not None:
        meta["is_grid"] = True
        meta["column_count"] = len(payload.get("columns") or [])
        meta["row_count"] = len(payload.get("rows") or [])
    return meta


class CustomerTrackerService:
    def __init__(self, db: Session) -> None:
        self._repo = CustomerTrackerRepository(db)
        self._projects = ProjectRepository(db)
        self._scope = ProjectScopeValidator(db)
        self._admin = ProjectModuleAdminService(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        self._admin.ensure_admin(ctx)
        rows = self._repo.list_rows(ctx, self._scope.resolve_company_id(ctx, company_id))
        enriched = []
        for row in rows:
            meta = _grid_meta_from_row(row)
            # Attach transient attrs for response mapping
            row.is_grid = meta["is_grid"]  # type: ignore[attr-defined]
            row.column_count = meta["column_count"]  # type: ignore[attr-defined]
            row.row_count = meta["row_count"]  # type: ignore[attr-defined]
            enriched.append(row)
        return enriched

    def get_file(self, ctx: TenantContext, row_id: UUID):
        self._admin.ensure_admin(ctx)
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Customer tracker not found")
        path = Path(row.storage_uri)
        if not path.is_file():
            raise NotFoundException("Customer tracker file is missing")
        return row, path

    def get_grid(self, ctx: TenantContext, row_id: UUID) -> CustomerTrackerGridResponse:
        row, path = self.get_file(ctx, row_id)
        payload = _parse_grid_bytes(path.read_bytes())
        if payload is None:
            raise ValidationException("This tracker version is a file upload, not an editable table")
        columns = [
            CustomerTrackerColumn(id=str(c["id"]), label=str(c["label"]))
            for c in payload["columns"]
            if isinstance(c, dict) and c.get("id") and c.get("label")
        ]
        rows = []
        for raw in payload.get("rows") or []:
            if not isinstance(raw, dict):
                continue
            rows.append({str(k): "" if v is None else str(v) for k, v in raw.items()})
        title = (
            str(payload.get("title") or "").strip()
            or Path(row.file_name).stem.replace("_", " ")
            or f"Tracker v{row.version_no}"
        )
        return CustomerTrackerGridResponse(
            id=row.id,
            project_id=row.project_id,
            version_no=row.version_no,
            title=title,
            remarks=row.remarks,
            grid=CustomerTrackerGridPayload(columns=columns, rows=rows),
            created_at=row.created_at,
        )

    def create(
        self,
        ctx: TenantContext,
        *,
        project_id: UUID,
        file_name: str,
        content_base64: str,
        content_type: str | None = None,
        remarks: str | None = None,
        company_id: UUID | None = None,
    ):
        self._admin.ensure_admin(ctx)
        cid = self._scope.resolve_company_id(ctx, company_id)
        project = self._projects.get(ctx, project_id)
        if project is None or project.company_id != cid:
            raise NotFoundException("Project not found")
        safe_name = Path(file_name).name.strip()
        if not safe_name:
            raise ValidationException("A tracker file name is required")
        try:
            raw = base64.b64decode(content_base64, validate=True)
        except (ValueError, binascii.Error) as exc:
            raise ValidationException("Invalid tracker file data") from exc
        if not raw:
            raise ValidationException("Tracker file cannot be empty")
        if len(raw) > 25 * 1024 * 1024:
            raise ValidationException("Tracker file must be 25 MB or smaller")

        return self._persist(
            ctx,
            company_id=cid,
            branch_id=project.branch_id,
            project_id=project_id,
            safe_name=safe_name,
            raw=raw,
            content_type=content_type,
            remarks=remarks,
        )

    def create_grid(
        self,
        ctx: TenantContext,
        *,
        project_id: UUID,
        grid: CustomerTrackerGridPayload,
        remarks: str | None = None,
        title: str | None = None,
        company_id: UUID | None = None,
    ):
        self._admin.ensure_admin(ctx)
        cid = self._scope.resolve_company_id(ctx, company_id)
        project = self._projects.get(ctx, project_id)
        if project is None or project.company_id != cid:
            raise NotFoundException("Project not found")

        payload = _normalize_grid(grid)
        sheet_title = (title or "").strip() or f"{project.project_code} tracker"
        payload["title"] = sheet_title
        raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(raw) > 25 * 1024 * 1024:
            raise ValidationException("Tracker table is too large")

        safe_title = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "_" for ch in sheet_title)[
            :80
        ] or "tracker"
        safe_name = f"{safe_title}.tracker.json"
        row = self._persist(
            ctx,
            company_id=cid,
            branch_id=project.branch_id,
            project_id=project_id,
            safe_name=safe_name,
            raw=raw,
            content_type=GRID_CONTENT_TYPE,
            remarks=remarks,
        )
        meta = _grid_meta_from_row(row, raw)
        row.is_grid = meta["is_grid"]  # type: ignore[attr-defined]
        row.column_count = meta["column_count"]  # type: ignore[attr-defined]
        row.row_count = meta["row_count"]  # type: ignore[attr-defined]
        return row

    def _persist(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID | None,
        project_id: UUID,
        safe_name: str,
        raw: bytes,
        content_type: str | None,
        remarks: str | None,
    ):
        version_no = self._repo.next_version(ctx, project_id)
        root = settings.resolved_project_tracker_upload_root / str(project_id)
        root.mkdir(parents=True, exist_ok=True)
        stored_path = root / f"v{version_no}_{uuid4().hex}_{safe_name}"
        stored_path.write_bytes(raw)
        row = self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            project_id=project_id,
            version_no=version_no,
            file_name=safe_name,
            storage_uri=str(stored_path),
            content_type=content_type,
            file_size=len(raw),
            content_hash=hashlib.sha256(raw).hexdigest(),
            remarks=remarks.strip() if remarks else None,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="prj_customer_tracker",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        meta = _grid_meta_from_row(row, raw)
        row.is_grid = meta["is_grid"]  # type: ignore[attr-defined]
        row.column_count = meta["column_count"]  # type: ignore[attr-defined]
        row.row_count = meta["row_count"]  # type: ignore[attr-defined]
        return row
