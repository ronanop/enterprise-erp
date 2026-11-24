"""Public careers endpoints (no auth) — open roles + apply."""

import json
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from modules.recruitment.dependencies import get_db
from modules.recruitment.service.public_careers_service import PublicCareersService
from shared.document_text import text_from_bytes
from shared.schemas import APIResponse

public_careers_router = APIRouter(
    prefix="/public/careers",
    tags=["Public - Careers"],
)


class CareersApplyBody(BaseModel):
    job_requisition_id: UUID
    full_name: str = Field(..., min_length=2, max_length=255)
    email: str = Field(..., min_length=3, max_length=255)
    phone: str = Field(..., min_length=10, max_length=20)
    resume_name: str | None = None
    alternate_phone: str | None = None
    gender: str | None = None
    dob: str | None = None
    address: str | None = None
    state: str | None = None
    pincode: str | None = None
    current_company: str | None = None
    current_designation: str | None = None
    experience_years: float | None = None
    expected_salary: float | None = None
    notice_period_days: int | None = None
    skills: list[str] | None = None
    portfolio_url: str | None = None
    linkedin_url: str | None = None


def _parse_skills(raw: str | None) -> list[str] | None:
    if not raw or not str(raw).strip():
        return None
    text = str(raw).strip()
    # JSON array or comma-separated
    if text.startswith("["):
        try:
            data = json.loads(text)
            if isinstance(data, list):
                return [str(s).strip() for s in data if str(s).strip()]
        except Exception:
            pass
    return [p.strip() for p in text.replace(";", ",").split(",") if p.strip()]


def _opt_float(raw: str | None) -> float | None:
    if raw is None or not str(raw).strip():
        return None
    try:
        return float(str(raw).replace(",", "").strip())
    except ValueError:
        return None


def _opt_int(raw: str | None) -> int | None:
    if raw is None or not str(raw).strip():
        return None
    try:
        return int(float(str(raw).replace(",", "").strip()))
    except ValueError:
        return None


@public_careers_router.get("/roles", response_model=APIResponse[list[dict]])
def list_open_roles(db: Annotated[Session, Depends(get_db)]):
    return APIResponse(message="OK", data=PublicCareersService(db).list_open_roles())


@public_careers_router.post("/apply", response_model=APIResponse[dict])
async def apply_to_role(
    db: Annotated[Session, Depends(get_db)],
    job_requisition_id: Annotated[str, Form(...)],
    full_name: Annotated[str, Form(...)],
    email: Annotated[str, Form(...)],
    phone: Annotated[str, Form(...)],
    resume: Annotated[UploadFile | None, File()] = None,
    alternate_phone: Annotated[str | None, Form()] = None,
    gender: Annotated[str | None, Form()] = None,
    dob: Annotated[str | None, Form()] = None,
    address: Annotated[str | None, Form()] = None,
    state: Annotated[str | None, Form()] = None,
    pincode: Annotated[str | None, Form()] = None,
    current_company: Annotated[str | None, Form()] = None,
    current_designation: Annotated[str | None, Form()] = None,
    experience_years: Annotated[str | None, Form()] = None,
    expected_salary: Annotated[str | None, Form()] = None,
    notice_period_days: Annotated[str | None, Form()] = None,
    skills: Annotated[str | None, Form()] = None,
    portfolio_url: Annotated[str | None, Form()] = None,
    linkedin_url: Annotated[str | None, Form()] = None,
):
    resume_name = None
    resume_text = None
    resume_bytes: bytes | None = None
    if resume is not None and resume.filename:
        resume_name = resume.filename
        raw = await resume.read()
        if raw:
            resume_bytes = raw
            resume_text = text_from_bytes(raw, resume.filename, ocr=False)[:4000]
    data = PublicCareersService(db).apply(
        job_requisition_id=UUID(job_requisition_id),
        full_name=full_name,
        email=email,
        phone=phone,
        resume_name=resume_name,
        resume_text=resume_text,
        resume_bytes=resume_bytes,
        alternate_phone=alternate_phone,
        gender=gender,
        dob=dob,
        address=address,
        state=state,
        pincode=pincode,
        current_company=current_company,
        current_designation=current_designation,
        experience_years=_opt_float(experience_years),
        expected_salary=_opt_float(expected_salary),
        notice_period_days=_opt_int(notice_period_days),
        skills=_parse_skills(skills),
        portfolio_url=portfolio_url,
        linkedin_url=linkedin_url,
    )
    return APIResponse(message="Application submitted", data=data)


@public_careers_router.post("/apply-json", response_model=APIResponse[dict])
def apply_to_role_json(
    body: CareersApplyBody,
    db: Annotated[Session, Depends(get_db)],
):
    data = PublicCareersService(db).apply(
        job_requisition_id=body.job_requisition_id,
        full_name=body.full_name,
        email=body.email,
        phone=body.phone,
        resume_name=body.resume_name,
        alternate_phone=body.alternate_phone,
        gender=body.gender,
        dob=body.dob,
        address=body.address,
        state=body.state,
        pincode=body.pincode,
        current_company=body.current_company,
        current_designation=body.current_designation,
        experience_years=body.experience_years,
        expected_salary=body.expected_salary,
        notice_period_days=body.notice_period_days,
        skills=body.skills,
        portfolio_url=body.portfolio_url,
        linkedin_url=body.linkedin_url,
    )
    return APIResponse(message="Application submitted", data=data)
