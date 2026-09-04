"""Set GSTIN for VYUHA AI LABS PRIVATE LIMITED selling entity."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0506_crm_vyuha_entity_gst"
down_revision: str | Sequence[str] | None = "0505_prj_config_vm_nw_tools"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_ENTITY_NAME = "VYUHA AI LABS PRIVATE LIMITED"
_GSTIN = "07AAMCV4044L1ZW"


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE crm.crm_selling_entity
            SET entity_gst = :gst,
                updated_at = now()
            WHERE lower(entity_name) = lower(:entity_name)
              AND coalesce(is_deleted, false) IS FALSE
            """
        ).bindparams(gst=_GSTIN, entity_name=_ENTITY_NAME)
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE crm.crm_selling_entity
            SET entity_gst = NULL,
                updated_at = now()
            WHERE lower(entity_name) = lower(:entity_name)
              AND entity_gst = :gst
              AND coalesce(is_deleted, false) IS FALSE
            """
        ).bindparams(gst=_GSTIN, entity_name=_ENTITY_NAME)
    )
