"""Public BG document portal — token link; candidate must login with email + access code."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from modules.recruitment.dependencies import get_db
from modules.recruitment.service.public_bg_check_service import PublicBgCheckService
from shared.schemas import APIResponse

public_bg_check_router = APIRouter(
    prefix="/public/bg-check",
    tags=["Public - BG Check Portal"],
)


class BgPortalSaveBody(BaseModel):
    portal: dict[str, Any] = Field(default_factory=dict)
    access_token: str | None = None


class BgPortalLoginBody(BaseModel):
    login_email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=4, max_length=64)


@public_bg_check_router.get("/{token}", response_model=APIResponse[dict])
def get_bg_portal(token: str, db: Annotated[Session, Depends(get_db)]):
    """Public meta only — does not return documents until login."""
    data = PublicBgCheckService(db).get_by_token(token)
    return APIResponse(message="OK", data=data)


@public_bg_check_router.post("/{token}/login", response_model=APIResponse[dict])
def login_bg_portal(
    token: str,
    body: BgPortalLoginBody,
    db: Annotated[Session, Depends(get_db)],
):
    data = PublicBgCheckService(db).login_portal(
        token,
        login_email=body.login_email,
        password=body.password,
    )
    db.commit()
    return APIResponse(message="Logged in", data=data)


@public_bg_check_router.post("/{token}/save", response_model=APIResponse[dict])
def save_bg_portal(
    token: str,
    body: BgPortalSaveBody,
    db: Annotated[Session, Depends(get_db)],
):
    data = PublicBgCheckService(db).save_portal(
        token, body.portal, access_token=body.access_token
    )
    db.commit()
    return APIResponse(message="Saved", data=data)


@public_bg_check_router.post("/{token}/submit", response_model=APIResponse[dict])
def submit_bg_portal(
    token: str,
    body: BgPortalSaveBody,
    db: Annotated[Session, Depends(get_db)],
):
    data = PublicBgCheckService(db).submit_portal(
        token, body.portal, access_token=body.access_token
    )
    db.commit()
    return APIResponse(message="Submitted", data=data)
