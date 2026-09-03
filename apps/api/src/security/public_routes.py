"""Dependencies for intentionally unauthenticated API routes."""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_public_bearer = HTTPBearer(
    auto_error=False,
    description="Optional bearer token; route remains public when omitted.",
)


def optional_authentication(
    _credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(_public_bearer),
    ] = None,
) -> None:
    """Mark a route as intentionally public while satisfying auth dependency checks."""
    return None
