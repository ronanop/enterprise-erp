"""Create hr.hr_digital_onboarding if it is missing (invitation portal persistence)."""

from sqlalchemy import text

from database.session import engine

DDL_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS hr.hr_digital_onboarding (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES foundation.sec_tenant(id) ON DELETE RESTRICT,
        case_code VARCHAR(40) NOT NULL,
        invitation_token VARCHAR(64) NOT NULL,
        invitation_expires_at TIMESTAMPTZ,
        status VARCHAR(40) NOT NULL DEFAULT 'draft',
        candidate_name VARCHAR(200) NOT NULL DEFAULT '',
        candidate_email VARCHAR(200) NOT NULL DEFAULT '',
        case_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        terms_accepted_at TIMESTAMPTZ,
        terms_version VARCHAR(40),
        terms_accepted_ip VARCHAR(64),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by UUID,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_by UUID,
        is_deleted BOOLEAN NOT NULL DEFAULT false,
        deleted_at TIMESTAMPTZ,
        deleted_by UUID,
        version INTEGER NOT NULL DEFAULT 1,
        CONSTRAINT uk_hr_dig_onb_token UNIQUE (invitation_token),
        CONSTRAINT uk_hr_dig_onb_tenant_code UNIQUE (tenant_id, case_code)
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_hr_dig_onb_tenant ON hr.hr_digital_onboarding (tenant_id)",
    "CREATE INDEX IF NOT EXISTS ix_hr_dig_onb_token ON hr.hr_digital_onboarding (invitation_token)",
    "CREATE INDEX IF NOT EXISTS ix_hr_dig_onb_status ON hr.hr_digital_onboarding (status)",
    "CREATE INDEX IF NOT EXISTS ix_hr_dig_onb_case_code ON hr.hr_digital_onboarding (case_code)",
]


def main() -> None:
    with engine.begin() as conn:
        for stmt in DDL_STATEMENTS:
            conn.execute(text(stmt))
    print("hr.hr_digital_onboarding is ready")


if __name__ == "__main__":
    main()
