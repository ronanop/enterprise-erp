"""Keep legacy /api/v1/hr/* working after the HRMS prefix moved to /hrms."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

HR_PREFIX = "/api/v1/hr"
HRMS_PREFIX = "/api/v1/hrms"


class HrToHrmsAliasMiddleware:
    """Rewrite /api/v1/hr → /api/v1/hrms before routing so Network-tab aliases stay compatible."""

    def __init__(self, app: Callable[..., Awaitable[None]]) -> None:
        self.app = app

    async def __call__(self, scope: dict, receive: Callable, send: Callable) -> None:
        if scope.get("type") == "http":
            path = scope.get("path") or ""
            if path == HR_PREFIX or path.startswith(f"{HR_PREFIX}/"):
                scope = dict(scope)
                new_path = HRMS_PREFIX + path[len(HR_PREFIX) :]
                scope["path"] = new_path
                raw = scope.get("raw_path")
                if isinstance(raw, (bytes, bytearray)):
                    scope["raw_path"] = new_path.encode("ascii")
        await self.app(scope, receive, send)
