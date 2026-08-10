"""FastAPI application entry point."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import settings
from core.constants import API_V1_PREFIX, APP_DESCRIPTION
from core.exceptions import register_exception_handlers
from core.logging import setup_logging
from middleware.request_context import RequestContextMiddleware
from shared.router import api_v1_router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    setup_logging()
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
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }
    if settings.is_development:
        cors_kwargs["allow_origin_regex"] = r"https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?"
    else:
        cors_kwargs["allow_origins"] = settings.cors_origins

    application.add_middleware(CORSMiddleware, **cors_kwargs)

    register_exception_handlers(application)
    application.include_router(api_v1_router, prefix=API_V1_PREFIX)

    assets_dir = Path(__file__).resolve().parents[1] / "var" / "marketing-assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    application.mount("/static/marketing-assets", StaticFiles(directory=assets_dir), name="marketing-assets")

    return application


app = create_app()
