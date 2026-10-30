"""Public BG vendor download portal — partner logs in with email + access code."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from modules.recruitment.dependencies import get_db
from modules.recruitment.service.public_bg_check_service import PublicBgCheckService
from shared.schemas import APIResponse

public_bg_vendor_router = APIRouter(
    prefix="/public/bg-vendor",
    tags=["Public - BG Vendor Portal"],
)


class BgVendorLoginBody(BaseModel):
    login_email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=4, max_length=64)


@public_bg_vendor_router.get("/{token}", response_model=APIResponse[dict])
def get_bg_vendor_portal(token: str, db: Annotated[Session, Depends(get_db)]):
    """Public meta only — documents require login."""
    data = PublicBgCheckService(db).get_vendor_meta(token)
    return APIResponse(message="OK", data=data)


@public_bg_vendor_router.post("/{token}/login", response_model=APIResponse[dict])
def login_bg_vendor(
    token: str,
    body: BgVendorLoginBody,
    db: Annotated[Session, Depends(get_db)],
):
    data = PublicBgCheckService(db).login_vendor(
        token,
        login_email=body.login_email,
        password=body.password,
    )
    db.commit()
    return APIResponse(message="Logged in", data=data)


@public_bg_vendor_router.get("/{token}/documents", response_model=APIResponse[list])
def list_bg_vendor_documents(
    token: str,
    db: Annotated[Session, Depends(get_db)],
    access_token: Annotated[str | None, Header(alias="X-Bg-Vendor-Access")] = None,
):
    data = PublicBgCheckService(db).list_vendor_documents(token, access_token=access_token)
    return APIResponse(message="OK", data=data)


@public_bg_vendor_router.get("/{token}/documents/{doc_id}", response_model=APIResponse[dict])
def download_bg_vendor_document(
    token: str,
    doc_id: str,
    db: Annotated[Session, Depends(get_db)],
    access_token: Annotated[str | None, Header(alias="X-Bg-Vendor-Access")] = None,
):
    data = PublicBgCheckService(db).get_vendor_document(
        token, doc_id, access_token=access_token
    )
    return APIResponse(message="OK", data=data)
