"""Recruitment REST routers."""

from typing import Annotated
from uuid import UUID

from pathlib import Path

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException, ValidationException
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.recruitment.adapters.hr_port import RecruitmentHrAdapter
from modules.recruitment.adapters.organization_port import RecruitmentOrganizationAdapter
from modules.recruitment.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_db,
    get_pagination,
    paginate,
)
from modules.recruitment.models import RecRecruitmentSource, RecResume
from modules.recruitment.schemas import (
    ApplicationAdvanceRequest,
    ApplicationBackOutRequest,
    ApplicationCreate,
    ApplicationRejectRequest,
    ApplicationResponse,
    ApplicationStageCreate,
    ApplicationStageResponse,
    ApplicationStageUpdate,
    ApplicationUpdate,
    PipelineStatsResponse,
    BackgroundVerificationCreate,
    BackgroundVerificationResponse,
    BackgroundVerificationUpdate,
    CandidateCreate,
    CandidateDocumentCreate,
    CandidateDocumentResponse,
    CandidateDocumentUpdate,
    CandidateNoteCreate,
    CandidateNoteResponse,
    CandidateNoteUpdate,
    CandidateResponse,
    CandidateUpdate,
    InterviewCreate,
    InterviewFeedbackCreate,
    InterviewFeedbackResponse,
    InterviewFeedbackUpdate,
    InterviewResponse,
    InterviewUpdate,
    JobPostingCreate,
    JobPostingResponse,
    JobPostingUpdate,
    JobFormLookupOption,
    JobFormLookupsResponse,
    JobRequisitionCreate,
    JobRequisitionResponse,
    JobRequisitionUpdate,
    OfferApprovalCreate,
    OfferApprovalResponse,
    OfferApprovalUpdate,
    OfferCreate,
    OfferResponse,
    OfferUpdate,
    OnboardingCompleteRequest,
    OnboardingCreate,
    OnboardingResponse,
    OnboardingTaskCreate,
    OnboardingTaskResponse,
    OnboardingTaskUpdate,
    OnboardingUpdate,
    RecruiterCreate,
    RecruiterResponse,
    RecruiterUpdate,
    RecruitmentReportCreate,
    RecruitmentReportResponse,
    RecruitmentReportUpdate,
    RecruitmentSourceCreate,
    RecruitmentSourceResponse,
    RecruitmentSourceUpdate,
    ReferenceCheckCreate,
    ReferenceCheckResponse,
    ReferenceCheckUpdate,
    ResumeCreate,
    ResumeResponse,
    ResumeUpdate,
    TalentPoolCreate,
    TalentPoolResponse,
    TalentPoolUpdate,
)
from modules.recruitment.service.public_bg_check_service import PublicBgCheckService
from modules.recruitment.service import (
    ApplicationService,
    ApplicationStageService,
    BackgroundVerificationService,
    CandidateDocumentService,
    CandidateNoteService,
    CandidateService,
    InterviewFeedbackService,
    InterviewService,
    JobPostingService,
    JobRequisitionService,
    OfferApprovalService,
    OfferService,
    OnboardingService,
    OnboardingTaskService,
    RecruiterService,
    RecruitmentReportService,
    RecruitmentSourceService,
    ReferenceCheckService,
    ResumeService,
    TalentPoolService,
)
from shared.schemas import APIResponse

