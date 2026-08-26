"""Set default contact email and phone on CRM selling entities."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0500_crm_selling_entity_contact"
down_revision: str | None = "0499_crm_cloud_opportunity_repair"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_ENTITY_EMAIL = "info@cachedigitech.com"
_ENTITY_CONTACT = "18003094333"


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            UPDATE crm.crm_selling_entity
            SET entity_email = :entity_email,
                entity_contact = :entity_contact,
                updated_at = now(),
                version = version + 1
            WHERE coalesce(is_deleted, false) IS FALSE
            """
        ),
        {"entity_email": _ENTITY_EMAIL, "entity_contact": _ENTITY_CONTACT},
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            UPDATE crm.crm_selling_entity
            SET entity_email = NULL,
                entity_contact = NULL,
                updated_at = now(),
                version = version + 1
            WHERE coalesce(is_deleted, false) IS FALSE
              AND entity_email = :entity_email
              AND entity_contact = :entity_contact
            """
        ),
        {"entity_email": _ENTITY_EMAIL, "entity_contact": _ENTITY_CONTACT},
    )
