"""Pydantic schemas for voice-agent integration."""

from pydantic import BaseModel, Field


class SignedUrlResponse(BaseModel):
    signed_url: str = Field(..., description="WebSocket signed URL (expires in ~15 minutes)")
