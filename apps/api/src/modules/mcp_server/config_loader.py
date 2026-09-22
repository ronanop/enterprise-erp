"""Load MCP endpoint allowlist from repository config."""

import json
from functools import lru_cache
from pathlib import Path

from modules.mcp_server.models import ExposedEndpointsConfig

_API_ROOT = Path(__file__).resolve().parents[3]  # apps/api locally, /app in Docker
_REPO_ROOT = _API_ROOT.parent if (_API_ROOT / "mcp-server").is_dir() else _API_ROOT.parents[1]


def _default_config_candidates() -> list[Path]:
    return [
        _API_ROOT / "mcp-server" / "exposed_endpoints.json",
        _REPO_ROOT / "mcp-server" / "exposed_endpoints.json",
        Path("/app/mcp-server/exposed_endpoints.json"),
    ]


_DEFAULT_CONFIG = next(
    (path for path in _default_config_candidates() if path.is_file()),
    _API_ROOT / "mcp-server" / "exposed_endpoints.json",
)


@lru_cache
def load_exposed_endpoints_config(config_path: str | None = None) -> ExposedEndpointsConfig:
    path = Path(config_path) if config_path else _DEFAULT_CONFIG
    if not path.is_file():
        for candidate in _default_config_candidates():
            if candidate.is_file():
                path = candidate
                break
    if not path.is_file():
        msg = f"MCP allowlist config not found: {path}"
        raise FileNotFoundError(msg)
    raw = json.loads(path.read_text(encoding="utf-8"))
    return ExposedEndpointsConfig.model_validate(raw)


def exposed_endpoints_config_path() -> Path:
    for candidate in _default_config_candidates():
        if candidate.is_file():
            return candidate
    return _DEFAULT_CONFIG
