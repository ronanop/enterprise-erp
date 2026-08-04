"""Configuration models for MCP exposed endpoints."""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class EndpointAccess(str, Enum):
    READ = "read"
    WRITE = "write"


class ExposedEndpoint(BaseModel):
    tool_name: str = Field(..., min_length=1, pattern=r"^[a-z][a-z0-9_]*$")
    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"]
    path: str = Field(..., pattern=r"^/")
    access: EndpointAccess
    description: str = Field(..., min_length=8)
    permission: str | None = Field(
        default=None,
        description="RBAC permission code; null means rely on downstream API auth only.",
    )


class ExposedEndpointsConfig(BaseModel):
    version: int = 1
    endpoints: list[ExposedEndpoint]
