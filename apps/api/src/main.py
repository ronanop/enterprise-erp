"""FastAPI application entry point."""

import asyncio
import logging
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

_logger = logging.getLogger(__name__)


async def _roster_open_reminder_loop() -> None:
    """In-process fallback when Celery beat is not running (local uvicorn)."""
    from modules.service.service.roster_open_reminder_service import run_unopened_roster_reminders

    interval = max(60, int(settings.service_roster_open_reminder_seconds or 600))
    # Stagger first run so boot + mailbox poll settle first.
    await asyncio.sleep(min(60, interval))
    while True:
        try:
            await asyncio.to_thread(run_unopened_roster_reminders)
        except asyncio.CancelledError:
            raise
        except Exception:
            _logger.exception("in-process roster open reminder failed")
        await asyncio.sleep(interval)


async def _mailbox_poll_loop() -> None:
    """In-process MailAPI/Graph/IMAP poll when Celery beat is not running."""
    from modules.service.tasks import poll_support_mailbox

    interval = max(
        60,
        int(
            settings.mailapi_poll_interval_seconds
            or settings.imap_poll_interval_seconds
            or 120
        ),
    )
    await asyncio.sleep(15)
    while True:
        try:
            result = await asyncio.to_thread(poll_support_mailbox)
            _logger.info("mailbox poll: %s", result)
        except asyncio.CancelledError:
            raise
        except Exception:
            _logger.exception("in-process mailbox poll failed")
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    setup_logging()
    background: list[asyncio.Task] = []
    if settings.service_roster_open_reminder_enabled:
        background.append(
            asyncio.create_task(
                _roster_open_reminder_loop(),
                name="service.roster_open_reminder_loop",
            )
        )
    if settings.email_ticket_enabled and (
        settings.mailapi_configured or settings.graph_mail_configured or settings.imap_configured
    ):
        background.append(
            asyncio.create_task(_mailbox_poll_loop(), name="service.mailbox_poll_loop")
        )
    try:
        yield
    finally:
        for task in background:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


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
