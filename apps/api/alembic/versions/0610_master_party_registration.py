"""Customer and vendor registration forms with credit evaluation.

Creates ``master.master_party_registration`` - the onboarding record that has to
be filled, KYC-verified, and credit-assessed before a customer or vendor can
exist in the masters. Also seeds the six new permissions and grants them to
SUPER_ADMIN so the routes are reachable straight after migration.
"""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.master_data.models.party_registration import MasterPartyRegistration
from modules.master_data.permissions import MASTER_PERMISSIONS

revision: str = "0610_master_party_registration"
down_revision: str | Sequence[str] | None = "0609_scm_delivery_notifications"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NEW_PERMISSION_CODES = (
    "master.party_registration:read",
    "master.party_registration:create",
    "master.party_registration:update",
    "master.party_registration:delete",
    "master.party_registration:verify_kyc",
    "master.party_registration:approve",
)


def upgrade() -> None:
    bind = op.get_bind()
    MasterPartyRegistration.__table__.create(bind=bind, checkfirst=True)

    now = datetime.now(timezone.utc)
    new_permissions = [p for p in MASTER_PERMISSIONS if p[0] in NEW_PERMISSION_CODES]

    permission_ids: list[str] = []
    for code, resource, action, module in new_permissions:
        existing = bind.execute(
            sa.text("SELECT id FROM foundation.sec_permission WHERE permission_code = :code"),
            {"code": code},
        ).first()
        if existing:
            permission_ids.append(str(existing[0]))
            continue
        perm_id = str(uuid4())
        permission_ids.append(perm_id)
        bind.execute(
            sa.text(
                """
                INSERT INTO foundation.sec_permission
                (id, permission_code, resource, action, module, is_active, created_at)
                VALUES (:id, :code, :resource, :action, :module, true, :now)
                """
            ),
            {
                "id": perm_id,
                "code": code,
                "resource": resource,
                "action": action,
                "module": module,
                "now": now,
            },
        )

    super_admins = bind.execute(
        sa.text(
            """
            SELECT id, tenant_id FROM foundation.sec_role
            WHERE role_code = 'SUPER_ADMIN' AND is_deleted = false
            """
        )
    ).fetchall()

    for role_id, tenant_id in super_admins:
        for perm_id in permission_ids:
            exists = bind.execute(
                sa.text(
                    """
                    SELECT 1 FROM foundation.sec_role_permission
                    WHERE role_id = :rid AND permission_id = :pid
                    """
                ),
                {"rid": str(role_id), "pid": perm_id},
            ).first()
            if exists:
                continue
            bind.execute(
                sa.text(
                    """
                    INSERT INTO foundation.sec_role_permission
                    (id, tenant_id, role_id, permission_id, granted_at)
                    VALUES (:id, :tid, :rid, :pid, :now)
                    """
                ),
                {
                    "id": str(uuid4()),
                    "tid": str(tenant_id),
                    "rid": str(role_id),
                    "pid": perm_id,
                    "now": now,
                },
            )


def downgrade() -> None:
    bind = op.get_bind()
    for code in NEW_PERMISSION_CODES:
        bind.execute(
            sa.text(
                """
                DELETE FROM foundation.sec_role_permission
                WHERE permission_id IN (
                    SELECT id FROM foundation.sec_permission WHERE permission_code = :code
                )
                """
            ),
            {"code": code},
        )
        bind.execute(
            sa.text("DELETE FROM foundation.sec_permission WHERE permission_code = :code"),
            {"code": code},
        )
    op.drop_table("master_party_registration", schema="master")
