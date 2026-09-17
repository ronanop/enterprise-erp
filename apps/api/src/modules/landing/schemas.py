"""Landing access-gate request/response schemas."""

from typing import Literal

from pydantic import BaseModel, Field


AccessGateTarget = Literal["demo", "connectplus"]


class AccessGateVerifyRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=64)


class AccessGateVerifyData(BaseModel):
    target: AccessGateTarget
    redirect_path: str
    token: str
    expires_in_hours: int


class AccessGateSessionData(BaseModel):
    target: AccessGateTarget
    redirect_path: str
