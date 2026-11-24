"""BG document portal — candidate uploads gov IDs / personal details / docs before vendor email."""

from __future__ import annotations

import base64
import secrets
import string
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from core.config import settings
from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.notification_service import NotificationService
from modules.organization.models.branch import OrgBranch
from modules.recruitment.models import (
    RecApplication,
    RecBackgroundVerification,
    RecCandidate,
)
from modules.recruitment.service.application_service import ApplicationService
from modules.recruitment.service.background_verification_service import (
    BackgroundVerificationService,
)

_UPLOAD_ROOT = Path(__file__).resolve().parents[4] / "var" / "recruitment-bg-docs"
_SYSTEM_USER = UUID("00000000-0000-0000-0000-000000000001")
_TOKEN_ALPHABET = string.ascii_lowercase + string.digits
_INVITE_DAYS = 7
# Partner document download link lifetime (BG vendor pack).
_VENDOR_HOURS = 24


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_token() -> str:
    return secrets.token_hex(8)


def _new_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _scope(row: RecBackgroundVerification) -> dict:
    raw = row.verification_scope_json
    return dict(raw) if isinstance(raw, dict) else {}


def _portal(scope: dict) -> dict:
    p = scope.get("portal")
    return dict(p) if isinstance(p, dict) else {}


def _vendor_pack(scope: dict) -> dict:
    p = scope.get("vendorPack")
    return dict(p) if isinstance(p, dict) else {}


