"""Public careers board — list open roles and accept applications (HRMS tables only)."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.models.branch import OrgBranch
from modules.recruitment.models import (
    RecApplication,
    RecCandidate,
    RecJobRequisition,
    RecRecruitmentSource,
    RecResume,
)
from modules.recruitment.service.application_service import ApplicationService
from modules.recruitment.service.candidate_service import CandidateService
from modules.recruitment.service.resume_service import ResumeService

# apps/api/var/recruitment-resumes (stable across process cwd)
_UPLOAD_ROOT = Path(__file__).resolve().parents[4] / "var" / "recruitment-resumes"

_SYSTEM_USER = UUID("00000000-0000-0000-0000-000000000001")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
# ATS CandidateSource key — careers /careers apply
_CAREERS_SOURCE_CODE = "company_website"
_CAREERS_SOURCE_NAME = "Website"


def _public_ctx(tenant_id: UUID, company_id: UUID | None, branch_id: UUID | None) -> TenantContext:
    """System context for unauthenticated careers apply.

    Must pass recruitment company checks: ``user_type=system`` is not a platform
    admin, and ``all_companies=True`` with an empty allowlist previously caused
    ``Company scope mismatch``. Elevate for the recruitment module and pin to
    the job's company when known.
    """
    return TenantContext(
        tenant_id=tenant_id,
        user_id=_SYSTEM_USER,
        user_type="system",
        company_id=company_id,
        branch_id=branch_id,
        admin_module_keys=frozenset({"recruitment"}),
        scoped_company_ids=(company_id,) if company_id is not None else (),
        all_companies=False,
        tenant_wide=False,
    )


# Seed / demo requisition codes — never surface on the public careers board.
_DEMO_JOB_CODES = frozenset(
    {
        "JR-0001",
        "JR-0002",
        "JR-DASH-001",
        "JR-DASH-002",
        "JP-0001",
        "JP-0002",
        "JP-DASH-001",
        "JP-DASH-002",
    }
)


def _is_demo_job_code(code: str | None) -> bool:
    raw = (code or "").strip().upper()
    if not raw:
        return False
    if raw in _DEMO_JOB_CODES:
        return True
    return raw.startswith("JR-DASH-") or raw.startswith("JP-DASH-")


class PublicCareersService:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_open_roles(self) -> list[dict]:
        stmt = (
            select(RecJobRequisition)
            .where(
                RecJobRequisition.is_deleted.is_(False),
                RecJobRequisition.status == "open",
            )
            .order_by(RecJobRequisition.created_at.desc())
        )
        rows = [
            r
            for r in self._db.scalars(stmt).all()
            if not _is_demo_job_code(r.document_number)
            # Public careers board is for outsiders only (external postings).
            and str(getattr(r, "posting_audience", "external") or "external").lower()
            != "internal"
        ]
        branch_ids = {r.branch_id for r in rows if getattr(r, "branch_id", None)}
        branch_location: dict[UUID, str] = {}
        if branch_ids:
            for b in self._db.scalars(select(OrgBranch).where(OrgBranch.id.in_(branch_ids))).all():
                city = (b.city or "").strip()
                name = (b.branch_name or "").strip()
                label = city or name
                if label:
                    branch_location[b.id] = label
        return [
            {
                "id": str(r.id),
                "job_code": r.document_number,
                "title": r.requisition_title,
                "employment_type": r.employment_type,
                "priority": r.priority,
                "openings": r.openings_count,
                "filled": r.filled_count,
                "experience_min": float(r.min_experience_years) if r.min_experience_years is not None else None,
                "experience_max": float(r.max_experience_years) if r.max_experience_years is not None else None,
                "salary_min": float(r.salary_band_min) if r.salary_band_min is not None else None,
                "salary_max": float(r.salary_band_max) if r.salary_band_max is not None else None,
                "currency_code": r.currency_code or "INR",
                "description": (r.job_description or "").strip(),
                "justification": (r.justification or "").strip() or None,
                "target_hire_date": r.target_hire_date.isoformat() if r.target_hire_date else None,
                "location": branch_location.get(r.branch_id, ""),
                "department_id": str(r.department_id) if r.department_id else None,
                "posting_audience": str(getattr(r, "posting_audience", "external") or "external"),
            }
            for r in rows
        ]

    def apply(
        self,
        *,
        job_requisition_id: UUID,
        full_name: str,
        email: str,
        phone: str,
        resume_name: str | None = None,
        resume_text: str | None = None,
        resume_bytes: bytes | None = None,
        alternate_phone: str | None = None,
        gender: str | None = None,
        dob: str | None = None,
        address: str | None = None,
        state: str | None = None,
        pincode: str | None = None,
        current_company: str | None = None,
        current_designation: str | None = None,
        experience_years: float | None = None,
        expected_salary: float | None = None,
        notice_period_days: int | None = None,
        skills: list[str] | None = None,
        portfolio_url: str | None = None,
        linkedin_url: str | None = None,
    ) -> dict:
        name = (full_name or "").strip()
        mail = (email or "").strip().lower()
        mobile = re.sub(r"\D", "", phone or "")[-10:]
        if not name:
            raise AppException("Full name is required", status_code=400)
        if not _EMAIL_RE.match(mail):
            raise AppException("Valid email is required", status_code=400)
        if len(mobile) != 10:
            raise AppException("Valid 10-digit mobile is required", status_code=400)

        job = self._db.scalar(
            select(RecJobRequisition).where(
                RecJobRequisition.id == job_requisition_id,
                RecJobRequisition.is_deleted.is_(False),
            )
        )
        if job is None:
            raise NotFoundException("Job opening not found")
        if job.status != "open":
            raise AppException("This role is not open for applications", status_code=400)

        branch_id = self._resolve_branch_id(job)
        ctx = _public_ctx(job.tenant_id, job.company_id, branch_id)
        parts = name.split()
        first_name = parts[0]
        last_name = " ".join(parts[1:]) if len(parts) > 1 else "-"

        profile = self._build_profile_payload(
            alternate_phone=alternate_phone,
            gender=gender,
            dob=dob,
            address=address,
            state=state,
            pincode=pincode,
            current_company=current_company,
            current_designation=current_designation,
            experience_years=experience_years,
            expected_salary=expected_salary,
            notice_period_days=notice_period_days,
            skills=skills,
            portfolio_url=portfolio_url,
            linkedin_url=linkedin_url,
            resume_name=resume_name,
            resume_text=resume_text,
        )
        profile["source"] = _CAREERS_SOURCE_CODE

        source_id = self._ensure_careers_source(
            ctx, company_id=job.company_id, branch_id=branch_id
        )

        existing = self._db.scalar(
            select(RecCandidate).where(
                RecCandidate.tenant_id == job.tenant_id,
                RecCandidate.company_id == job.company_id,
                RecCandidate.email == mail,
                RecCandidate.is_deleted.is_(False),
            )
        )
        if existing is None:
            cand = CandidateService(self._db).create(
                ctx,
                company_id=job.company_id,
                branch_id=branch_id,
                first_name=first_name,
                last_name=last_name,
                full_name=name,
                email=mail,
                mobile=mobile,
                status="applied",
                current_employer=(current_company or "").strip() or None,
                current_title=(current_designation or "").strip() or None,
                total_experience_years=experience_years,
                recruitment_source_id=source_id,
            )
        else:
            cand = existing
            if mobile:
                cand.mobile = mobile
            cand.status = "applied"
            if source_id is not None:
                cand.recruitment_source_id = source_id

        self._apply_profile_to_candidate(cand, profile)

        dup = self._db.scalar(
            select(RecApplication).where(
                RecApplication.candidate_id == cand.id,
                RecApplication.job_requisition_id == job.id,
                RecApplication.is_deleted.is_(False),
                RecApplication.status == "active",
            )
        )
        if dup is not None:
            self._upsert_resume_profile(
                ctx=ctx,
                candidate_id=cand.id,
                company_id=job.company_id,
                branch_id=branch_id,
                resume_name=resume_name,
                resume_bytes=resume_bytes,
                resume_text=resume_text,
                profile=profile,
            )
            return {
                "candidate_id": str(cand.id),
                "candidate_code": cand.candidate_code,
                "application_id": str(dup.id),
                "application_code": dup.document_number,
                "stage": dup.current_stage_code or "sourced",
                "duplicate": True,
            }

        app = ApplicationService(self._db).create(
            ctx,
            branch_id=branch_id,
            company_id=job.company_id,
            candidate_id=cand.id,
            job_requisition_id=job.id,
            applied_at=datetime.now(timezone.utc),
            current_stage_code="sourced",
            status="active",
            recruitment_source_id=source_id,
        )

        self._upsert_resume_profile(
            ctx=ctx,
            candidate_id=cand.id,
            company_id=job.company_id,
            branch_id=branch_id,
            resume_name=resume_name,
            resume_bytes=resume_bytes,
            resume_text=resume_text,
            profile=profile,
        )

        return {
            "candidate_id": str(cand.id),
            "candidate_code": cand.candidate_code,
            "application_id": str(app.id),
            "application_code": app.document_number,
            "stage": "sourced",
            "duplicate": False,
            "careers_ref": str(uuid4())[:8],
        }

    @staticmethod
    def _build_profile_payload(
        *,
        alternate_phone: str | None,
        gender: str | None,
        dob: str | None,
        address: str | None,
        state: str | None,
        pincode: str | None,
        current_company: str | None,
        current_designation: str | None,
        experience_years: float | None,
        expected_salary: float | None,
        notice_period_days: int | None,
        skills: list[str] | None,
        portfolio_url: str | None,
        linkedin_url: str | None,
        resume_name: str | None,
        resume_text: str | None,
    ) -> dict:
        clean_skills = [
            s.strip()
            for s in (skills or [])
            if isinstance(s, str) and s.strip()
        ]
        alt = re.sub(r"\D", "", alternate_phone or "")[-10:]
        pin = re.sub(r"\D", "", pincode or "")[:6]
        location_parts = [
            p
            for p in [(address or "").strip(), (state or "").strip(), pin]
            if p
        ]
        out: dict = {
            "resume_file_name": (resume_name or "").strip() or None,
            "alternate_phone": alt or None,
            "gender": (gender or "").strip().lower() or None,
            "dob": (dob or "").strip() or None,
            "address": (address or "").strip() or None,
            "state": (state or "").strip() or None,
            "pincode": pin or None,
            "current_company": (current_company or "").strip() or None,
            "current_designation": (current_designation or "").strip() or None,
            "experience_years": experience_years,
            "expected_salary": expected_salary,
            "expected_ctc": expected_salary,
            "notice_period_days": notice_period_days,
            "skills": clean_skills,
            "portfolio_url": (portfolio_url or "").strip() or None,
            "linkedin_url": (linkedin_url or "").strip() or None,
            "location": ", ".join(location_parts) or None,
        }
        if resume_text:
            out["summary"] = resume_text[:500]
        return {k: v for k, v in out.items() if v not in (None, "", [])}

    @staticmethod
    def _apply_profile_to_candidate(cand: RecCandidate, profile: dict) -> None:
        if profile.get("current_company"):
            cand.current_employer = str(profile["current_company"])[:255]
        if profile.get("current_designation"):
            cand.current_title = str(profile["current_designation"])[:255]
        if profile.get("experience_years") is not None:
            try:
                cand.total_experience_years = Decimal(str(profile["experience_years"]))
            except (InvalidOperation, ValueError, TypeError):
                pass
        # Keep a compact skills line for ATS sync fallbacks when resume join misses
        skills = profile.get("skills") if isinstance(profile.get("skills"), list) else []
        if skills:
            skills_line = f"Skills: {', '.join(str(s) for s in skills[:20])}"
            edu = (cand.highest_education or "").strip()
            if "Skills:" not in edu:
                cand.highest_education = (
                    f"{edu} | {skills_line}".strip(" |")[:255] if edu else skills_line[:255]
                )

    def _upsert_resume_profile(
        self,
        *,
        ctx: TenantContext,
        candidate_id: UUID,
        company_id: UUID | None,
        branch_id: UUID | None,
        resume_name: str | None,
        resume_bytes: bytes | None,
        resume_text: str | None,
        profile: dict,
    ) -> None:
        """Always persist profile JSON on rec_resume; attach file bytes when provided."""
        if resume_bytes and resume_name:
            self._store_resume_file(
                ctx=ctx,
                candidate_id=candidate_id,
                company_id=company_id,
                branch_id=branch_id,
                resume_name=resume_name,
                resume_bytes=resume_bytes,
                resume_text=resume_text,
                profile=profile,
            )
            return
        if not profile:
            return
        # Profile-only apply — tiny text marker so storage_uri is valid
        marker = json.dumps({"profile": True, **profile}, ensure_ascii=False).encode("utf-8")
        self._store_resume_file(
            ctx=ctx,
            candidate_id=candidate_id,
            company_id=company_id,
            branch_id=branch_id,
            resume_name="application-profile.json",
            resume_bytes=marker,
            resume_text=None,
            profile=profile,
        )

    def _ensure_careers_source(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None,
        branch_id: UUID,
    ) -> UUID | None:
        """Get-or-create the Website recruitment source for careers applications."""
        if company_id is None:
            return None
        existing = self._db.scalar(
            select(RecRecruitmentSource).where(
                RecRecruitmentSource.tenant_id == ctx.tenant_id,
                RecRecruitmentSource.company_id == company_id,
                RecRecruitmentSource.source_code == _CAREERS_SOURCE_CODE,
                RecRecruitmentSource.is_deleted.is_(False),
            )
        )
        if existing is not None:
            if not existing.is_active or existing.status != "active":
                existing.is_active = True
                existing.status = "active"
                existing.updated_by = ctx.user_id
            return existing.id
        row = RecRecruitmentSource(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            source_code=_CAREERS_SOURCE_CODE,
            source_name=_CAREERS_SOURCE_NAME,
            source_type="organic",
            is_active=True,
            status="active",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._db.add(row)
        self._db.flush()
        return row.id

    def _resolve_branch_id(self, job: RecJobRequisition) -> UUID:
        """Applications require a real org_branch FK — resolve from job or company."""
        if job.branch_id is not None:
            branch = self._db.get(OrgBranch, job.branch_id)
            if branch is not None and not getattr(branch, "is_deleted", False):
                return job.branch_id
        stmt = select(OrgBranch).where(
            OrgBranch.tenant_id == job.tenant_id,
            OrgBranch.is_deleted.is_(False),
        )
        if job.company_id is not None:
            stmt = stmt.where(OrgBranch.company_id == job.company_id)
        branch = self._db.scalar(stmt.limit(1))
        if branch is None:
            raise AppException(
                "This job opening is missing a branch. Ask HR to set the company branch on the requisition.",
                status_code=400,
            )
        return branch.id

    def _store_resume_file(
        self,
        *,
        ctx: TenantContext,
        candidate_id: UUID,
        company_id: UUID | None,
        branch_id: UUID | None,
        resume_name: str,
        resume_bytes: bytes,
        resume_text: str | None,
        profile: dict | None = None,
    ) -> None:
        """Persist careers resume to disk + rec_resume so HR can preview/download."""
        safe_name = re.sub(r"[^\w.\- ]+", "_", resume_name).strip() or "resume.pdf"
        dest_dir = _UPLOAD_ROOT / str(company_id or "unknown") / str(candidate_id)
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f"{uuid4().hex[:12]}_{safe_name}"
        dest.write_bytes(resume_bytes)

        existing = list(
            self._db.scalars(
                select(RecResume).where(
                    RecResume.candidate_id == candidate_id,
                    RecResume.is_deleted.is_(False),
                )
            ).all()
        )
        next_version = (max((r.version_no for r in existing), default=0) + 1) if existing else 1
        for row in existing:
            if row.is_primary:
                row.is_primary = False
                row.status = "superseded"

        parsed: dict = dict(profile or {})
        parsed["resume_file_name"] = safe_name
        if resume_text and not parsed.get("summary"):
            parsed["summary"] = resume_text[:500]

        ResumeService(self._db).create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            candidate_id=candidate_id,
            version_no=next_version,
            storage_uri=str(dest.resolve()),
            content_hash=hashlib.sha256(resume_bytes).hexdigest(),
            parsed_skills_json=parsed,
            is_primary=True,
            status="active",
        )
