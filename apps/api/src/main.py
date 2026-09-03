"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.constants import API_V1_PREFIX, APP_DESCRIPTION
from core.exceptions import register_exception_handlers
from core.logging import setup_logging
from middleware.request_context import RequestContextMiddleware
from modules.mcp_server.bootstrap import mcp_lifespan, mount_mcp_on_app
from shared.router import api_v1_router


@asynccontextmanager
async def lifespan(application: FastAPI):
    setup_logging()
    from core.infra_health import log_infrastructure_connections
    from modules.asset.storage import validate_asset_storage_on_startup

    log_infrastructure_connections()
    validate_asset_storage_on_startup()
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

    cors_kwargs: dict = {
        "allow_origins": settings.cors_origins,
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }
    if settings.cors_origin_regex:
        cors_kwargs["allow_origin_regex"] = settings.cors_origin_regex
    elif settings.is_development:
        cors_kwargs["allow_origin_regex"] = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"

    application.add_middleware(CORSMiddleware, **cors_kwargs)

    register_exception_handlers(application)
    application.include_router(api_v1_router, prefix=API_V1_PREFIX)
    mount_mcp_on_app(application)

    return application


app = create_app()
