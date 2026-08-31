"""Startup checks for the asset-module local storage backend."""

from __future__ import annotations

import logging
from pathlib import Path
from uuid import uuid4

from core.config import get_settings

logger = logging.getLogger(__name__)

_EPHEMERAL_PREFIXES = ("/tmp", "/var/tmp", "/app")


def validate_asset_storage_on_startup() -> None:
    """Probe the configured storage path. Log loudly on failure; do not raise."""
    settings = get_settings()
    backend = (settings.asset_storage_backend or "local").strip().lower()
    configured = settings.asset_storage_path or "./var/asset-storage"
    try:
        root = Path(configured).expanduser().resolve()
    except OSError as exc:
        logger.error(
            "ASSET_STORAGE_PATH %r could not be resolved: %s. Uploaded DC challan "
            "documents will fail until this is a writable directory.",
            configured,
            exc,
        )
        return

    if backend == "local":
        _warn_if_ephemeral(configured, root)

    try:
        root.mkdir(parents=True, exist_ok=True)
        if not root.is_dir():
            logger.error(
                "ASSET_STORAGE_PATH %s exists but is not a directory. Uploaded DC "
                "challan documents will fail until this is a writable directory.",
                root,
            )
            return
        probe = root / f".storage-probe-{uuid4().hex}"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
    except OSError as exc:
        logger.error(
            "ASSET_STORAGE_PATH %s is not writable (%s). Uploaded DC challan "
            "documents will fail until this directory exists and is writable.",
            root,
            exc,
        )


def _warn_if_ephemeral(configured: str, resolved: Path) -> None:
    text = str(resolved)
    relative = not Path(configured).expanduser().is_absolute()
    ephemeral = relative or any(
        text == prefix or text.startswith(prefix + "/") for prefix in _EPHEMERAL_PREFIXES
    )
    if not ephemeral:
        return
    logger.warning(
        "ASSET_STORAGE_BACKEND=local at %s looks like process-local disk (relative "
        "path or typical container workdir). Files will be lost on redeploy and are "
        "not shared across API replicas. Mount a persistent volume and set "
        "ASSET_STORAGE_PATH to that absolute path. See docs/asset-storage-deployment.md.",
        resolved,
    )
