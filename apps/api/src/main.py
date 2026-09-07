"""FastAPI application entry point."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.constants import API_V1_PREFIX, APP_DESCRIPTION
from core.exceptions import register_exception_handlers
from core.logging import setup_logging
from middleware.hr_api_alias import HrToHrmsAliasMiddleware
from middleware.request_context import RequestContextMiddleware
from modules.mcp_server.bootstrap import mcp_lifespan, mount_mcp_on_app
from shared.router import api_v1_router


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    setup_logging()
    from core.infra_health import log_infrastructure_connections
    from core.object_storage import ensure_bucket, is_enabled

    if is_enabled():
        try:
            ensure_bucket()
        except Exception:
            pass
    log_infrastructure_connections()
    async with mcp_lifespan(application):
        yield


def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=APP_DESCRIPTION,
        debug=settings.debug,
        lifespan=lifespan,
    )

    application.add_middleware(RequestContextMiddleware)
    application.add_middleware(HrToHrmsAliasMiddleware)

    cors_origins = list(settings.cors_origins)
    lan_origin_regex = (
        r"https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|"
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?"
    )
    if settings.is_development:
        for origin in (
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
        ):
            if origin not in cors_origins:
                cors_origins.append(origin)

    cors_kwargs: dict = {
        "allow_origins": cors_origins,
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
        "expose_headers": ["X-Request-ID"],
    }
    if settings.cors_origin_regex:
        cors_kwargs["allow_origin_regex"] = settings.cors_origin_regex
    elif settings.is_development:
        cors_kwargs["allow_origin_regex"] = lan_origin_regex

    application.add_middleware(CORSMiddleware, **cors_kwargs)

    register_exception_handlers(application)
    application.include_router(api_v1_router, prefix=API_V1_PREFIX)
    mount_mcp_on_app(application)

    return application


app = create_app()