lookups_router = APIRouter(prefix="/lookups", tags=["Recruitment - Lookups"])
job_requisitions_router = APIRouter(prefix="/job-requisitions", tags=["Recruitment - JobRequisition"])
job_postings_router = APIRouter(prefix="/job-postings", tags=["Recruitment - JobPosting"])
recruitment_sources_router = APIRouter(prefix="/recruitment-sources", tags=["Recruitment - RecruitmentSource"])
recruiters_router = APIRouter(prefix="/recruiters", tags=["Recruitment - Recruiter"])
candidates_router = APIRouter(prefix="/candidates", tags=["Recruitment - Candidate"])
candidate_documents_router = APIRouter(prefix="/candidate-documents", tags=["Recruitment - CandidateDocument"])
resumes_router = APIRouter(prefix="/resumes", tags=["Recruitment - Resume"])
applications_router = APIRouter(prefix="/applications", tags=["Recruitment - Application"])
application_stages_router = APIRouter(prefix="/application-stages", tags=["Recruitment - ApplicationStage"])
interviews_router = APIRouter(prefix="/interviews", tags=["Recruitment - Interview"])
interview_feedback_router = APIRouter(prefix="/interview-feedback", tags=["Recruitment - InterviewFeedback"])
offers_router = APIRouter(prefix="/offers", tags=["Recruitment - Offer"])
offer_approvals_router = APIRouter(prefix="/offer-approvals", tags=["Recruitment - OfferApproval"])
background_verifications_router = APIRouter(prefix="/background-verifications", tags=["Recruitment - BackgroundVerification"])
reference_checks_router = APIRouter(prefix="/reference-checks", tags=["Recruitment - ReferenceCheck"])
talent_pools_router = APIRouter(prefix="/talent-pools", tags=["Recruitment - TalentPool"])
candidate_notes_router = APIRouter(prefix="/candidate-notes", tags=["Recruitment - CandidateNote"])
onboarding_router = APIRouter(prefix="/onboarding", tags=["Recruitment - Onboarding"])
onboarding_tasks_router = APIRouter(prefix="/onboarding-tasks", tags=["Recruitment - OnboardingTask"])
reports_router = APIRouter(prefix="/reports", tags=["Recruitment - RecruitmentReport"])


@lookups_router.get("/job-form", response_model=APIResponse[JobFormLookupsResponse])
def get_job_form_lookups(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.requisition:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: Annotated[UUID | None, Query()] = None,
    branch_id: Annotated[UUID | None, Query()] = None,
):
    org = RecruitmentOrganizationAdapter(db)
    hr = RecruitmentHrAdapter(db)
    dept_rows = org.list_departments(ctx, company_id=company_id, branch_id=branch_id)
    departments = [
        JobFormLookupOption(
            id=d.id,
            name=d.department_name,
            company_id=d.company_id,
            branch_id=d.branch_id,
        )
        for d in dept_rows
        if str(getattr(d, "status", "active") or "active").lower() == "active"
    ]
    departments.sort(key=lambda d: d.name.lower())
    desig_rows = hr.list_designations(ctx, company_id)
    designations = [
        JobFormLookupOption(
            id=r.id,
            name=r.designation_name,
            company_id=r.company_id,
            branch_id=getattr(r, "branch_id", None),
        )
        for r in desig_rows
        if str(getattr(r, "status", "active") or "active").lower() == "active"
    ]
    designations.sort(key=lambda d: d.name.lower())
    return APIResponse(
        message="OK",
        data=JobFormLookupsResponse(departments=departments, designations=designations),
    )


@job_requisitions_router.get("", response_model=APIResponse[list[JobRequisitionResponse]])
def list_job_requisitions(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.requisition:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(JobRequisitionService(db).list(ctx, company_id), pagination))

@job_requisitions_router.post("", response_model=APIResponse[JobRequisitionResponse])
def create_job_requisitions(
    body: JobRequisitionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.requisition:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=JobRequisitionService(db).create(ctx, **body.model_dump()))

@job_requisitions_router.patch("/{row_id}", response_model=APIResponse[JobRequisitionResponse])
def update_job_requisitions(
    row_id: UUID,
    body: JobRequisitionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.requisition:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=JobRequisitionService(db).update(ctx, row_id, **extract_update_fields(body)))

@job_requisitions_router.post("/{row_id}/submit", response_model=APIResponse[JobRequisitionResponse])
def submit_job_requisitions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.requisition:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Submitted", data=JobRequisitionService(db).submit(ctx, row_id))

@job_requisitions_router.post("/{row_id}/approve", response_model=APIResponse[JobRequisitionResponse])
def approve_job_requisitions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.requisition:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Approved", data=JobRequisitionService(db).approve(ctx, row_id))

@job_requisitions_router.post("/{row_id}/open", response_model=APIResponse[JobRequisitionResponse])
def open_job_requisitions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.requisition:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Opened", data=JobRequisitionService(db).open(ctx, row_id))

@job_requisitions_router.post(
    "/{row_id}/approval-evidence",
    response_model=APIResponse[JobRequisitionResponse],
)
async def upload_job_requisition_approval_evidence(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.requisition:update"))],
    db: Annotated[Session, Depends(get_db)],
    file: Annotated[UploadFile, File(...)],
):
    raw = await file.read()
    if not raw:
        raise ValidationException("Evidence file is empty")
    name = (file.filename or "").strip() or "approval-email.bin"
    return APIResponse(
        message="Evidence saved",
        data=JobRequisitionService(db).attach_approval_evidence(
            ctx,
            row_id,
            file_name=name,
            content=raw,
        ),
    )

