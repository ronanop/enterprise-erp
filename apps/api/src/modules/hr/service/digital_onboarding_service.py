"""Digital onboarding persistence + public portal token APIs."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.digital_onboarding import HrDigitalOnboarding
from modules.hr.service.pii_mask import (
    apply_masks_to_portal,
    mask_email,
    mask_phone,
    mask_portal_for_storage,
    merge_portal_pii,
    restore_portal_pii,
)


class InvalidDigitalOnboardingState(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class DigitalOnboardingService:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_cases(self, ctx: TenantContext) -> list[dict]:
        rows = self._db.scalars(
            select(HrDigitalOnboarding)
            .where(
                HrDigitalOnboarding.tenant_id == ctx.tenant_id,
                HrDigitalOnboarding.is_deleted.is_(False),
            )
            .order_by(HrDigitalOnboarding.updated_at.desc())
        ).all()
        return [self._to_case(r, include_pii=False) for r in rows]

    def clear_all_cases(self, ctx: TenantContext) -> dict:
        """Soft-delete every onboarding case for the tenant and free unique codes/tokens."""
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        rows = list(
            self._db.scalars(
                select(HrDigitalOnboarding).where(
                    HrDigitalOnboarding.tenant_id == ctx.tenant_id,
                    HrDigitalOnboarding.is_deleted.is_(False),
                )
            ).all()
        )
        deleted = 0
        now = datetime.now(timezone.utc)
        for i, row in enumerate(rows):
            row.is_deleted = True
            row.deleted_at = now
            row.deleted_by = ctx.user_id
            base = (row.case_code or "ONB")[:12]
            row.case_code = f"{base}-DEL-{stamp}-{i}"[:40]
            row.invitation_token = f"del-{uuid4().hex}"[:64]
            deleted += 1
        self._db.flush()
        return {
            "deleted": deleted,
            "message": f"Cleared {deleted} onboarding case(s).",
        }

    def get_case(self, ctx: TenantContext, case_id: str, *, include_pii: bool = False) -> dict:
        try:
            uid = UUID(str(case_id))
        except ValueError as exc:
            raise NotFoundException("Onboarding case not found") from exc
        row = self._db.scalar(
            select(HrDigitalOnboarding).where(
                HrDigitalOnboarding.id == uid,
                HrDigitalOnboarding.tenant_id == ctx.tenant_id,
                HrDigitalOnboarding.is_deleted.is_(False),
            )
        )
        if row is None:
            raise NotFoundException("Onboarding case not found")
        return self._to_case(row, include_pii=include_pii)

    def upsert_case(self, ctx: TenantContext, case: dict) -> dict:
        case_id = case.get("id")
        row: HrDigitalOnboarding | None = None
        prior_pii: dict | None = None
        if case_id:
            try:
                uid = UUID(str(case_id))
            except ValueError as exc:
                raise InvalidDigitalOnboardingState("Invalid case id") from exc
            row = self._db.scalar(
                select(HrDigitalOnboarding).where(
                    HrDigitalOnboarding.id == uid,
                    HrDigitalOnboarding.tenant_id == ctx.tenant_id,
                    HrDigitalOnboarding.is_deleted.is_(False),
                )
            )
            if row is not None and isinstance(row.case_json, dict):
                prior = row.case_json.get("portalPii")
                if isinstance(prior, dict):
                    prior_pii = prior

        invitation = case.get("invitation") or {}
        token = str(invitation.get("token") or "").strip()
        if not token:
            token = uuid4().hex[:16]
            invitation = {**invitation, "token": token}
            case = {**case, "invitation": invitation}

        expires_raw = invitation.get("expiresAt") or invitation.get("expires_at")
        expires_at = self._parse_dt(expires_raw) if expires_raw else None

        clear_email = str(case.get("candidateEmail") or case.get("candidate_email") or "").strip()
        if clear_email and ("*" in clear_email or "•" in clear_email):
            # Client echoed a masked email — keep existing clear value
            clear_email = (row.candidate_email if row else "") or ""

        if row is None:
            case_code = str(case.get("caseCode") or case.get("case_code") or f"ONB-{uuid4().hex[:6].upper()}")
            existing_code = self._db.scalar(
                select(HrDigitalOnboarding.id).where(
                    HrDigitalOnboarding.tenant_id == ctx.tenant_id,
                    HrDigitalOnboarding.case_code == case_code,
                    HrDigitalOnboarding.is_deleted.is_(False),
                )
            )
            if existing_code is not None:
                case_code = f"{case_code}-{uuid4().hex[:4].upper()}"
            row = HrDigitalOnboarding(
                id=UUID(str(case_id)) if case_id else uuid4(),
                tenant_id=ctx.tenant_id,
                case_code=case_code,
                invitation_token=token,
                invitation_expires_at=expires_at,
                status=str(case.get("status") or "draft"),
                candidate_name=str(case.get("candidateName") or case.get("candidate_name") or ""),
                candidate_email=clear_email,
                case_json=case,
                terms_accepted_at=self._parse_dt(case.get("termsAcceptedAt")),
                terms_version=case.get("termsVersion"),
            )
            self._db.add(row)
        else:
            conflict = self._db.scalar(
                select(HrDigitalOnboarding).where(
                    HrDigitalOnboarding.invitation_token == token,
                    HrDigitalOnboarding.id != row.id,
                    HrDigitalOnboarding.is_deleted.is_(False),
                )
            )
            if conflict is not None:
                raise InvalidDigitalOnboardingState("Invitation token already in use")
            row.case_code = str(case.get("caseCode") or case.get("case_code") or row.case_code)
            row.invitation_token = token
            row.invitation_expires_at = expires_at
            row.status = str(case.get("status") or row.status)
            row.candidate_name = str(case.get("candidateName") or case.get("candidate_name") or "")
            if clear_email:
                row.candidate_email = clear_email
            if case.get("termsAcceptedAt"):
                row.terms_accepted_at = self._parse_dt(case.get("termsAcceptedAt"))
            if case.get("termsVersion"):
                row.terms_version = str(case.get("termsVersion"))
            row.case_json = {**case, "id": str(row.id), "invitation": invitation}
            row.updated_by = ctx.user_id

        payload = dict(row.case_json or {})
        payload["id"] = str(row.id)
        payload["invitation"] = {**(payload.get("invitation") or {}), "token": token}
        if expires_raw:
            payload["invitation"]["expiresAt"] = expires_raw
        if row.terms_accepted_at:
            payload["termsAcceptedAt"] = row.terms_accepted_at.isoformat()
            payload["termsVersion"] = row.terms_version
        if row.candidate_email:
            payload["candidateEmail"] = row.candidate_email

        incoming_pii = payload.get("portalPii") if isinstance(payload.get("portalPii"), dict) else None
        seed_pii = merge_portal_pii(prior_pii, incoming_pii)
        if isinstance(payload.get("portal"), dict):
            masked_portal, portal_pii = mask_portal_for_storage(payload.get("portal"), seed_pii)
            payload["portal"] = masked_portal
            payload["portalPii"] = portal_pii
        elif seed_pii:
            payload["portalPii"] = seed_pii

        phone = str(payload.get("candidatePhone") or "").strip()
        if phone and "*" not in phone and "•" not in phone:
            pii = dict(payload.get("portalPii") or {})
            personal = dict(pii.get("personal") or {})
            personal["phone"] = personal.get("phone") or phone
            pii["personal"] = personal
            payload["portalPii"] = pii

        row.case_json = payload
        self._db.flush()
        return self._to_case(row, include_pii=False)

    def get_by_token(self, token: str) -> dict:
        row = self._find_by_token(token)
        # Candidate resume editing needs clear PII
        case = self._to_case(row, include_pii=True)
        expired = False
        if row.invitation_expires_at and row.invitation_expires_at < datetime.now(timezone.utc):
            expired = True
            case["status"] = "overdue"
        case["_expired"] = expired
        return case

    def accept_terms(
        self,
        token: str,
        *,
        terms_version: str = "v1",
        client_ip: str | None = None,
    ) -> dict:
        row = self._find_by_token(token)
        self._assert_not_expired(row)
        now = datetime.now(timezone.utc)
        row.terms_accepted_at = now
        row.terms_version = terms_version or "v1"
        row.terms_accepted_ip = client_ip
        payload = dict(row.case_json or {})
        payload["termsAcceptedAt"] = now.isoformat()
        payload["termsVersion"] = row.terms_version
        row.case_json = payload
        self._db.flush()
        return self._to_case(row, include_pii=True)

    def save_portal(self, token: str, portal: dict, *, advance_status: bool = True) -> dict:
        row = self._find_by_token(token)
        self._assert_not_expired(row)
        if not row.terms_accepted_at:
            raise InvalidDigitalOnboardingState(
                "Please accept the terms and conditions before continuing"
            )
        payload = dict(row.case_json or {})
        existing_pii = payload.get("portalPii") if isinstance(payload.get("portalPii"), dict) else None
        masked_portal, portal_pii = mask_portal_for_storage(portal, existing_pii)
        payload["portal"] = masked_portal
        payload["portalPii"] = portal_pii
        if advance_status and row.status in {"draft", "invitation_sent"}:
            row.status = "in_progress"
            payload["status"] = "in_progress"
        row.case_json = payload
        self._db.flush()
        # Return clear PII so the candidate UI can keep editing
        return self._to_case(row, include_pii=True)

    def submit_portal(self, token: str, portal: dict) -> dict:
        row = self._find_by_token(token)
        self._assert_not_expired(row)
        if not row.terms_accepted_at:
            raise InvalidDigitalOnboardingState(
                "Please accept the terms and conditions before submitting"
            )
        submitted = dict(portal)
        if not submitted.get("submittedAt"):
            submitted["submittedAt"] = datetime.now(timezone.utc).isoformat()
        payload = dict(row.case_json or {})
        existing_pii = payload.get("portalPii") if isinstance(payload.get("portalPii"), dict) else None
        masked_portal, portal_pii = mask_portal_for_storage(submitted, existing_pii)
        payload["portal"] = masked_portal
        payload["portalPii"] = portal_pii
        payload["status"] = "hr_review"
        row.status = "hr_review"
        row.case_json = payload
        self._db.flush()
        return self._to_case(row, include_pii=True)

    def _find_by_token(self, token: str) -> HrDigitalOnboarding:
        clean = (token or "").strip()
        if not clean:
            raise NotFoundException("Onboarding link not found")
        row = self._db.scalar(
            select(HrDigitalOnboarding).where(HrDigitalOnboarding.invitation_token == clean)
        )
        if row is None:
            # List-clear rewrites the DB token column; the original stays in case_json.
            for candidate in self._db.scalars(select(HrDigitalOnboarding)).all():
                inv = (candidate.case_json or {}).get("invitation") or {}
                if str(inv.get("token") or "").strip() == clean:
                    row = candidate
                    break
        if row is None:
            raise NotFoundException("Onboarding link not found")
        if row.is_deleted:
            self._restore_cleared_case(row, clean)
        return row

    def _restore_cleared_case(self, row: HrDigitalOnboarding, token: str) -> None:
        """Reactivate a case that was removed from the HR list so the invitation still works."""
        payload = dict(row.case_json or {})
        inv = dict(payload.get("invitation") or {})
        original_token = str(inv.get("token") or token).strip() or token
        original_code = str(payload.get("caseCode") or payload.get("case_code") or row.case_code)
        if "-DEL-" in original_code:
            original_code = original_code.split("-DEL-")[0]
        clash = self._db.scalar(
            select(HrDigitalOnboarding.id).where(
                HrDigitalOnboarding.tenant_id == row.tenant_id,
                HrDigitalOnboarding.case_code == original_code,
                HrDigitalOnboarding.is_deleted.is_(False),
                HrDigitalOnboarding.id != row.id,
            )
        )
        row.is_deleted = False
        row.deleted_at = None
        row.deleted_by = None
        row.invitation_token = original_token
        if clash is None and original_code:
            row.case_code = original_code[:40]
        payload["invitation"] = {**inv, "token": original_token}
        payload["caseCode"] = row.case_code
        row.case_json = payload
        self._db.flush()

    def _assert_not_expired(self, row: HrDigitalOnboarding) -> None:
        if row.invitation_expires_at and row.invitation_expires_at < datetime.now(timezone.utc):
            raise InvalidDigitalOnboardingState("This onboarding link has expired")

    def _to_case(self, row: HrDigitalOnboarding, *, include_pii: bool = False) -> dict:
        payload = dict(row.case_json or {})
        payload["id"] = str(row.id)
        payload["caseCode"] = row.case_code
        payload["status"] = row.status
        payload["candidateName"] = row.candidate_name or payload.get("candidateName") or ""
        email = row.candidate_email or payload.get("candidateEmail") or ""
        phone = str(payload.get("candidatePhone") or "")
        portal = payload.get("portal") if isinstance(payload.get("portal"), dict) else {}
        portal_pii = payload.get("portalPii") if isinstance(payload.get("portalPii"), dict) else {}

        if include_pii:
            payload["portal"] = restore_portal_pii(portal, portal_pii)
            # Restore clear contact fields for candidate session when available
            personal_pii = portal_pii.get("personal") if isinstance(portal_pii.get("personal"), dict) else {}
            if personal_pii.get("phone"):
                payload["candidatePhone"] = personal_pii["phone"]
            if personal_pii.get("personalEmail") or personal_pii.get("email"):
                payload["candidateEmail"] = (
                    personal_pii.get("personalEmail") or personal_pii.get("email") or email
                )
            else:
                payload["candidateEmail"] = email
        else:
            # HR / list responses: masked portal only; never leak portalPii
            payload["portal"] = apply_masks_to_portal(portal)
            payload["candidateEmail"] = mask_email(email) if email else email
            if phone:
                payload["candidatePhone"] = mask_phone(phone)
            payload.pop("portalPii", None)

        inv = dict(payload.get("invitation") or {})
        inv["token"] = row.invitation_token
        if row.invitation_expires_at:
            inv["expiresAt"] = row.invitation_expires_at.isoformat()
        payload["invitation"] = inv
        if row.terms_accepted_at:
            payload["termsAcceptedAt"] = row.terms_accepted_at.isoformat()
            payload["termsVersion"] = row.terms_version
        # Never return the clear-text sidecar in API payloads
        payload.pop("portalPii", None)
        return payload

    @staticmethod
    def _parse_dt(value) -> datetime | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        text = str(value).strip()
        if not text:
            return None
        try:
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
