"""Marketing media asset service."""

import base64
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.marketing.models.media_asset import MktMediaAsset
from modules.marketing.repository.marketing_repository import MediaAssetRepository
from modules.marketing.schemas import MediaAssetResponse
from modules.marketing.service.marketing_scope_validator import MarketingScopeValidator

UPLOAD_ROOT = Path(__file__).resolve().parents[4] / "var" / "marketing-assets"


class MediaAssetService:
    def __init__(self, db: Session) -> None:
        self._repo = MediaAssetRepository(db)
        self._scope = MarketingScopeValidator(db)

    def list_assets(self, ctx: TenantContext, *, company_id: UUID | None = None, q: str | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._repo.list_rows(ctx, cid, q=q)
        return [MediaAssetResponse.model_validate(r) for r in rows]

    def get_asset(self, ctx: TenantContext, row_id: UUID) -> MediaAssetResponse:
        row = self._get(ctx, row_id)
        return MediaAssetResponse.model_validate(row)

    def create_asset(self, ctx: TenantContext, company_id: UUID | None = None, **fields) -> MediaAssetResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        asset_number = f"MKT-AST-{uuid4().hex[:8].upper()}"
        row = self._repo.create(ctx, company_id=cid, asset_number=asset_number, **fields)
        return MediaAssetResponse.model_validate(row)

    def upload_asset(
        self,
        ctx: TenantContext,
        *,
        name: str,
        content_base64: str,
        company_id: UUID | None = None,
        mime_type: str | None = None,
        asset_kind: str = "image",
        width_px: int | None = None,
        height_px: int | None = None,
        alt_text: str | None = None,
        description: str | None = None,
    ) -> MediaAssetResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
        ext = "bin"
        if mime_type:
            ext = mime_type.split("/")[-1].replace("jpeg", "jpg")
        filename = f"{uuid4().hex}.{ext}"
        path = UPLOAD_ROOT / filename
        raw = base64.b64decode(content_base64.split(",")[-1])
        path.write_bytes(raw)
        file_url = f"/static/marketing-assets/{filename}"
        return self.create_asset(
            ctx,
            company_id=cid,
            name=name,
            file_url=file_url,
            mime_type=mime_type,
            asset_kind=asset_kind,
            width_px=width_px,
            height_px=height_px,
            alt_text=alt_text,
            description=description,
            file_size_bytes=len(raw),
        )

    def update_asset(self, ctx: TenantContext, row_id: UUID, **fields) -> MediaAssetResponse:
        self._get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Asset not found")
        return MediaAssetResponse.model_validate(row)

    def _get(self, ctx: TenantContext, row_id: UUID) -> MktMediaAsset:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Asset not found")
        return row
