"""Load MCP endpoint allowlist from repository config."""

import json
from functools import lru_cache
from pathlib import Path

from modules.mcp_server.models import ExposedEndpointsConfig

_API_ROOT = Path(__file__).resolve().parents[3]  # apps/api
_REPO_ROOT = _API_ROOT.parents[1]
_DEFAULT_CONFIG = _REPO_ROOT / "mcp-server" / "exposed_endpoints.json"


@lru_cache
def load_exposed_endpoints_config(config_path: str | None = None) -> ExposedEndpointsConfig:
    path = Path(config_path) if config_path else _DEFAULT_CONFIG
    if not path.is_file():
        msg = f"MCP allowlist config not found: {path}"
        raise FileNotFoundError(msg)
    raw = json.loads(path.read_text(encoding="utf-8"))
    return ExposedEndpointsConfig.model_validate(raw)


def exposed_endpoints_config_path() -> Path:
    return _DEFAULT_CONFIG
