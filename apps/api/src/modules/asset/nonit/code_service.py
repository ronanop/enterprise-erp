"""Non-IT asset code generation — gapless per (company, asset_type), never reuses after disposal.

Locks the asset-type row (FOR UPDATE), then allocates MAX(existing numeric suffix) + 1.
Format: ``{prefix}{n:03d}`` with automatic width growth past 999 (CH1000).
"""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.asset.nonit.repository_asset import NonItAssetRepository
from modules.asset.nonit.repository_type import NonItAssetTypeRepository
from modules.foundation.domain.value_objects import TenantContext


def format_nonit_code(prefix: str, number: int) -> str:
    width = max(3, len(str(number)))
    return f"{prefix}{number:0{width}d}"


class NonItCodeService:
    def __init__(self, db: Session) -> None:
        self._types = NonItAssetTypeRepository(db)
        self._assets = NonItAssetRepository(db)

    def next_code(
        self,
        ctx: TenantContext,
        company_id: UUID,
        asset_type_id: UUID,
    ) -> str:
        codes = self.next_codes(ctx, company_id, asset_type_id, 1)
        return codes[0]

    def next_codes(
        self,
        ctx: TenantContext,
        company_id: UUID,
        asset_type_id: UUID,
        count: int,
    ) -> list[str]:
        if count < 1:
            return []
        asset_type = self._types.lock_for_update(ctx, asset_type_id)
        if asset_type is None:
            raise NotFoundException("Non-IT asset type not found")
        if asset_type.company_id != company_id:
            raise AppException("Asset type does not belong to company")
        prefix = str(asset_type.prefix).strip().upper()
        if not prefix:
            raise AppException("Asset type prefix is empty")
        start = self._assets.max_seq_for_prefix(company_id, prefix) + 1
        return [format_nonit_code(prefix, start + i) for i in range(count)]

    def peek_next_code(
        self,
        ctx: TenantContext,
        company_id: UUID,
        asset_type_id: UUID,
    ) -> str:
        """Provisional next code (no row lock). Concurrent creates may advance past this."""
        asset_type = self._types.get(ctx, asset_type_id)
        if asset_type is None:
            raise NotFoundException("Non-IT asset type not found")
        if asset_type.company_id != company_id:
            raise AppException("Asset type does not belong to company")
        prefix = str(asset_type.prefix).strip().upper()
        if not prefix:
            raise AppException("Asset type prefix is empty")
        start = self._assets.max_seq_for_prefix(company_id, prefix) + 1
        return format_nonit_code(prefix, start)
