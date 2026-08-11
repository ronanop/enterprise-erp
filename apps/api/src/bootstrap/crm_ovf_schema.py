"""Lightweight CRM OVF column checks so SCM hold features match the ORM after hot reload."""

from sqlalchemy import create_engine, text

from core.config import settings


def ensure_crm_ovf_scm_hold_columns() -> None:
    engine = create_engine(settings.database_url)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE crm.crm_ovf
                  ADD COLUMN IF NOT EXISTS scm_on_hold BOOLEAN NOT NULL DEFAULT false
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE crm.crm_ovf
                  ADD COLUMN IF NOT EXISTS scm_on_hold_at TIMESTAMPTZ
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE crm.crm_ovf
                  ADD COLUMN IF NOT EXISTS scm_hold_blocked BOOLEAN NOT NULL DEFAULT false
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE crm.crm_ovf
                  ADD COLUMN IF NOT EXISTS scm_last_hold_since TIMESTAMPTZ
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE crm.crm_ovf
                  ADD COLUMN IF NOT EXISTS scm_last_hold_released_at TIMESTAMPTZ
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE crm.crm_ovf
                  ADD COLUMN IF NOT EXISTS scm_hold_history JSONB
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE crm.crm_ovf
                  ADD COLUMN IF NOT EXISTS scm_on_hold_remark TEXT
                """
            )
        )
