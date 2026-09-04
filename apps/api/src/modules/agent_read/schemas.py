"""Agent-facing read API (ElevenLabs MCP / voice tools)."""

from pydantic import BaseModel, Field


class PaginationMeta(BaseModel):
    total: int = Field(..., ge=0)
    limit: int = Field(..., ge=1)
    offset: int = Field(..., ge=0)


class AgentListQuery(BaseModel):
    q: str | None = None
    status: str | None = None
    limit: int = Field(default=25, ge=1, le=200)
    offset: int = Field(default=0, ge=0)


class PaginatedListResponse(BaseModel):
    """Standard list payload for agent/MCP read tools."""

    success: bool = True
    message: str
    data: list
    meta: PaginationMeta
