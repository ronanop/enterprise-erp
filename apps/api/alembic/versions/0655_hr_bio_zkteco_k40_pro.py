"""Allow ZKTeco K40 Pro as a biometric device model.

Chains after origin/main tip (0654) so HRMS merge does not fork Alembic
against CRM 0646–0654 already on main.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0655_hr_bio_zkteco_k40_pro"
down_revision: str | None = "0654_crm_attachment_ovf_po_pdf_category"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SCHEMA = "hr"
_TABLE = "hr_biometric_device"
_CK = "ck_hr_bio_device_model"


def upgrade() -> None:
    op.drop_constraint(_CK, _TABLE, schema=_SCHEMA, type_="check")
    op.create_check_constraint(
        _CK,
        _TABLE,
        "device_model IN ('fingerprint_k40_timelabs', 'fingerprint_k40_zkteco_pro')",
        schema=_SCHEMA,
    )


def downgrade() -> None:
    op.execute(
        f"""
        UPDATE {_SCHEMA}.{_TABLE}
        SET device_model = 'fingerprint_k40_timelabs'
        WHERE device_model = 'fingerprint_k40_zkteco_pro'
        """
    )
    op.drop_constraint(_CK, _TABLE, schema=_SCHEMA, type_="check")
    op.create_check_constraint(
        _CK,
        _TABLE,
        "device_model IN ('fingerprint_k40_timelabs')",
        schema=_SCHEMA,
    )
