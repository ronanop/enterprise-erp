"""Encrypt HR employee-profile and digital-onboarding PII already stored in clear text."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from helpers import index_exists, table_exists
from modules.hr.service.pii_mask import looks_masked, mask_email, mask_phone
from security.field_crypto import (
    decrypt_json,
    decrypt_str,
    encrypt_str,
    is_encrypted,
    json_ciphertext_envelope,
)

revision: str = "0595_hr_pii_encrypt"
down_revision: str | None = "0594_master_employee_people_roles"
branch_labels = None
depends_on = None

_PROFILE = "hr_employee_profile"
_ONBOARDING = "hr_digital_onboarding"
_SCHEMA = "hr"

_PROFILE_TEXT = (
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
_PROFILE_JSON = ("permanent_address_json", "current_address_json")
_PROFILE_INDEXES = ("ix_hr_profile_aadhaar", "ix_hr_profile_pan")


def _drop_index(name: str) -> None:
    bind = op.get_bind()
    if index_exists(bind, _PROFILE, name, schema=_SCHEMA):
        op.drop_index(name, table_name=_PROFILE, schema=_SCHEMA)


def _encrypt_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value)
    if text == "" or is_encrypted(text):
        return None
    return encrypt_str(text)


def upgrade() -> None:
    bind = op.get_bind()
    if table_exists(bind, _PROFILE, schema=_SCHEMA):
        for name in _PROFILE_INDEXES:
            _drop_index(name)
        op.alter_column(
            _PROFILE,
            "date_of_birth",
            existing_type=sa.Date(),
            type_=sa.Text(),
            existing_nullable=True,
            schema=_SCHEMA,
            postgresql_using="date_of_birth::text",
        )
        for column in _PROFILE_TEXT:
            op.alter_column(
                _PROFILE,
                column,
                existing_type=sa.String(),
                type_=sa.Text(),
                existing_nullable=True,
                schema=_SCHEMA,
            )
        _encrypt_profile_rows()

    if table_exists(bind, _ONBOARDING, schema=_SCHEMA):
        for column in ("candidate_name", "candidate_email"):
            op.alter_column(
                _ONBOARDING,
                column,
                existing_type=sa.String(length=200),
                type_=sa.Text(),
                existing_nullable=False,
                schema=_SCHEMA,
            )
        _encrypt_onboarding_rows()


def _encrypt_profile_rows() -> None:
    conn = op.get_bind()
    columns = ["id", "date_of_birth", *_PROFILE_TEXT, *_PROFILE_JSON]
    rows = conn.execute(
        sa.text(f"SELECT {', '.join(columns)} FROM {_SCHEMA}.{_PROFILE}")
    ).mappings()
    for row in rows:
        assignments: list[str] = []
        params: dict[str, object] = {"id": row["id"]}
        for column in ("date_of_birth", *_PROFILE_TEXT):
            encrypted = _encrypt_text(row[column])
            if encrypted is None:
                continue
            params[column] = encrypted
            assignments.append(f"{column} = :{column}")
        for column in _PROFILE_JSON:
            value = row[column]
            if value is None or (isinstance(value, dict) and set(value.keys()) == {"enc"}):
                continue
            params[column] = json.dumps(json_ciphertext_envelope(value))
            assignments.append(f"{column} = CAST(:{column} AS jsonb)")
        if not assignments:
            continue
        conn.execute(
            sa.text(
                f"UPDATE {_SCHEMA}.{_PROFILE} SET {', '.join(assignments)} WHERE id = :id"
            ),
            params,
        )


def _encrypt_onboarding_rows() -> None:
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            f"SELECT id, candidate_name, candidate_email, case_json FROM {_SCHEMA}.{_ONBOARDING}"
        )
    ).mappings()
    for row in rows:
        params: dict[str, object] = {"id": row["id"]}
        assignments: list[str] = []
        for column in ("candidate_name", "candidate_email"):
            encrypted = _encrypt_text(row[column])
            if encrypted is None:
                continue
            params[column] = encrypted
            assignments.append(f"{column} = :{column}")
        case = row["case_json"]
        if isinstance(case, dict):
            sealed = dict(case)
            changed = False
            pii = sealed.get("portalPii")
            if isinstance(pii, dict):
                sealed["portalPii"] = encrypt_str(json.dumps(pii, separators=(",", ":"), default=str))
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
                params["case_json"] = json.dumps(sealed)
                assignments.append("case_json = CAST(:case_json AS jsonb)")
        if not assignments:
            continue
        conn.execute(
            sa.text(
                f"UPDATE {_SCHEMA}.{_ONBOARDING} SET {', '.join(assignments)} WHERE id = :id"
            ),
            params,
        )


def downgrade() -> None:
    bind = op.get_bind()
    if table_exists(bind, _ONBOARDING, schema=_SCHEMA):
        _decrypt_onboarding_rows()
        for column, length in (("candidate_name", 200), ("candidate_email", 200)):
            op.alter_column(
                _ONBOARDING,
                column,
                existing_type=sa.Text(),
                type_=sa.String(length=length),
                existing_nullable=False,
                schema=_SCHEMA,
            )
    if table_exists(bind, _PROFILE, schema=_SCHEMA):
        _decrypt_profile_rows()
        op.alter_column(
            _PROFILE,
            "date_of_birth",
            existing_type=sa.Text(),
            type_=sa.Date(),
            existing_nullable=True,
            schema=_SCHEMA,
            postgresql_using="NULLIF(date_of_birth, '')::date",
        )
        widths = {
            "gender": 30,
            "marital_status": 30,
            "nationality": 100,
            "blood_group": 10,
            "emergency_contact_name": 255,
            "emergency_contact_mobile": 30,
            "aadhaar_number": 12,
            "pan_number": 10,
            "uan_number": 20,
            "bank_account_number": 30,
            "bank_ifsc": 11,
            "bank_name": 100,
            "bank_account_holder": 255,
        }
        for column, length in widths.items():
            op.alter_column(
                _PROFILE,
                column,
                existing_type=sa.Text(),
                type_=sa.String(length=length),
                existing_nullable=True,
                schema=_SCHEMA,
            )


def _decrypt_profile_rows() -> None:
    conn = op.get_bind()
    columns = ["id", "date_of_birth", *_PROFILE_TEXT, *_PROFILE_JSON]
    rows = conn.execute(
        sa.text(f"SELECT {', '.join(columns)} FROM {_SCHEMA}.{_PROFILE}")
    ).mappings()
    for row in rows:
        assignments: list[str] = []
        params: dict[str, object] = {"id": row["id"]}
        for column in ("date_of_birth", *_PROFILE_TEXT):
            value = row[column]
            if not isinstance(value, str) or not is_encrypted(value):
                continue
            params[column] = decrypt_str(value)
            assignments.append(f"{column} = :{column}")
        for column in _PROFILE_JSON:
            value = row[column]
            if not (isinstance(value, dict) and set(value.keys()) == {"enc"}):
                continue
            params[column] = json.dumps(decrypt_json(value))
            assignments.append(f"{column} = CAST(:{column} AS jsonb)")
        if not assignments:
            continue
        conn.execute(
            sa.text(
                f"UPDATE {_SCHEMA}.{_PROFILE} SET {', '.join(assignments)} WHERE id = :id"
            ),
            params,
        )


def _decrypt_onboarding_rows() -> None:
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            f"SELECT id, candidate_name, candidate_email, case_json FROM {_SCHEMA}.{_ONBOARDING}"
        )
    ).mappings()
    for row in rows:
        params: dict[str, object] = {"id": row["id"]}
        assignments: list[str] = []
        for column in ("candidate_name", "candidate_email"):
            value = row[column]
            if not isinstance(value, str) or not is_encrypted(value):
                continue
            params[column] = decrypt_str(value)
            assignments.append(f"{column} = :{column}")
        case = row["case_json"]
        if isinstance(case, dict) and isinstance(case.get("portalPii"), str) and is_encrypted(case["portalPii"]):
            sealed = dict(case)
            sealed["portalPii"] = decrypt_json(case["portalPii"])
            params["case_json"] = json.dumps(sealed)
            assignments.append("case_json = CAST(:case_json AS jsonb)")
        if not assignments:
            continue
        conn.execute(
            sa.text(
                f"UPDATE {_SCHEMA}.{_ONBOARDING} SET {', '.join(assignments)} WHERE id = :id"
            ),
            params,
        )
