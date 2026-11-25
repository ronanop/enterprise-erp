"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.constants import API_V1_PREFIX, APP_DESCRIPTION
from core.exceptions import register_exception_handlers
from core.logging import setup_logging
from middleware.rate_limit import RateLimitMiddleware
from middleware.input_validation import InputValidationMiddleware
from middleware.hr_api_alias import HrToHrmsAliasMiddleware
from middleware.request_context import RequestContextMiddleware
from middleware.security_headers import SecurityHeadersMiddleware
from shared.router import api_v1_router

if not settings.ess_store_review_mode:
    from modules.mcp_server.bootstrap import mcp_lifespan, mount_mcp_on_app
else:
    mcp_lifespan = None  # type: ignore[assignment]
    mount_mcp_on_app = None  # type: ignore[assignment]


@asynccontextmanager
async def lifespan(application: FastAPI):
    setup_logging()
    from core.infra_health import log_infrastructure_connections

    log_infrastructure_connections()
    if settings.ess_store_review_mode:
        # Skip asset/MCP startup work — keeps 512Mi Render staging alive.
        yield
        return

    from modules.asset.storage import validate_asset_storage_on_startup

    validate_asset_storage_on_startup()
    async with mcp_lifespan(application):
        yield


def create_app() -> FastAPI:
    # Never enable Starlette debug error pages in the served app - they leak stack traces
    # (AppScan Integer Overflow / Application Error findings). Use logs instead.
    # Disable interactive API docs unless explicitly enabled (VAPT: OpenAPI/Swagger exposure).
    docs_enabled = bool(getattr(settings, "enable_api_docs", False))
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=APP_DESCRIPTION,
        debug=False,
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
    )

    application.add_middleware(RequestContextMiddleware)
    application.add_middleware(SecurityHeadersMiddleware)
    application.add_middleware(InputValidationMiddleware)
    application.add_middleware(RateLimitMiddleware)
    application.add_middleware(HrToHrmsAliasMiddleware)

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
    if not settings.ess_store_review_mode:
        mount_mcp_on_app(application)

    return application


app = create_app()
