"""Silent component_code allocation — type prefix + sequence, FOR UPDATE-safe."""

from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.asset.models import AstAsset, AstAssetComponent
from modules.foundation.domain.value_objects import TenantContext

_SUFFIX_RE = re.compile(r"^(.+)-(\d+)$")


class ComponentCodeService:
    """Allocate ``{COMPONENT_TYPE}-{NNNN}`` unique under a parent asset."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def next_code(
        self,
        ctx: TenantContext,
        *,
        asset_id: UUID,
        component_type: str,
    ) -> str:
        # Serialize allocations for this parent (same pattern as Non-IT type lock).
        parent = self._db.scalar(
            select(AstAsset)
            .where(
                AstAsset.id == asset_id,
                AstAsset.tenant_id == ctx.tenant_id,
                AstAsset.is_deleted.is_(False),
            )
            .with_for_update()
        )
        if parent is None:
            raise ValueError("Parent asset not found for component code allocation")

        prefix = f"{str(component_type).strip().upper()}-"
        rows = self._db.scalars(
            select(AstAssetComponent.component_code).where(
                AstAssetComponent.asset_id == asset_id,
                AstAssetComponent.tenant_id == ctx.tenant_id,
                AstAssetComponent.is_deleted.is_(False),
                AstAssetComponent.component_code.ilike(f"{prefix}%"),
            )
        ).all()

        max_seq = 0
        for code in rows:
            text = str(code or "")
            match = _SUFFIX_RE.match(text)
            if match and match.group(1).upper() + "-" == prefix:
                try:
                    max_seq = max(max_seq, int(match.group(2)))
                except ValueError:
                    continue
            elif text.upper().startswith(prefix):
                tail = text[len(prefix) :]
                if tail.isdigit():
                    max_seq = max(max_seq, int(tail))

        return f"{prefix}{max_seq + 1:04d}"
