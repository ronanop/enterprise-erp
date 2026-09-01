"""Add OEM Support as a ticket mode option."""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0502_svc_mode_oem_support"
down_revision: str | None = "0501_svc_fe_attachment_link"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO service.svc_ticket_option
            (id, tenant_id, company_id, option_type, option_code, option_label, sort_order, status, created_at, updated_at, is_deleted, version)
        SELECT gen_random_uuid(), c.tenant_id, c.id, 'mode', 'oem_support', 'OEM Support', 3,
               'active', now(), now(), false, 1
        FROM organization.org_company c
        WHERE c.is_deleted = false
        ON CONFLICT ON CONSTRAINT uk_svc_ticket_option_code DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE service.svc_ticket_option
        SET is_deleted = true, updated_at = now()
        WHERE option_type = 'mode'
          AND option_code = 'oem_support'
          AND is_deleted = false
        """
    )
