"""Application service for versioned customer tracker uploads."""

from __future__ import annotations

import base64
import binascii
import hashlib
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import NotFoundException, ValidationException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.project.repository.customer_tracker_repository import CustomerTrackerRepository
from modules.project.repository.project_repository import ProjectRepository
from modules.project.service.project_module_admin import ProjectModuleAdminService
from modules.project.service.project_scope_validator import ProjectScopeValidator


class CustomerTrackerService:
    def __init__(self, db: Session) -> None:
        self._repo = CustomerTrackerRepository(db)
        self._projects = ProjectRepository(db)
        self._scope = ProjectScopeValidator(db)
        self._admin = ProjectModuleAdminService(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        self._admin.ensure_admin(ctx)
        return self._repo.list_rows(ctx, self._scope.resolve_company_id(ctx, company_id))

    def get_file(self, ctx: TenantContext, row_id: UUID):
        self._admin.ensure_admin(ctx)
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Customer tracker not found")
        path = Path(row.storage_uri)
        if not path.is_file():
            raise NotFoundException("Customer tracker file is missing")
        return row, path

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

        version_no = self._repo.next_version(ctx, project_id)
        root = settings.resolved_project_tracker_upload_root / str(project_id)
        root.mkdir(parents=True, exist_ok=True)
        stored_path = root / f"v{version_no}_{uuid4().hex}_{safe_name}"
        stored_path.write_bytes(raw)
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=project.branch_id,
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
        return row