@job_postings_router.get("", response_model=APIResponse[list[JobPostingResponse]])
def list_job_postings(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.posting:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(JobPostingService(db).list(ctx, company_id), pagination))

@job_postings_router.post("", response_model=APIResponse[JobPostingResponse])
def create_job_postings(
    body: JobPostingCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.posting:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=JobPostingService(db).create(ctx, **body.model_dump()))

@job_postings_router.patch("/{row_id}", response_model=APIResponse[JobPostingResponse])
def update_job_postings(
    row_id: UUID,
    body: JobPostingUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.posting:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=JobPostingService(db).update(ctx, row_id, **extract_update_fields(body)))

@job_postings_router.post("/{row_id}/publish", response_model=APIResponse[JobPostingResponse])
def publish_job_postings(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.posting:publish"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Published", data=JobPostingService(db).publish(ctx, row_id))

@recruitment_sources_router.get("", response_model=APIResponse[list[RecruitmentSourceResponse]])
def list_recruitment_sources(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.source:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(RecruitmentSourceService(db).list(ctx, company_id), pagination))

@recruitment_sources_router.post("", response_model=APIResponse[RecruitmentSourceResponse])
def create_recruitment_sources(
    body: RecruitmentSourceCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.source:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=RecruitmentSourceService(db).create(ctx, **body.model_dump()))

@recruitment_sources_router.patch("/{row_id}", response_model=APIResponse[RecruitmentSourceResponse])
def update_recruitment_sources(
    row_id: UUID,
    body: RecruitmentSourceUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.source:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=RecruitmentSourceService(db).update(ctx, row_id, **extract_update_fields(body)))

@recruiters_router.get("", response_model=APIResponse[list[RecruiterResponse]])
def list_recruiters(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.recruiter:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(RecruiterService(db).list(ctx, company_id), pagination))

@recruiters_router.post("", response_model=APIResponse[RecruiterResponse])
def create_recruiters(
    body: RecruiterCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.recruiter:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=RecruiterService(db).create(ctx, **body.model_dump()))

@recruiters_router.patch("/{row_id}", response_model=APIResponse[RecruiterResponse])
def update_recruiters(
    row_id: UUID,
    body: RecruiterUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.recruiter:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=RecruiterService(db).update(ctx, row_id, **extract_update_fields(body)))

def _primary_resume_profile_map(
    db: Session, candidate_ids: list[UUID]
) -> dict[UUID, dict]:
    """Map candidate_id → primary resume parsed profile (careers apply fields)."""
    if not candidate_ids:
        return {}
    resumes = list(
        db.scalars(
            select(RecResume)
            .where(
                RecResume.candidate_id.in_(candidate_ids),
                RecResume.is_deleted.is_(False),
            )
            .order_by(RecResume.is_primary.desc(), RecResume.version_no.desc())
        ).all()
    )
    out: dict[UUID, dict] = {}
    for resume in resumes:
        cid = resume.candidate_id
        if cid in out:
            continue
        parsed = resume.parsed_skills_json if isinstance(resume.parsed_skills_json, dict) else {}
        out[cid] = {
            "profile": parsed,
            "storage_uri": resume.storage_uri,
        }
    return out


