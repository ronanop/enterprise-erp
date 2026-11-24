"""HttpOnly auth cookie helpers (VAPT: tokens must not live in localStorage)."""

from __future__ import annotations

from fastapi import Request, Response

from core.config import settings

ACCESS_COOKIE = settings.auth_cookie_access
REFRESH_COOKIE = settings.auth_cookie_refresh


def _request_is_https(request: Request | None) -> bool | None:
    """Return True/False when the browser-facing scheme is known, else None."""
    if request is None:
        return None
    proto = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
    if proto in {"http", "https"}:
        return proto == "https"
    scheme = (request.url.scheme or "").lower()
    if scheme in {"http", "https"}:
        return scheme == "https"
    return None


def _cookie_kwargs(*, max_age: int, request: Request | None = None) -> dict:
    same_site = (settings.auth_cookie_samesite or "lax").lower()
    if same_site not in {"lax", "strict", "none"}:
        same_site = "lax"
    # Prefer AUTH_COOKIE_SECURE from env, then adjust for the actual browser scheme.
    # Opening the UI on http://host:3000 (Next rewrite → API) must not set Secure
    # cookies — browsers silently drop them and every refresh forces re-login.
    secure = bool(settings.auth_cookie_secure)
    frontend = (settings.frontend_url or "").strip().lower()
    if frontend.startswith("http://localhost") or frontend.startswith("http://127.0.0.1"):
        secure = False
    elif same_site == "none":
        secure = True
    https = _request_is_https(request)
    if https is False:
        secure = False
    elif https is True:
        secure = True
    return {
        "httponly": True,
        "secure": secure,
        "samesite": same_site,
        "path": "/",
        "max_age": max_age,
    }


def set_auth_cookies(
    response: Response,
    *,
    access_token: str | None,
    refresh_token: str | None,
    request: Request | None = None,
) -> None:
    if access_token:
        response.set_cookie(
            ACCESS_COOKIE,
            access_token,
            **_cookie_kwargs(
                max_age=settings.jwt_access_token_expire_minutes * 60,
                request=request,
            ),
        )
    if refresh_token:
        response.set_cookie(
            REFRESH_COOKIE,
            refresh_token,
            **_cookie_kwargs(
                max_age=settings.jwt_refresh_token_expire_days * 86400,
                request=request,
            ),
        )


def clear_auth_cookies(response: Response, request: Request | None = None) -> None:
    # delete_cookie must mirror set_cookie attributes or the browser keeps the cookie.
    kwargs = _cookie_kwargs(max_age=0, request=request)
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(
            name,
            path=kwargs["path"],
            secure=kwargs["secure"],
            httponly=kwargs["httponly"],
            samesite=kwargs["samesite"],
        )