class PublicBgCheckService:
    def __init__(self, db: Session) -> None:
        self._db = db

    def create_portal_invite(
        self,
        ctx: TenantContext,
        *,
        application_id: UUID,
        expiry_days: int = _INVITE_DAYS,
        send_email: bool = True,
    ) -> dict:
        app = self._db.scalar(
            select(RecApplication).where(
                RecApplication.id == application_id,
                RecApplication.is_deleted.is_(False),
            )
        )
        if app is None:
            raise NotFoundException("Application not found")
        cand = self._db.get(RecCandidate, app.candidate_id)
        if cand is None or getattr(cand, "is_deleted", False):
            raise NotFoundException("Candidate not found")

        branch_id = app.branch_id or cand.branch_id
        if branch_id is None:
            branch = self._db.scalar(
                select(OrgBranch).where(
                    OrgBranch.company_id == app.company_id,
                    OrgBranch.is_deleted.is_(False),
                ).limit(1)
            )
            if branch is None:
                raise AppException("Branch required to start BG portal", status_code=400)
            branch_id = branch.id

        existing = self._db.scalar(
            select(RecBackgroundVerification).where(
                RecBackgroundVerification.application_id == application_id,
                RecBackgroundVerification.is_deleted.is_(False),
            )
        )

        token = _new_token()
        password = _new_password()
        expires = _utcnow() + timedelta(days=max(1, min(expiry_days, 30)))
        email = (cand.email or "").strip().lower()

        portal = {
            "token": token,
            "password": password,
            "loginEmail": email,
            "expiresAt": expires.isoformat(),
            "status": "docs_requested",
            "sentAt": _utcnow().isoformat(),
            "candidateId": str(cand.id),
            "applicationId": str(app.id),
            "candidateName": cand.full_name,
            "personal": {
                "fullName": cand.full_name or "",
                "email": email,
                "phone": cand.mobile or "",
                "address": "",
                "state": "",
                "pincode": "",
                "dob": "",
            },
            "governmentIds": {"aadhaar": "", "pan": ""},
            "documents": [],
            "submittedAt": None,
        }

        if existing is None:
            row = BackgroundVerificationService(self._db).create(
                ctx,
                branch_id=branch_id,
                company_id=app.company_id,
                candidate_id=cand.id,
                application_id=app.id,
                vendor_name=None,
                verification_scope_json={"portal": portal},
                initiated_at=_utcnow(),
                result="pending",
                status="draft",
            )
        else:
            scope = _scope(existing)
            prior = _portal(scope)
            # Keep submitted docs if re-sending invite before vendor mail
            if prior.get("documents") and prior.get("status") == "docs_submitted":
                portal["documents"] = prior.get("documents") or []
                portal["personal"] = prior.get("personal") or portal["personal"]
                portal["governmentIds"] = prior.get("governmentIds") or portal["governmentIds"]
                portal["status"] = "docs_submitted"
                portal["submittedAt"] = prior.get("submittedAt")
            scope["portal"] = portal
            existing.verification_scope_json = scope
            flag_modified(existing, "verification_scope_json")
            existing.initiated_at = existing.initiated_at or _utcnow()
            existing.updated_by = ctx.user_id
            self._db.flush()
            row = existing

        # Advance application to background_check when still earlier
        if (app.current_stage_code or "") == "hr_discussion":
            try:
                ApplicationService(self._db).advance(
                    ctx, app.id, stage="background_check"
                )
            except Exception:
                app.current_stage_code = "background_check"
                app.updated_by = ctx.user_id
                self._db.flush()

        base = (settings.frontend_url or "http://localhost:3000").rstrip("/")
        portal_url = f"{base}/bg-check/{token}"
        email_sent = False
        email_error: str | None = None
        # When send_email=False, portal + credentials are returned for bundling
        # with the offer letter email (offer + document link go together).
        if email and send_email:
            expires_label = expires.date().isoformat()
            body_text = (
                f"Hello {cand.full_name or 'there'},\n\n"
                "Please complete your document upload portal for background verification. "
                "We need your personal details and KYC documents (Aadhaar, PAN, marksheets, and more).\n\n"
                f"Portal link: {portal_url}\n"
                f"Email: {email}\n"
                f"Access code: {password}\n\n"
                f"This link expires on {expires_label}.\n\n"
                "Log in with the email and access code above to upload your documents. "
                "After you submit, HR will share them with our verification partner.\n\n"
                "- HR Team"
            )
            body_html = (
                "<div style=\"font-family:Segoe UI,Arial,sans-serif;font-size:14px;"
                "line-height:1.5;color:#111827\">"
                + "<br/>".join(
                    line if line else "<br/>"
                    for line in (
                        body_text.replace("&", "&amp;")
                        .replace("<", "&lt;")
                        .replace(">", "&gt;")
                        .split("\n")
                    )
                )
                + "</div>"
            )
            try:
                NotificationService(self._db).send_email(
                    tenant_id=ctx.tenant_id,
                    to_address=email,
                    subject=f"Document upload portal — {cand.full_name or 'candidate'}",
                    body_html=body_html,
                    event_type="recruitment.bg_check.portal_invite",
                    payload_json={
                        "application_id": str(app.id),
                        "token": token,
                        "portal_url": portal_url,
                    },
                    created_by=ctx.user_id,
                )
                email_sent = True
            except Exception as exc:  # noqa: BLE001 — invite must succeed even if mail fails
                email_error = str(exc)[:300]

        return {
            "bgv_id": str(row.id),
            "document_number": row.document_number,
            "token": token,
            "password": password,
            "login_email": email,
            "expires_at": expires.isoformat(),
            "candidate_name": cand.full_name,
            "candidate_email": email,
            "application_id": str(app.id),
            "portal_status": portal["status"],
            "portal_url": portal_url,
            "email_sent": email_sent,
            "email_error": email_error,
        }

    def get_by_token(self, token: str) -> dict:
        """Public meta only — full portal requires login_portal / access_token."""
        row = self._find_by_token(token)
        scope = _scope(row)
        portal = _portal(scope)
        self._assert_not_expired(portal)
        email = str(portal.get("loginEmail") or "").strip().lower()
        masked = ""
        if "@" in email:
            local, _, domain = email.partition("@")
            masked = f"{local[:2]}***@{domain}" if local else f"***@{domain}"
        return {
            "bgv_id": str(row.id),
            "document_number": row.document_number,
            "status": row.status,
            "login_required": True,
            "candidate_name": portal.get("candidateName") or None,
            "login_email_hint": masked or None,
            "expires_at": portal.get("expiresAt"),
            "portal": {
                "status": portal.get("status") or "docs_requested",
                "candidateName": portal.get("candidateName") or "",
                "expiresAt": portal.get("expiresAt"),
            },
        }

    def login_portal(self, token: str, *, login_email: str, password: str) -> dict:
        """Verify email + access code from the invite mail, then return portal + access token."""
        row = self._find_by_token(token)
        scope = _scope(row)
        portal = _portal(scope)
        self._assert_not_expired(portal)

        expected_email = str(portal.get("loginEmail") or "").strip().lower()
        expected_password = str(portal.get("password") or "")
        got_email = (login_email or "").strip().lower()
        got_password = (password or "").strip()

        if not expected_email or not expected_password:
            raise AppException("Portal credentials are not set. Contact HR.", status_code=400)
        if got_email != expected_email or got_password != expected_password:
            raise AppException("Invalid login email or access code.", status_code=401)

        access = secrets.token_urlsafe(24)
        portal["accessToken"] = access
        portal["accessGrantedAt"] = _utcnow().isoformat()
        scope["portal"] = portal
        row.verification_scope_json = scope
        flag_modified(row, "verification_scope_json")
        row.updated_by = _SYSTEM_USER
        self._db.add(row)
        self._db.flush()

        payload = self._public_portal_payload(row, portal)
        payload["access_token"] = access
        return payload

    def _require_access(self, portal: dict, access_token: str | None) -> None:
        expected = str(portal.get("accessToken") or "").strip()
        got = (access_token or "").strip()
        if not expected or not got or got != expected:
            raise AppException(
                "Login required. Enter the email and access code from your invite.",
                status_code=401,
            )

    def _public_portal_payload(self, row: RecBackgroundVerification, portal: dict) -> dict:
        safe = {**portal}
        safe.pop("password", None)
        safe.pop("accessToken", None)
        docs = []
        for d in portal.get("documents") or []:
            if not isinstance(d, dict):
                continue
            docs.append(
                {
                    "id": d.get("id"),
                    "kind": d.get("kind"),
                    "fileName": d.get("fileName"),
                    "mimeType": d.get("mimeType"),
                    "uploadedAt": d.get("uploadedAt"),
                    "hasFile": bool(d.get("storagePath") or d.get("fileDataUrl")),
                    # Keep file bytes for resume editing after login
                    "fileDataUrl": d.get("fileDataUrl") if d.get("fileDataUrl") else None,
                }
            )
        safe["documents"] = docs
        return {
            "bgv_id": str(row.id),
            "document_number": row.document_number,
            "status": row.status,
            "portal": safe,
        }

    def save_portal(self, token: str, portal_patch: dict, *, access_token: str | None = None) -> dict:
        row = self._find_by_token(token)
        scope = _scope(row)
        portal = _portal(scope)
        self._assert_not_expired(portal)
        self._require_access(portal, access_token)
        if portal.get("status") == "docs_submitted" and portal_patch.get("force") is not True:
            # Allow updates until vendor mailed — still editable while draft
            pass

        # Candidates cannot overwrite credentials via save payload
        locked_password = portal.get("password")
        locked_login = portal.get("loginEmail")
        locked_access = portal.get("accessToken")

        for key in ("personal", "governmentIds"):
            if isinstance(portal_patch.get(key), dict):
                portal[key] = {**(portal.get(key) or {}), **portal_patch[key]}

        incoming_docs = portal_patch.get("documents")
        if isinstance(incoming_docs, list):
            portal["documents"] = self._merge_documents(
                row=row,
                prior=list(portal.get("documents") or []),
                incoming=incoming_docs,
            )

        if portal.get("status") != "docs_submitted":
            portal["status"] = "docs_requested"
        portal["password"] = locked_password
        portal["loginEmail"] = locked_login
        portal["accessToken"] = locked_access
        scope["portal"] = portal
        row.verification_scope_json = scope
        flag_modified(row, "verification_scope_json")
        row.updated_by = _SYSTEM_USER
        self._db.flush()
        return self._public_portal_payload(row, portal)

    def submit_portal(
        self,
        token: str,
        portal_patch: dict | None = None,
        *,
        access_token: str | None = None,
    ) -> dict:
        if portal_patch:
            self.save_portal(token, portal_patch, access_token=access_token)
        row = self._find_by_token(token)
        scope = _scope(row)
        portal = _portal(scope)
        self._assert_not_expired(portal)
        self._require_access(portal, access_token)
        self._validate_submit(portal)
        portal["status"] = "docs_submitted"
        portal["submittedAt"] = _utcnow().isoformat()
        scope["portal"] = portal
        row.verification_scope_json = scope
        flag_modified(row, "verification_scope_json")
        row.status = "submitted"
        row.updated_by = _SYSTEM_USER
        self._db.flush()
        return self._public_portal_payload(row, portal)

    def list_attachments_for_application(
        self, ctx: TenantContext, application_id: UUID
    ) -> list[dict]:
        """Return base64 attachments for vendor BG email (HR auth)."""
        row = self._db.scalar(
            select(RecBackgroundVerification).where(
                RecBackgroundVerification.application_id == application_id,
                RecBackgroundVerification.is_deleted.is_(False),
            )
        )
        if row is None:
            return []
        return self._collect_vendor_documents(row)

    def create_vendor_pack(
        self,
        ctx: TenantContext,
        *,
        application_id: UUID,
        partner_email: str,
        expiry_hours: int = _VENDOR_HOURS,
    ) -> dict:
        """Create / refresh partner download credentials (no SMTP — HR composes the mail)."""
        partner = (partner_email or "").strip().lower()
        if "@" not in partner:
            raise AppException("Partner email is required", status_code=400)

        app = self._db.scalar(
            select(RecApplication).where(
                RecApplication.id == application_id,
                RecApplication.is_deleted.is_(False),
            )
        )
        if app is None:
            raise NotFoundException("Application not found")
        cand = self._db.get(RecCandidate, app.candidate_id)
        if cand is None or getattr(cand, "is_deleted", False):
            raise NotFoundException("Candidate not found")

        branch_id = app.branch_id or cand.branch_id
        if branch_id is None:
            branch = self._db.scalar(
                select(OrgBranch)
                .where(
                    OrgBranch.company_id == app.company_id,
                    OrgBranch.is_deleted.is_(False),
                )
                .limit(1)
            )
            if branch is None:
                raise AppException("Branch required for BG vendor pack", status_code=400)
            branch_id = branch.id

        existing = self._db.scalar(
            select(RecBackgroundVerification).where(
                RecBackgroundVerification.application_id == application_id,
                RecBackgroundVerification.is_deleted.is_(False),
            )
        )

        token = _new_token()
        password = _new_password()
        hours = max(1, min(int(expiry_hours or _VENDOR_HOURS), 168))
        expires = _utcnow() + timedelta(hours=hours)
        pack = {
            "token": token,
            "password": password,
            "loginEmail": partner,
            "expiresAt": expires.isoformat(),
            "sentAt": _utcnow().isoformat(),
            "expiryHours": hours,
            "candidateId": str(cand.id),
            "applicationId": str(app.id),
            "candidateName": cand.full_name,
            "accessToken": None,
            "accessTokenAt": None,
        }

        if existing is None:
            row = BackgroundVerificationService(self._db).create(
                ctx,
                branch_id=branch_id,
                company_id=app.company_id,
                candidate_id=cand.id,
                application_id=app.id,
                vendor_name=partner,
                verification_scope_json={"vendorPack": pack},
                initiated_at=_utcnow(),
                result="pending",
                status="in_progress",
            )
        else:
            scope = _scope(existing)
            scope["vendorPack"] = pack
            existing.verification_scope_json = scope
            flag_modified(existing, "verification_scope_json")
            existing.vendor_name = partner
            if existing.status in {"draft", "submitted"}:
                existing.status = "in_progress"
            existing.updated_by = ctx.user_id
            self._db.flush()
            row = existing

        docs = self._collect_vendor_documents(row)
        base = (settings.frontend_url or "http://localhost:3000").rstrip("/")
        portal_url = f"{base}/bg-vendor/{token}"
        return {
            "bgv_id": str(row.id),
            "application_id": str(app.id),
            "token": token,
            "password": password,
            "login_email": partner,
            "expires_at": expires.isoformat(),
            "candidate_name": cand.full_name,
            "candidate_email": (cand.email or "").strip().lower(),
            "portal_url": portal_url,
            "document_count": len(docs),
        }

    def get_vendor_meta(self, token: str) -> dict:
        row = self._find_by_vendor_token(token)
        pack = _vendor_pack(_scope(row))
        self._assert_vendor_not_expired(pack)
        email = str(pack.get("loginEmail") or "").strip().lower()
        masked = ""
        if "@" in email:
            local, _, domain = email.partition("@")
            masked = f"{local[:2]}***@{domain}" if local else f"***@{domain}"
        return {
            "bgv_id": str(row.id),
            "login_required": True,
            "candidate_name": pack.get("candidateName") or None,
            "login_email_hint": masked or None,
            "expires_at": pack.get("expiresAt"),
            "document_count": len(self._list_vendor_doc_meta(row)),
        }

    def login_vendor(self, token: str, *, login_email: str, password: str) -> dict:
        row = self._find_by_vendor_token(token)
        scope = _scope(row)
        pack = _vendor_pack(scope)
        self._assert_vendor_not_expired(pack)
        expected_email = str(pack.get("loginEmail") or "").strip().lower()
        expected_password = str(pack.get("password") or "")
        got_email = (login_email or "").strip().lower()
        got_password = (password or "").strip()
        if not expected_email or not expected_password:
            raise AppException("Portal credentials are not set. Contact HR.", status_code=400)
        if got_email != expected_email or got_password != expected_password:
            raise AppException("Invalid email or access code", status_code=401)
        access = secrets.token_urlsafe(24)
        pack["accessToken"] = access
        pack["accessTokenAt"] = _utcnow().isoformat()
        scope["vendorPack"] = pack
        row.verification_scope_json = scope
        flag_modified(row, "verification_scope_json")
        self._db.flush()
        return {
            "bgv_id": str(row.id),
            "access_token": access,
            "candidate_name": pack.get("candidateName"),
            "expires_at": pack.get("expiresAt"),
            "documents": self._list_vendor_doc_meta(row),
        }

    def list_vendor_documents(self, token: str, *, access_token: str | None) -> list[dict]:
        row = self._find_by_vendor_token(token)
        pack = _vendor_pack(_scope(row))
        self._assert_vendor_not_expired(pack)
        self._require_vendor_access(pack, access_token)
        return self._list_vendor_doc_meta(row)

    def get_vendor_document(
        self, token: str, doc_id: str, *, access_token: str | None
    ) -> dict:
        row = self._find_by_vendor_token(token)
        pack = _vendor_pack(_scope(row))
        self._assert_vendor_not_expired(pack)
        self._require_vendor_access(pack, access_token)
        clean_id = (doc_id or "").strip()
        for d in self._iter_portal_docs(row):
            if str(d.get("id") or "") != clean_id:
                continue
            att = self._doc_to_attachment(d)
            if not att:
                raise NotFoundException("Document file not available")
            return {
                "id": clean_id,
                "filename": self._vendor_download_filename(d),
                "content_base64": att["content_base64"],
                "content_type": att["content_type"],
                "kind": att.get("kind"),
            }
        raise NotFoundException("Document not found")

    def _require_vendor_access(self, pack: dict, access_token: str | None) -> None:
        expected = str(pack.get("accessToken") or "").strip()
        got = (access_token or "").strip()
        if not expected or not got or expected != got:
            raise AppException("Login required", status_code=401)

    def _assert_vendor_not_expired(self, pack: dict) -> None:
        raw = pack.get("expiresAt")
        if not raw:
            return
        try:
            exp = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            return
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < _utcnow():
            raise AppException(
                "This download link has expired. Please contact HR for a new link.",
                status_code=400,
            )

    def _find_by_vendor_token(self, token: str) -> RecBackgroundVerification:
        clean = (token or "").strip()
        if not clean:
            raise NotFoundException("BG vendor portal not found")
        rows = self._db.scalars(
            select(RecBackgroundVerification).where(
                RecBackgroundVerification.is_deleted.is_(False),
            )
        ).all()
        for row in rows:
            pack = _vendor_pack(_scope(row))
            if str(pack.get("token") or "") == clean:
                return row
        raise NotFoundException("BG vendor portal not found")

    @staticmethod
    def _stable_doc_id(doc: dict) -> str:
        existing = str(doc.get("id") or "").strip()
        if existing:
            return existing
        name = str(doc.get("fileName") or "document").strip().lower()
        kind = str(doc.get("kind") or "").strip().lower()
        return f"fn:{kind}:{name}" if kind else f"fn:{name}"

    def _iter_portal_docs(self, row: RecBackgroundVerification) -> list[dict]:
        """All portal uploads — keep every kind even when file names collide."""
        portal = _portal(_scope(row))
        docs = portal.get("documents") or []
        out: list[dict] = []
        seen_ids: set[str] = set()
        for d in docs:
            if not isinstance(d, dict):
                continue
            doc_id = self._stable_doc_id(d)
            if doc_id in seen_ids:
                continue
            seen_ids.add(doc_id)
            out.append({**d, "id": doc_id})
        return out

    @staticmethod
    def _vendor_download_filename(doc: dict) -> str:
        """Disambiguate shared names (e.g. two singature.jpg for Aadhaar + PAN)."""
        raw = str(doc.get("fileName") or "document.bin").strip() or "document.bin"
        kind = str(doc.get("kind") or "").strip()
        if not kind:
            return raw
        safe_kind = "".join(c if c.isalnum() or c in "-_" else "_" for c in kind)[:40]
        # Avoid double-prefix if already kind-prefixed
        if raw.lower().startswith(f"{safe_kind.lower()}__"):
            return raw
        return f"{safe_kind}__{raw}"

    def _list_vendor_doc_meta(self, row: RecBackgroundVerification) -> list[dict]:
        meta: list[dict] = []
        for d in self._iter_portal_docs(row):
            has_file = bool(d.get("storagePath") or d.get("fileDataUrl"))
            if not has_file:
                continue
            meta.append(
                {
                    "id": str(d.get("id")),
                    "filename": self._vendor_download_filename(d),
                    "content_type": str(d.get("mimeType") or "application/octet-stream"),
                    "kind": d.get("kind"),
                    "uploaded_at": d.get("uploadedAt"),
                }
            )
        return meta

    def _collect_vendor_documents(self, row: RecBackgroundVerification) -> list[dict]:
        out: list[dict] = []
        for d in self._iter_portal_docs(row):
            att = self._doc_to_attachment(d)
            if att:
                att = {**att, "filename": self._vendor_download_filename(d)}
                out.append({**att, "id": str(d.get("id") or "")})
        return out

    def get_portal_status_for_application(
        self, ctx: TenantContext, application_id: UUID
    ) -> dict | None:
        row = self._db.scalar(
            select(RecBackgroundVerification).where(
                RecBackgroundVerification.application_id == application_id,
                RecBackgroundVerification.is_deleted.is_(False),
            )
        )
        if row is None:
            return None
        return self._status_payload(row)

    def review_portal_for_application(
        self,
        ctx: TenantContext,
        application_id: UUID,
        *,
        decision: str,
    ) -> dict:
        """HR verifies or rejects candidate BG portal documents."""
        decision_norm = (decision or "").strip().lower()
        if decision_norm in {"verified", "cleared", "approve", "approved", "clear"}:
            portal_status = "verified"
            row_status = "cleared"
            result = "clear"
        elif decision_norm in {"rejected", "reject", "failed", "fail", "adverse"}:
            portal_status = "rejected"
            row_status = "failed"
            result = "adverse"
        else:
            raise AppException(
                "decision must be verified or rejected",
                status_code=400,
            )

        row = self._db.scalar(
            select(RecBackgroundVerification).where(
                RecBackgroundVerification.application_id == application_id,
                RecBackgroundVerification.is_deleted.is_(False),
            )
        )
        if row is None:
            raise NotFoundException("BG document portal not found for this application")

        scope = _scope(row)
        portal = _portal(scope)
        if not portal.get("token"):
            raise AppException("No BG portal invite exists yet", status_code=400)

        portal["status"] = portal_status
        portal["reviewedAt"] = _utcnow().isoformat()
        portal["reviewedDecision"] = portal_status
        scope["portal"] = portal
        row.verification_scope_json = scope
        flag_modified(row, "verification_scope_json")
        row.status = row_status
        row.result = result
        row.updated_by = ctx.user_id
        self._db.add(row)
        self._db.flush()
        self._db.refresh(row)
        return self._status_payload(row)

    def _status_payload(self, row: RecBackgroundVerification) -> dict:
        portal = _portal(_scope(row))
        token = str(portal.get("token") or "").strip()
        base = (settings.frontend_url or "http://localhost:3000").rstrip("/")
        portal_url = f"{base}/bg-check/{token}" if token else None
        docs_meta: list[dict] = []
        for d in portal.get("documents") or []:
            if not isinstance(d, dict):
                continue
            docs_meta.append(
                {
                    "id": d.get("id"),
                    "kind": d.get("kind"),
                    "fileName": d.get("fileName"),
                    "mimeType": d.get("mimeType"),
                    "uploadedAt": d.get("uploadedAt"),
                    "hasFile": bool(d.get("storagePath") or d.get("fileDataUrl")),
                }
            )
        personal = portal.get("personal") if isinstance(portal.get("personal"), dict) else {}
        gov = (
            portal.get("governmentIds")
            if isinstance(portal.get("governmentIds"), dict)
            else {}
        )
        # Prefer HR review / portal status; fall back to BGV row status
        status = str(portal.get("status") or row.status or "")
        if row.status == "cleared" and status not in {"verified", "rejected"}:
            status = "verified"
        elif row.status == "failed" and status not in {"verified", "rejected"}:
            status = "rejected"
        # Never expose portal link / login email / access code to HR clients.
        _ = portal_url
        return {
            "bgv_id": str(row.id),
            "status": status,
            "submitted_at": portal.get("submittedAt"),
            "document_count": len(docs_meta),
            "expires_at": portal.get("expiresAt"),
            "has_portal": bool(token),
            "candidate_name": portal.get("candidateName") or None,
            "sent_at": portal.get("sentAt") or None,
            "personal": {
                "fullName": personal.get("fullName") or "",
                "email": personal.get("email") or "",
                "phone": personal.get("phone") or "",
                "address": personal.get("address") or "",
                "state": personal.get("state") or "",
                "pincode": personal.get("pincode") or "",
                "dob": personal.get("dob") or "",
            },
            "government_ids": {
                "aadhaar": gov.get("aadhaar") or "",
                "pan": gov.get("pan") or "",
            },
            "documents": docs_meta,
        }

    def _find_by_token(self, token: str) -> RecBackgroundVerification:
        clean = (token or "").strip()
        if not clean:
            raise NotFoundException("BG portal not found")
        rows = self._db.scalars(
            select(RecBackgroundVerification).where(
                RecBackgroundVerification.is_deleted.is_(False),
            )
        ).all()
        for row in rows:
            portal = _portal(_scope(row))
            if str(portal.get("token") or "") == clean:
                return row
        raise NotFoundException("BG portal not found")

    def _assert_not_expired(self, portal: dict) -> None:
        raw = portal.get("expiresAt")
        if not raw:
            return
        try:
            exp = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            return
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < _utcnow():
            raise AppException(
                "This BG document link has expired. Please contact HR for a new link.",
                status_code=400,
            )

    def _validate_submit(self, portal: dict) -> None:
        personal = portal.get("personal") if isinstance(portal.get("personal"), dict) else {}
        gov = portal.get("governmentIds") if isinstance(portal.get("governmentIds"), dict) else {}
        docs = portal.get("documents") if isinstance(portal.get("documents"), list) else []
        if not str(personal.get("fullName") or "").strip():
            raise AppException("Full name is required", status_code=400)
        if not str(personal.get("phone") or "").strip():
            raise AppException("Phone is required", status_code=400)
        aadhaar = "".join(c for c in str(gov.get("aadhaar") or "") if c.isdigit())
        pan = str(gov.get("pan") or "").strip().upper()
        if len(aadhaar) != 12:
            raise AppException("Valid 12-digit Aadhaar is required", status_code=400)
        if len(pan) != 10:
            raise AppException("Valid PAN is required", status_code=400)
        kinds = {str(d.get("kind") or "") for d in docs if isinstance(d, dict)}
        if "aadhaar_card" not in kinds:
            raise AppException("Please upload Aadhaar card scan", status_code=400)
        if "pan_card" not in kinds:
            raise AppException("Please upload PAN card scan", status_code=400)

    def _merge_documents(
        self,
        *,
        row: RecBackgroundVerification,
        prior: list,
        incoming: list,
    ) -> list[dict]:
        by_id = {
            str(d.get("id")): d
            for d in prior
            if isinstance(d, dict) and d.get("id")
        }
        out: list[dict] = []
        for doc in incoming:
            if not isinstance(doc, dict):
                continue
            doc_id = str(doc.get("id") or uuid4())
            prior_doc = by_id.get(doc_id)
            file_url = str(doc.get("fileDataUrl") or "").strip()
            stored = dict(doc)
            stored["id"] = doc_id
            if file_url.startswith("data:"):
                path = self._persist_data_url(
                    company_id=row.company_id,
                    candidate_id=row.candidate_id,
                    doc_id=doc_id,
                    file_name=str(doc.get("fileName") or "document.bin"),
                    data_url=file_url,
                )
                stored["storagePath"] = path
                stored.pop("fileDataUrl", None)
            elif prior_doc and prior_doc.get("storagePath"):
                stored["storagePath"] = prior_doc["storagePath"]
                stored.pop("fileDataUrl", None)
            out.append(stored)
        return out

    def _persist_data_url(
        self,
        *,
        company_id: UUID,
        candidate_id: UUID,
        doc_id: str,
        file_name: str,
        data_url: str,
    ) -> str:
        comma = data_url.find(",")
        if comma < 0:
            raise AppException("Invalid file payload", status_code=400)
        header = data_url[:comma]
        payload = data_url[comma + 1 :]
        try:
            raw = base64.b64decode(payload, validate=False)
        except Exception as exc:  # noqa: BLE001
            raise AppException("Could not decode uploaded file", status_code=400) from exc
        if len(raw) > 15 * 1024 * 1024:
            raise AppException("File too large (max 15 MB)", status_code=400)
        safe = "".join(c if c.isalnum() or c in "._-" else "_" for c in file_name)[:120]
        dest_dir = _UPLOAD_ROOT / str(company_id) / str(candidate_id)
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f"{doc_id[:8]}_{safe}"
        dest.write_bytes(raw)
        # stash mime hint beside path via filename only
        _ = header
        return str(dest.resolve())

    def _doc_to_attachment(self, doc: dict) -> dict | None:
        name = str(doc.get("fileName") or "document.pdf")
        mime = str(doc.get("mimeType") or "application/octet-stream")
        path = str(doc.get("storagePath") or "").strip()
        data_url = str(doc.get("fileDataUrl") or "").strip()
        if path:
            p = Path(path)
            if not p.is_file():
                return None
            raw = p.read_bytes()
            return {
                "filename": name,
                "content_base64": base64.b64encode(raw).decode("ascii"),
                "content_type": mime,
                "kind": doc.get("kind"),
            }
        if data_url.startswith("data:"):
            comma = data_url.find(",")
            if comma < 0:
                return None
            payload = data_url[comma + 1 :]
            return {
                "filename": name,
                "content_base64": payload,
                "content_type": mime,
                "kind": doc.get("kind"),
            }
        return None
