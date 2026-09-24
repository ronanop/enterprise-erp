"""Widen HR PII columns and encrypt plaintext already stored. Safe to re-run."""

from __future__ import annotations

import json

from sqlalchemy import create_engine, text

from core.config import settings
from modules.hr.service.pii_mask import looks_masked, mask_email, mask_phone
from security.field_crypto import encrypt_str, is_encrypted, json_ciphertext_envelope, pii_lookup

PROFILE_TEXT = (
    "date_of_birth",
    "gender",
    "marital_status",
    "nationality",
    "blood_group",
    "emergency_contact_name",
    "emergency_contact_mobile",
    "aadhaar_number",
    "pan_number",
    "uan_number",
    "bank_account_number",
    "bank_ifsc",
    "bank_name",
    "bank_account_holder",
)
PROFILE_JSON = ("permanent_address_json", "current_address_json")


def main() -> None:
    engine = create_engine(settings.database_url)
    with engine.begin() as conn:
        _prepare_profile(conn)
        _encrypt_profile(conn)
        _prepare_onboarding(conn)
        _encrypt_onboarding(conn)
        _encrypt_employee_contacts(conn)
    print("HR PII encryption pass finished")


def _prepare_profile(conn) -> None:
    conn.execute(text("DROP INDEX IF EXISTS hr.ix_hr_profile_aadhaar"))
    conn.execute(text("DROP INDEX IF EXISTS hr.ix_hr_profile_pan"))
    dob = conn.execute(
        text(
            """
            SELECT data_type FROM information_schema.columns
            WHERE table_schema = 'hr' AND table_name = 'hr_employee_profile'
              AND column_name = 'date_of_birth'
            """
        )
    ).scalar()
    if dob == "date":
        conn.execute(
            text(
                "ALTER TABLE hr.hr_employee_profile ALTER COLUMN date_of_birth TYPE text USING date_of_birth::text"
            )
        )
    rows = conn.execute(
        text(
            """
            SELECT column_name, data_type FROM information_schema.columns
            WHERE table_schema = 'hr' AND table_name = 'hr_employee_profile'
              AND column_name = ANY(:names)
            """
        ),
        {"names": list(PROFILE_TEXT[1:])},
    ).fetchall()
    for name, data_type in rows:
        if data_type in {"character varying", "character"}:
            conn.execute(
                text(
                    f"ALTER TABLE hr.hr_employee_profile ALTER COLUMN {name} TYPE text"
                )
            )


def _prepare_onboarding(conn) -> None:
    exists = conn.execute(
        text(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'hr' AND table_name = 'hr_digital_onboarding'
            """
        )
    ).scalar()
    if not exists:
        return
    rows = conn.execute(
        text(
            """
            SELECT column_name, data_type FROM information_schema.columns
            WHERE table_schema = 'hr' AND table_name = 'hr_digital_onboarding'
              AND column_name = ANY(:names)
            """
        ),
        {"names": ["candidate_name", "candidate_email"]},
    ).fetchall()
    for name, data_type in rows:
        if data_type in {"character varying", "character"}:
            conn.execute(
                text(
                    f"ALTER TABLE hr.hr_digital_onboarding ALTER COLUMN {name} TYPE text"
                )
            )


def _encrypt_profile(conn) -> None:
    columns = ["id", *PROFILE_TEXT, *PROFILE_JSON]
    rows = conn.execute(
        text(f"SELECT {', '.join(columns)} FROM hr.hr_employee_profile")
    ).mappings()
    updated = 0
    for row in rows:
        assignments: list[str] = []
        params: dict[str, object] = {"id": row["id"]}
        for column in PROFILE_TEXT:
            value = row[column]
            if value is None:
                continue
            text_value = str(value)
            if text_value == "" or is_encrypted(text_value):
                continue
            params[column] = encrypt_str(text_value)
            assignments.append(f"{column} = :{column}")
        for column in PROFILE_JSON:
            value = row[column]
            if value is None or (isinstance(value, dict) and set(value.keys()) == {"enc"}):
                continue
            params[column] = json.dumps(json_ciphertext_envelope(value))
            assignments.append(f"{column} = CAST(:{column} AS jsonb)")
        if not assignments:
            continue
        conn.execute(
            text(
                f"UPDATE hr.hr_employee_profile SET {', '.join(assignments)} WHERE id = :id"
            ),
            params,
        )
        updated += 1
    print(f"employee profiles encrypted: {updated}")


def _encrypt_onboarding(conn) -> None:
    exists = conn.execute(
        text(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'hr' AND table_name = 'hr_digital_onboarding'
            """
        )
    ).scalar()
    if not exists:
        print("digital onboarding table missing")
        return
    rows = conn.execute(
        text(
            """
            SELECT id, candidate_name, candidate_email, case_json
            FROM hr.hr_digital_onboarding
            """
        )
    ).mappings()
    updated = 0
    for row in rows:
        assignments: list[str] = []
        params: dict[str, object] = {"id": row["id"]}
        for column in ("candidate_name", "candidate_email"):
            value = row[column]
            if value is None:
                continue
            text_value = str(value)
            if text_value == "" or is_encrypted(text_value):
                continue
            params[column] = encrypt_str(text_value)
            assignments.append(f"{column} = :{column}")
        case = row["case_json"]
        if isinstance(case, dict):
            sealed = dict(case)
            changed = False
            if isinstance(sealed.get("portalPii"), dict):
                sealed["portalPii"] = encrypt_str(
                    json.dumps(sealed["portalPii"], separators=(",", ":"), default=str)
                )
                changed = True
            phone = str(sealed.get("candidatePhone") or "").strip()
            if phone and not looks_masked(phone):
                sealed["candidatePhone"] = mask_phone(phone)
                changed = True
            email = str(sealed.get("candidateEmail") or "").strip()
            if email and not looks_masked(email):
                sealed["candidateEmail"] = mask_email(email)
                changed = True
            if changed:
                params["case_json"] = json.dumps(sealed, default=str)
                assignments.append("case_json = CAST(:case_json AS jsonb)")
        if not assignments:
            continue
        conn.execute(
            text(
                f"UPDATE hr.hr_digital_onboarding SET {', '.join(assignments)} WHERE id = :id"
            ),
            params,
        )
        updated += 1
    print(f"onboarding cases encrypted: {updated}")


