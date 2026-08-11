"""Structured logging configuration."""

import logging
import sys

from pythonjsonlogger.json import JsonFormatter

from core.config import settings


class _WindowsAsyncioNoiseFilter(logging.Filter):
    """Suppress benign asyncio callback errors during uvicorn reload/shutdown on Windows."""

    _NOISE_MARKERS = (
        "ConnectionAbortedError",
        "WinError 10053",
        "ConnectionResetError",
        "WinError 10054",
        "_read_from_self",
    )

    def filter(self, record: logging.LogRecord) -> bool:
        if record.name != "asyncio":
            return True
        message = record.getMessage()
        return not any(marker in message for marker in self._NOISE_MARKERS)


def setup_logging() -> None:
    """Configure root logger with JSON output for production parity."""
    root_logger = logging.getLogger()
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    formatter = JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={"asctime": "timestamp", "levelname": "level"},
    )
    handler.setFormatter(formatter)
    if settings.is_development:
        handler.addFilter(_WindowsAsyncioNoiseFilter())
    root_logger.addHandler(handler)
    root_logger.setLevel(settings.log_level.upper())

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
