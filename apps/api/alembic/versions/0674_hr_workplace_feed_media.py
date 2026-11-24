"""Add HR workplace feed media table (up to 5 photos per post)."""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

from modules.hr.models.workplace_feed import HrWorkplaceFeedMedia

revision: str = "0674_hr_workplace_feed_media"
down_revision: str | Sequence[str] | None = "0673_hr_workplace_feed"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS hr")
    bind = op.get_bind()
    HrWorkplaceFeedMedia.__table__.create(bind=bind, checkfirst=True)
    # Backfill cover image as sort_order=0 for existing posts
    bind.execute(
        text(
            """
            INSERT INTO hr.hr_workplace_feed_media (
                id, post_id, sort_order, storage_uri, image_content_type, image_file_name,
                created_at, created_by, updated_at, updated_by,
                tenant_id, company_id, branch_id,
                is_deleted, deleted_at, deleted_by, version
            )
            SELECT
                gen_random_uuid(),
                p.id,
                0,
                p.storage_uri,
                p.image_content_type,
                p.image_file_name,
                p.created_at,
                p.created_by,
                p.updated_at,
                p.updated_by,
                p.tenant_id,
                p.company_id,
                p.branch_id,
                false,
                NULL,
                NULL,
                1
            FROM hr.hr_workplace_feed_post p
            WHERE p.is_deleted IS false
              AND NOT EXISTS (
                    SELECT 1
                    FROM hr.hr_workplace_feed_media m
                    WHERE m.post_id = p.id
                      AND m.sort_order = 0
                      AND m.is_deleted IS false
              )
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    HrWorkplaceFeedMedia.__table__.drop(bind=bind, checkfirst=True)