def _encrypt_employee_contacts(conn) -> None:
    exists = conn.execute(
        text(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'master' AND table_name = 'master_employee'
            """
        )
    ).scalar()
    if not exists:
        print("master employee table missing")
        return
    conn.execute(
        text(
            """
            ALTER TABLE master.master_employee
              ADD COLUMN IF NOT EXISTS email_lookup varchar(64),
              ADD COLUMN IF NOT EXISTS mobile_lookup varchar(64)
            """
        )
    )
    for column in ("email", "mobile"):
        data_type = conn.execute(
            text(
                """
                SELECT data_type FROM information_schema.columns
                WHERE table_schema = 'master' AND table_name = 'master_employee'
                  AND column_name = :column
                """
            ),
            {"column": column},
        ).scalar()
        if data_type in {"character varying", "character"}:
            conn.execute(
                text(f"ALTER TABLE master.master_employee ALTER COLUMN {column} TYPE text")
            )
    conn.execute(text("ALTER TABLE master.master_employee DROP CONSTRAINT IF EXISTS uk_master_employee_company_email"))
    conn.execute(text("DROP INDEX IF EXISTS master.ix_master_employee_email"))
    rows = conn.execute(
        text("SELECT id, email, mobile FROM master.master_employee")
    ).mappings()
    updated = 0
    for row in rows:
        params: dict[str, object] = {"id": row["id"]}
        assignments: list[str] = []
        for column in ("email", "mobile"):
            value = row[column]
            if value is None:
                continue
            text_value = str(value)
            if text_value == "":
                continue
            plain = text_value
            if not is_encrypted(text_value):
                encrypted = encrypt_str(text_value)
                params[column] = encrypted
                assignments.append(f"{column} = :{column}")
            else:
                continue
            lookup = pii_lookup(plain)
            if lookup:
                lookup_column = "email_lookup" if column == "email" else "mobile_lookup"
                params[lookup_column] = lookup
                assignments.append(f"{lookup_column} = :{lookup_column}")
        if not assignments:
            continue
        conn.execute(
            text(
                f"UPDATE master.master_employee SET {', '.join(assignments)} WHERE id = :id"
            ),
            params,
        )
        updated += 1
    conn.execute(
        text(
            """
            UPDATE master.master_employee
               SET email_lookup = ''
             WHERE email_lookup IS NULL
            """
        )
    )
    conn.execute(
        text(
            """
            UPDATE master.master_employee
               SET mobile_lookup = ''
             WHERE mobile_lookup IS NULL
            """
        )
    )
    conn.execute(text("ALTER TABLE master.master_employee ALTER COLUMN email_lookup SET NOT NULL"))
    conn.execute(text("ALTER TABLE master.master_employee ALTER COLUMN mobile_lookup SET NOT NULL"))
    conn.execute(
        text(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uk_master_employee_company_email'
              ) THEN
                ALTER TABLE master.master_employee
                  ADD CONSTRAINT uk_master_employee_company_email
                  UNIQUE (company_id, email_lookup);
              END IF;
            END $$
            """
        )
    )
    conn.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_master_employee_email_lookup
              ON master.master_employee (email_lookup)
            """
        )
    )
    print(f"employee contacts encrypted: {updated}")


if __name__ == "__main__":
    main()
