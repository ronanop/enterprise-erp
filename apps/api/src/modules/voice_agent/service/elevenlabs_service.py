"""Server-side ElevenLabs Conversational AI helpers."""

import httpx

from core.config import settings
from core.exceptions import AppException

_ELEVENLABS_SIGNED_URL = (
    "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url"
)


class ElevenLabsService:
    """Fetches signed WebSocket URLs for private agents (API key never leaves the server)."""

    def get_signed_url(self) -> str:
        api_key = settings.xi_api_key.strip()
        agent_id = settings.elevenlabs_agent_id.strip()
        if not api_key or not agent_id:
            raise AppException(
                "ElevenLabs is not configured (set XI_API_KEY and ELEVENLABS_AGENT_ID)",
                status_code=503,
            )
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(
                    _ELEVENLABS_SIGNED_URL,
                    params={"agent_id": agent_id},
                    headers={"xi-api-key": api_key},
                )
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:500] if exc.response is not None else str(exc)
            raise AppException(
                f"ElevenLabs signed URL request failed: {detail}",
                status_code=502,
            ) from exc
        except httpx.HTTPError as exc:
            raise AppException(
                "Could not reach ElevenLabs API",
                status_code=502,
            ) from exc

        signed_url = payload.get("signed_url")
        if not isinstance(signed_url, str) or not signed_url.startswith("wss://"):
            raise AppException("Invalid signed URL response from ElevenLabs", status_code=502)
        return signed_url
