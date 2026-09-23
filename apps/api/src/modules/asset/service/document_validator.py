"""Asset document validation rules for FP-ASSET-016."""

from urllib.parse import urlparse
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetDocumentStatus, AssetStatus
from modules.asset.domain.exceptions import DocumentValidationError
from modules.asset.models import AstAssetDocument
from modules.asset.repository.asset_repository import AssetRepository
from modules.foundation.domain.value_objects import TenantContext

DOCUMENT_TYPES = frozenset({"invoice", "warranty", "insurance", "manual", "photo", "other"})
BLOCKED_ASSET_STATUSES = frozenset(
    {
        AssetStatus.DISPOSED.value,
        AssetStatus.WRITTEN_OFF.value,
    }
)
# ADR-ASSET-DOC-001: allowed storage_uri schemes (metadata pointer only).
ALLOWED_STORAGE_URI_SCHEMES = frozenset({"https", "s3", "s3a", "file", "asset-doc"})
HASH_CHARS = frozenset("0123456789abcdefABCDEF")


class DocumentValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)

    def validate_create_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
    ) -> None:
        if fields.get("status") and fields["status"] != AssetDocumentStatus.ACTIVE.value:
            raise DocumentValidationError("Document must be created in active status")

        asset_id = fields.get("asset_id")
        if asset_id is None:
            raise DocumentValidationError("asset_id is required")

        document_type = fields.get("document_type")
        if not document_type or str(document_type).strip() not in DOCUMENT_TYPES:
            raise DocumentValidationError(
                "document_type must be invoice, warranty, insurance, manual, photo, or other"
            )
        fields["document_type"] = str(document_type).strip()

        document_name = fields.get("document_name")
        if not document_name or not str(document_name).strip():
            raise DocumentValidationError("document_name is required")
        fields["document_name"] = str(document_name).strip()

        if "storage_uri" in fields:
            fields["storage_uri"] = self.validate_storage_uri(fields.get("storage_uri"))
        if "content_hash" in fields and fields.get("content_hash") is not None:
            fields["content_hash"] = self._validate_content_hash(fields["content_hash"])

        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self.validate_asset_belongs_to_company(asset, company_id)
        self.validate_asset_operational(asset.status)

    def validate_update_fields(
        self,
        ctx: TenantContext,
        row: AstAssetDocument,
        fields: dict,
    ) -> None:
        if row.status != AssetDocumentStatus.ACTIVE.value:
            raise DocumentValidationError("Only active documents can be updated")
        if "status" in fields and fields["status"] is not None and fields["status"] != row.status:
            raise DocumentValidationError("status cannot be changed via update")
        for key in ("asset_id", "document_type"):
            if key in fields and fields[key] is not None and fields[key] != getattr(row, key):
                raise DocumentValidationError(f"{key} cannot be changed")

        if "document_name" in fields and fields["document_name"] is not None:
            name = str(fields["document_name"]).strip()
            if not name:
                raise DocumentValidationError("document_name is required")
            fields["document_name"] = name

        if "storage_uri" in fields:
            fields["storage_uri"] = self.validate_storage_uri(fields.get("storage_uri"))
        if "content_hash" in fields and fields.get("content_hash") is not None:
            fields["content_hash"] = self._validate_content_hash(fields["content_hash"])

        # Re-check asset is still operational for active metadata edits.
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self.validate_asset_belongs_to_company(asset, row.company_id)
        self.validate_asset_operational(asset.status)

    def validate_supersede_readiness(self, ctx: TenantContext, row: AstAssetDocument) -> None:
        if row.status != AssetDocumentStatus.ACTIVE.value:
            raise DocumentValidationError("Only active documents can be superseded")

    def validate_archive_readiness(self, ctx: TenantContext, row: AstAssetDocument) -> None:
        if row.status not in {
            AssetDocumentStatus.ACTIVE.value,
            AssetDocumentStatus.SUPERSEDED.value,
        }:
            raise DocumentValidationError("Only active or superseded documents can be archived")

    @staticmethod
    def validate_asset_operational(status: str) -> None:
        if status in BLOCKED_ASSET_STATUSES:
            raise DocumentValidationError(
                "Documents cannot be recorded for disposed or written-off assets"
            )

    @staticmethod
    def validate_asset_belongs_to_company(asset, company_id: UUID) -> None:
        if asset.company_id != company_id:
            raise DocumentValidationError("Asset does not belong to this company")

    @staticmethod
    def validate_storage_uri(storage_uri: str | None) -> str | None:
        """Validate optional storage_uri against ADR-ASSET-DOC-001 allowlist.

        Allowed schemes: https, s3, s3a, file, asset-doc.
        Reject empty strings, scheme-less absolute URLs with host, and unsafe schemes
        (http, javascript, data, ftp, etc.).
        """
        if storage_uri is None:
            return None
        value = str(storage_uri).strip()
        if not value:
            raise DocumentValidationError("storage_uri cannot be empty")
        if any(ch.isspace() for ch in value):
            raise DocumentValidationError("storage_uri must not contain whitespace")
        if value.lower().startswith("javascript:") or value.lower().startswith("data:"):
            raise DocumentValidationError("storage_uri scheme is not allowed")

        parsed = urlparse(value)
        scheme = (parsed.scheme or "").lower()
        if not scheme:
            # Relative path / object key without scheme — treat as opaque relative pointer.
            if value.startswith("//"):
                raise DocumentValidationError("storage_uri scheme is not allowed")
            if len(value) > 500:
                raise DocumentValidationError("storage_uri exceeds maximum length")
            return value

        if scheme not in ALLOWED_STORAGE_URI_SCHEMES:
            raise DocumentValidationError(
                "storage_uri scheme must be https, s3, s3a, file, or asset-doc"
            )
        if scheme == "https":
            if not parsed.netloc:
                raise DocumentValidationError("https storage_uri requires a host")
        if len(value) > 500:
            raise DocumentValidationError("storage_uri exceeds maximum length")
        return value

    @staticmethod
    def _validate_content_hash(content_hash: str) -> str:
        value = str(content_hash).strip()
        if not value:
            raise DocumentValidationError("content_hash cannot be empty")
        if len(value) > 128:
            raise DocumentValidationError("content_hash exceeds maximum length")
        if not all(ch in HASH_CHARS for ch in value):
            raise DocumentValidationError("content_hash must be hexadecimal")
        return value.lower()