def _candidate_responses_with_source(db: Session, rows: list) -> list[CandidateResponse]:
    """Attach source + careers profile fields so ATS Overview can hydrate without resume join."""
    source_ids = {
        r.recruitment_source_id for r in rows if getattr(r, "recruitment_source_id", None)
    }
    source_map: dict[UUID, RecRecruitmentSource] = {}
    if source_ids:
        for src in db.scalars(
            select(RecRecruitmentSource).where(
                RecRecruitmentSource.id.in_(list(source_ids)),
                RecRecruitmentSource.is_deleted.is_(False),
            )
        ).all():
            source_map[src.id] = src

    resume_map = _primary_resume_profile_map(db, [r.id for r in rows])

    out: list[CandidateResponse] = []
    for row in rows:
        payload = CandidateResponse.model_validate(row)
        updates: dict = {}
        src = source_map.get(row.recruitment_source_id) if row.recruitment_source_id else None
        if src is not None:
            updates["source_code"] = src.source_code
            updates["source_name"] = src.source_name
        # Careers portal creates candidates as system user — treat as Website when unset
        elif str(getattr(row, "created_by", "") or "") == "00000000-0000-0000-0000-000000000001":
            updates["source_code"] = "company_website"
            updates["source_name"] = "Website"

        resume_meta = resume_map.get(row.id) or {}
        profile = resume_meta.get("profile") if isinstance(resume_meta, dict) else {}
        if isinstance(profile, dict) and profile:
            skills = profile.get("skills") if isinstance(profile.get("skills"), list) else None
            resume_name = profile.get("resume_file_name")
            if not resume_name and resume_meta.get("storage_uri"):
                uri = str(resume_meta["storage_uri"])
                resume_name = uri.replace("\\", "/").rsplit("/", 1)[-1] or None
            expected = profile.get("expected_ctc", profile.get("expected_salary"))
            try:
                expected_ctc = float(expected) if expected is not None else None
            except (TypeError, ValueError):
                expected_ctc = None
            try:
                notice = (
                    int(profile["notice_period_days"])
                    if profile.get("notice_period_days") is not None
                    else None
                )
            except (TypeError, ValueError):
                notice = None
            updates.update(
                {
                    "gender": profile.get("gender") or None,
                    "date_of_birth": profile.get("dob") or profile.get("date_of_birth") or None,
                    "address": profile.get("address") or None,
                    "state": profile.get("state") or None,
                    "pincode": profile.get("pincode") or None,
                    "location": profile.get("location") or None,
                    "alternate_phone": profile.get("alternate_phone") or None,
                    "expected_ctc": expected_ctc,
                    "notice_period_days": notice,
                    "linkedin_url": profile.get("linkedin_url") or None,
                    "portfolio_url": profile.get("portfolio_url") or None,
                    "resume_name": resume_name,
                    "skills": [str(s).strip() for s in (skills or []) if str(s).strip()] or None,
                    "profile_json": profile,
                }
            )
            # Fill employer/title/experience from profile when candidate columns are empty
            if not (payload.current_employer or "").strip() and profile.get("current_company"):
                updates["current_employer"] = str(profile["current_company"])[:255]
            if not (payload.current_title or "").strip() and profile.get("current_designation"):
                updates["current_title"] = str(profile["current_designation"])[:255]
            if payload.total_experience_years is None and profile.get("experience_years") is not None:
                try:
                    updates["total_experience_years"] = profile["experience_years"]
                except (TypeError, ValueError):
                    pass

        if updates:
            payload = payload.model_copy(update=updates)
        out.append(payload)
    return out


