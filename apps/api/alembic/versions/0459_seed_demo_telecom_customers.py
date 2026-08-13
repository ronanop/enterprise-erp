"""Seed demo telecom customers (Airtel, Jio, Vi, BSNL) for project delivery demos."""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0459_seed_demo_telecom_customers"
down_revision: str | None = "0458_prj_site_installation_align"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEMO_CUSTOMERS = (
    ("CUST-TEL-AIRTEL", "Airtel"),
    ("CUST-TEL-JIO", "Jio"),
    ("CUST-TEL-VI", "Vodafone Idea"),
    ("CUST-TEL-BSNL", "BSNL"),
)

BILLING_JSON = (
    '{"line1": "Telecom HQ", "city": "New Delhi", '
    '"country_code": "IN", "state": "Delhi", "postal_code": "110001"}'
)


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)

    branches = conn.execute(
        sa.text(
            """
            SELECT id, company_id, tenant_id
            FROM organization.org_branch
            WHERE is_deleted = false
            ORDER BY created_at NULLS LAST
            """
        )
    ).fetchall()

    for branch_id, company_id, tenant_id in branches:
        for code, name in DEMO_CUSTOMERS:
            exists = conn.execute(
                sa.text(
                    """
                    SELECT 1 FROM master.master_customer
                    WHERE company_id = :cid
                      AND is_deleted = false
                      AND lower(customer_name) = lower(:name)
                    LIMIT 1
                    """
                ),
                {"cid": str(company_id), "name": name},
            ).first()
            if exists:
                continue

            code_taken = conn.execute(
                sa.text(
                    """
                    SELECT 1 FROM master.master_customer
                    WHERE company_id = :cid AND customer_code = :code AND is_deleted = false
                    LIMIT 1
                    """
                ),
                {"cid": str(company_id), "code": code},
            ).first()
            final_code = code if not code_taken else f"{code}-{str(uuid4())[:8]}"

            conn.execute(
                sa.text(
                    """
                    INSERT INTO master.master_customer (
                        id, tenant_id, company_id, branch_id,
                        customer_code, customer_name, customer_type,
                        billing_address_json, currency_code, status,
                        created_at, updated_at, is_deleted, version
                    ) VALUES (
                        CAST(:id AS uuid), CAST(:tid AS uuid),
                        CAST(:cid AS uuid), CAST(:bid AS uuid),
                        :code, :name, 'corporate',
                        CAST(:billing AS jsonb), 'INR', 'active',
                        :now, :now, false, 1
                    )
                    """
                ),
                {
                    "id": str(uuid4()),
                    "tid": str(tenant_id),
                    "cid": str(company_id),
                    "bid": str(branch_id),
                    "code": final_code,
                    "name": name,
                    "billing": BILLING_JSON,
                    "now": now,
                },
            )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE master.master_customer
            SET is_deleted = true, deleted_at = now()
            WHERE customer_code LIKE 'CUST-TEL-%'
              AND is_deleted = false
            """
        )
    )