@candidates_router.get("", response_model=APIResponse[list[CandidateResponse]])
def list_candidates(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.candidate:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = paginate(CandidateService(db).list(ctx, company_id), pagination)
    return APIResponse(message="OK", data=_candidate_responses_with_source(db, rows))

@candidates_router.get("/{row_id}/resume-file")
def download_candidate_resume_file(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.candidate:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    """Download the primary resume file stored for a candidate."""
    CandidateService(db).get(ctx, row_id)
    resumes = list(
        db.scalars(
            select(RecResume)
            .where(
                RecResume.candidate_id == row_id,
                RecResume.is_deleted.is_(False),
            )
            .order_by(RecResume.is_primary.desc(), RecResume.version_no.desc())
        ).all()
    )
    if not resumes:
        raise NotFoundException("Resume file not found")

    # apps/api and apps/api/src — cover both historical and current upload roots
    src_root = Path(__file__).resolve().parents[3]
    api_root = Path(__file__).resolve().parents[4]
    path: Path | None = None
    chosen_name = "resume.pdf"
    for row in resumes:
        raw = str(row.storage_uri or "").strip()
        if not raw:
            continue
        uri = Path(raw)
        candidates = [uri] if uri.is_absolute() else [api_root / uri, src_root / uri, uri]
        for candidate_path in candidates:
            try:
                resolved = candidate_path.resolve()
            except OSError:
                continue
            if resolved.is_file():
                path = resolved
                chosen_name = resolved.name
                break
        if path is not None:
            break
    if path is None:
        raise NotFoundException("Resume file missing on disk")

    suffix = path.suffix.lower()
    media = "application/pdf" if suffix == ".pdf" else "application/octet-stream"
    if suffix in {".doc", ".docx"}:
        media = "application/msword" if suffix == ".doc" else (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    return FileResponse(
        path,
        filename=chosen_name,
        media_type=media,
    )


@candidates_router.post("", response_model=APIResponse[CandidateResponse])
def create_candidates(
    body: CandidateCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.candidate:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=CandidateService(db).create(ctx, **body.model_dump()))

@candidates_router.patch("/{row_id}", response_model=APIResponse[CandidateResponse])
def update_candidates(
    row_id: UUID,
    body: CandidateUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.candidate:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=CandidateService(db).update(ctx, row_id, **extract_update_fields(body)))

@candidates_router.delete("/{row_id}", response_model=APIResponse[None])
def delete_candidates(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.candidate:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    message = CandidateService(db).delete(ctx, row_id)
    return APIResponse(message=message, data=None)

@candidate_documents_router.get("", response_model=APIResponse[list[CandidateDocumentResponse]])
def list_candidate_documents(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.candidate:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(CandidateDocumentService(db).list(ctx, company_id), pagination))

@candidate_documents_router.post("", response_model=APIResponse[CandidateDocumentResponse])
def create_candidate_documents(
    body: CandidateDocumentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.candidate:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=CandidateDocumentService(db).create(ctx, **body.model_dump()))

@candidate_documents_router.patch("/{row_id}", response_model=APIResponse[CandidateDocumentResponse])
def update_candidate_documents(
    row_id: UUID,
    body: CandidateDocumentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.candidate:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=CandidateDocumentService(db).update(ctx, row_id, **extract_update_fields(body)))

@resumes_router.get("", response_model=APIResponse[list[ResumeResponse]])
def list_resumes(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.candidate:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(ResumeService(db).list(ctx, company_id), pagination))

@resumes_router.post("", response_model=APIResponse[ResumeResponse])
def create_resumes(
    body: ResumeCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.candidate:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ResumeService(db).create(ctx, **body.model_dump()))

@resumes_router.patch("/{row_id}", response_model=APIResponse[ResumeResponse])
def update_resumes(
    row_id: UUID,
    body: ResumeUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.candidate:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ResumeService(db).update(ctx, row_id, **extract_update_fields(body)))

@applications_router.get("", response_model=APIResponse[list[ApplicationResponse]])
def list_applications(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.application:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(ApplicationService(db).list(ctx, company_id), pagination))

@applications_router.post("", response_model=APIResponse[ApplicationResponse])
def create_applications(
    body: ApplicationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.application:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = body.model_dump(exclude_none=True)
    if "applied_at" not in data:
        from datetime import datetime, timezone

        data["applied_at"] = datetime.now(timezone.utc)
    if "status" not in data:
        data["status"] = "active"
    if "current_stage_code" not in data:
        data["current_stage_code"] = "sourced"
    return APIResponse(message="Created", data=ApplicationService(db).create(ctx, **data))

@applications_router.get("/stats/pipeline", response_model=APIResponse[PipelineStatsResponse])
def pipeline_stats(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.application:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=ApplicationService(db).pipeline_stats(ctx, company_id),
    )

@applications_router.patch("/{row_id}", response_model=APIResponse[ApplicationResponse])
def update_applications(
    row_id: UUID,
    body: ApplicationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.application:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ApplicationService(db).update(ctx, row_id, **extract_update_fields(body)))

@applications_router.post("/{row_id}/advance", response_model=APIResponse[ApplicationResponse])
def advance_applications(
    row_id: UUID,
    body: ApplicationAdvanceRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.application:advance"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Advanced", data=ApplicationService(db).advance(ctx, row_id, stage=body.stage))

@applications_router.post("/{row_id}/reject", response_model=APIResponse[ApplicationResponse])
def reject_applications(
    row_id: UUID,
    body: ApplicationRejectRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.application:advance"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Rejected", data=ApplicationService(db).reject(ctx, row_id, reason=body.reason))

@applications_router.post("/{row_id}/mark-hired", response_model=APIResponse[ApplicationResponse])
def mark_hired_applications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.application:advance"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Hired", data=ApplicationService(db).mark_hired(ctx, row_id))

@applications_router.post("/{row_id}/mark-backed-out", response_model=APIResponse[ApplicationResponse])
def mark_backed_out_applications(
    row_id: UUID,
    body: ApplicationBackOutRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.application:advance"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Backed out",
        data=ApplicationService(db).mark_backed_out(ctx, row_id, reason=body.reason),
    )


@applications_router.post("/{row_id}/send-bg-portal", response_model=APIResponse[dict])
def send_bg_document_portal(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.application:advance"))],
    db: Annotated[Session, Depends(get_db)],
    expiry_days: int = 7,
    send_email: bool = True,
):
    """Create candidate document portal + login credentials.

    When send_email=false, credentials are returned without mailing so the
    offer letter email can include the portal link in the same send.
    """
    data = PublicBgCheckService(db).create_portal_invite(
        ctx,
        application_id=row_id,
        expiry_days=expiry_days,
        send_email=send_email,
    )
    return APIResponse(message="BG document portal created", data=data)


class SendBgVendorBody(BaseModel):
    partner_email: str = Field(..., min_length=3, max_length=255)
    expiry_hours: int = Field(
        default=24,
        ge=1,
        le=168,
        description="Hours until the partner download link expires (default 24).",
    )
    # Deprecated: prefer expiry_hours. Kept for older clients (days × 24).
    expiry_days: int | None = Field(default=None, ge=1, le=30)


@applications_router.post("/{row_id}/send-bg-vendor", response_model=APIResponse[dict])
def send_bg_vendor_pack(
    row_id: UUID,
    body: SendBgVendorBody,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.application:advance"))],
    db: Annotated[Session, Depends(get_db)],
):
    """Create partner download portal credentials (HR emails the link separately)."""
    hours = body.expiry_hours
    if body.expiry_days is not None and body.expiry_hours == 24:
        # Legacy clients that only send expiry_days.
        hours = max(1, min(int(body.expiry_days) * 24, 168))
    data = PublicBgCheckService(db).create_vendor_pack(
        ctx,
        application_id=row_id,
        partner_email=body.partner_email,
        expiry_hours=hours,
    )
    db.commit()
    return APIResponse(message="BG vendor download pack created", data=data)


@applications_router.get("/{row_id}/bg-portal-attachments", response_model=APIResponse[list[dict]])
def list_bg_portal_attachments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.application:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = PublicBgCheckService(db).list_attachments_for_application(ctx, row_id)
    return APIResponse(message="OK", data=data)


@applications_router.get("/{row_id}/bg-portal-status", response_model=APIResponse[dict | None])
def get_bg_portal_status(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.application:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = PublicBgCheckService(db).get_portal_status_for_application(ctx, row_id)
    return APIResponse(message="OK", data=data)


@applications_router.post("/{row_id}/bg-portal-review", response_model=APIResponse[dict])
def review_bg_portal(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.application:update"))],
    db: Annotated[Session, Depends(get_db)],
    decision: str = "verified",
):
    """HR marks BG document portal as verified (cleared) or rejected (failed)."""
    data = PublicBgCheckService(db).review_portal_for_application(
        ctx, row_id, decision=decision
    )
    return APIResponse(message="BG review saved", data=data)


@application_stages_router.get("", response_model=APIResponse[list[ApplicationStageResponse]])
def list_application_stages(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.application:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(ApplicationStageService(db).list(ctx, company_id), pagination))

@application_stages_router.post("", response_model=APIResponse[ApplicationStageResponse])
def create_application_stages(
    body: ApplicationStageCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.application:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ApplicationStageService(db).create(ctx, **body.model_dump()))

@application_stages_router.patch("/{row_id}", response_model=APIResponse[ApplicationStageResponse])
def update_application_stages(
    row_id: UUID,
    body: ApplicationStageUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.application:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ApplicationStageService(db).update(ctx, row_id, **extract_update_fields(body)))

@interviews_router.get("", response_model=APIResponse[list[InterviewResponse]])
def list_interviews(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.interview:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(InterviewService(db).list(ctx, company_id), pagination))

@interviews_router.post("", response_model=APIResponse[InterviewResponse])
def create_interviews(
    body: InterviewCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.interview:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=InterviewService(db).create(ctx, **body.model_dump()))

@interviews_router.patch("/{row_id}", response_model=APIResponse[InterviewResponse])
def update_interviews(
    row_id: UUID,
    body: InterviewUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.interview:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=InterviewService(db).update(ctx, row_id, **extract_update_fields(body)))

@interview_feedback_router.get("", response_model=APIResponse[list[InterviewFeedbackResponse]])
def list_interview_feedback(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.interview:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(InterviewFeedbackService(db).list(ctx, company_id), pagination))

@interview_feedback_router.post("", response_model=APIResponse[InterviewFeedbackResponse])
def create_interview_feedback(
    body: InterviewFeedbackCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.interview:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=InterviewFeedbackService(db).create(ctx, **body.model_dump()))

@interview_feedback_router.patch("/{row_id}", response_model=APIResponse[InterviewFeedbackResponse])
def update_interview_feedback(
    row_id: UUID,
    body: InterviewFeedbackUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.interview:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=InterviewFeedbackService(db).update(ctx, row_id, **extract_update_fields(body)))

@offers_router.get("", response_model=APIResponse[list[OfferResponse]])
def list_offers(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.offer:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(OfferService(db).list(ctx, company_id), pagination))

@offers_router.post("", response_model=APIResponse[OfferResponse])
def create_offers(
    body: OfferCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.offer:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=OfferService(db).create(ctx, **body.model_dump()))

@offers_router.patch("/{row_id}", response_model=APIResponse[OfferResponse])
def update_offers(
    row_id: UUID,
    body: OfferUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.offer:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=OfferService(db).update(ctx, row_id, **extract_update_fields(body)))

@offers_router.post("/{row_id}/submit", response_model=APIResponse[OfferResponse])
def submit_offers(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.offer:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Submitted", data=OfferService(db).submit(ctx, row_id))

@offers_router.post("/{row_id}/approve", response_model=APIResponse[OfferResponse])
def approve_offers(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.offer:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Approved", data=OfferService(db).approve(ctx, row_id))

@offers_router.post("/{row_id}/send", response_model=APIResponse[OfferResponse])
def send_offers(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.offer:send"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Sent", data=OfferService(db).send(ctx, row_id))

@offers_router.post("/{row_id}/accept", response_model=APIResponse[OfferResponse])
def accept_offers(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.offer:send"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Accepted", data=OfferService(db).accept(ctx, row_id))

@offers_router.post("/{row_id}/reject", response_model=APIResponse[OfferResponse])
def reject_offers(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.offer:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Rejected", data=OfferService(db).reject(ctx, row_id))

@offer_approvals_router.get("", response_model=APIResponse[list[OfferApprovalResponse]])
def list_offer_approvals(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.offer:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(OfferApprovalService(db).list(ctx, company_id), pagination))

@offer_approvals_router.post("", response_model=APIResponse[OfferApprovalResponse])
def create_offer_approvals(
    body: OfferApprovalCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.offer:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=OfferApprovalService(db).create(ctx, **body.model_dump()))

@offer_approvals_router.patch("/{row_id}", response_model=APIResponse[OfferApprovalResponse])
def update_offer_approvals(
    row_id: UUID,
    body: OfferApprovalUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.offer:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=OfferApprovalService(db).update(ctx, row_id, **extract_update_fields(body)))

@background_verifications_router.get("", response_model=APIResponse[list[BackgroundVerificationResponse]])
def list_background_verifications(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.verification:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(BackgroundVerificationService(db).list(ctx, company_id), pagination))

@background_verifications_router.post("", response_model=APIResponse[BackgroundVerificationResponse])
def create_background_verifications(
    body: BackgroundVerificationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.verification:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=BackgroundVerificationService(db).create(ctx, **body.model_dump()))

@background_verifications_router.patch("/{row_id}", response_model=APIResponse[BackgroundVerificationResponse])
def update_background_verifications(
    row_id: UUID,
    body: BackgroundVerificationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.verification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=BackgroundVerificationService(db).update(ctx, row_id, **extract_update_fields(body)))

@background_verifications_router.post("/{row_id}/submit", response_model=APIResponse[BackgroundVerificationResponse])
def submit_background_verifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.verification:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Submitted", data=BackgroundVerificationService(db).submit(ctx, row_id))

@background_verifications_router.post("/{row_id}/approve", response_model=APIResponse[BackgroundVerificationResponse])
def approve_background_verifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.verification:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Approved", data=BackgroundVerificationService(db).approve(ctx, row_id))

@reference_checks_router.get("", response_model=APIResponse[list[ReferenceCheckResponse]])
def list_reference_checks(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.verification:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(ReferenceCheckService(db).list(ctx, company_id), pagination))

@reference_checks_router.post("", response_model=APIResponse[ReferenceCheckResponse])
def create_reference_checks(
    body: ReferenceCheckCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.verification:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ReferenceCheckService(db).create(ctx, **body.model_dump()))

@reference_checks_router.patch("/{row_id}", response_model=APIResponse[ReferenceCheckResponse])
def update_reference_checks(
    row_id: UUID,
    body: ReferenceCheckUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.verification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ReferenceCheckService(db).update(ctx, row_id, **extract_update_fields(body)))

@talent_pools_router.get("", response_model=APIResponse[list[TalentPoolResponse]])
def list_talent_pools(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.talent_pool:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(TalentPoolService(db).list(ctx, company_id), pagination))

@talent_pools_router.post("", response_model=APIResponse[TalentPoolResponse])
def create_talent_pools(
    body: TalentPoolCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.talent_pool:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=TalentPoolService(db).create(ctx, **body.model_dump()))

@talent_pools_router.patch("/{row_id}", response_model=APIResponse[TalentPoolResponse])
def update_talent_pools(
    row_id: UUID,
    body: TalentPoolUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.talent_pool:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=TalentPoolService(db).update(ctx, row_id, **extract_update_fields(body)))

@candidate_notes_router.get("", response_model=APIResponse[list[CandidateNoteResponse]])
def list_candidate_notes(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.note:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(CandidateNoteService(db).list(ctx, company_id), pagination))

@candidate_notes_router.post("", response_model=APIResponse[CandidateNoteResponse])
def create_candidate_notes(
    body: CandidateNoteCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.note:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=CandidateNoteService(db).create(ctx, **body.model_dump()))

@candidate_notes_router.patch("/{row_id}", response_model=APIResponse[CandidateNoteResponse])
def update_candidate_notes(
    row_id: UUID,
    body: CandidateNoteUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.note:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=CandidateNoteService(db).update(ctx, row_id, **extract_update_fields(body)))

@onboarding_router.get("", response_model=APIResponse[list[OnboardingResponse]])
def list_onboarding(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.onboarding:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(OnboardingService(db).list(ctx, company_id), pagination))

@onboarding_router.post("", response_model=APIResponse[OnboardingResponse])
def create_onboarding(
    body: OnboardingCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.onboarding:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=OnboardingService(db).create(ctx, **body.model_dump()))

@onboarding_router.patch("/{row_id}", response_model=APIResponse[OnboardingResponse])
def update_onboarding(
    row_id: UUID,
    body: OnboardingUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.onboarding:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=OnboardingService(db).update(ctx, row_id, **extract_update_fields(body)))

@onboarding_router.post("/{row_id}/submit", response_model=APIResponse[OnboardingResponse])
def submit_onboarding(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.onboarding:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Submitted", data=OnboardingService(db).submit(ctx, row_id))

@onboarding_router.post("/{row_id}/approve", response_model=APIResponse[OnboardingResponse])
def approve_onboarding(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.onboarding:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Approved", data=OnboardingService(db).approve(ctx, row_id))

@onboarding_router.post("/{row_id}/complete", response_model=APIResponse[OnboardingResponse])
def complete_onboarding(
    row_id: UUID,
    body: OnboardingCompleteRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.onboarding:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Completed",
        data=OnboardingService(db).complete(
            ctx,
            row_id,
            designation=body.designation,
            management_group_id=body.management_group_id,
        ),
    )

@onboarding_tasks_router.get("", response_model=APIResponse[list[OnboardingTaskResponse]])
def list_onboarding_tasks(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.onboarding:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(OnboardingTaskService(db).list(ctx, company_id), pagination))

@onboarding_tasks_router.post("", response_model=APIResponse[OnboardingTaskResponse])
def create_onboarding_tasks(
    body: OnboardingTaskCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.onboarding:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=OnboardingTaskService(db).create(ctx, **body.model_dump()))

@onboarding_tasks_router.patch("/{row_id}", response_model=APIResponse[OnboardingTaskResponse])
def update_onboarding_tasks(
    row_id: UUID,
    body: OnboardingTaskUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.onboarding:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=OnboardingTaskService(db).update(ctx, row_id, **extract_update_fields(body)))

@reports_router.get("", response_model=APIResponse[list[RecruitmentReportResponse]])
def list_reports(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(RecruitmentReportService(db).list(ctx, company_id), pagination))

@reports_router.post("", response_model=APIResponse[RecruitmentReportResponse])
def create_reports(
    body: RecruitmentReportCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.report:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=RecruitmentReportService(db).create(ctx, **body.model_dump()))

@reports_router.patch("/{row_id}", response_model=APIResponse[RecruitmentReportResponse])
def update_reports(
    row_id: UUID,
    body: RecruitmentReportUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=RecruitmentReportService(db).update(ctx, row_id, **extract_update_fields(body)))
