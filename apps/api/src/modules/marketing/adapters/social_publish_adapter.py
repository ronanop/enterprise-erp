"""Outbound publish. Never invents a post ID."""

from __future__ import annotations

from typing import Any


class SocialPublishAdapter:
    """Live LinkedIn / Instagram publish is credential-gated. Missing credentials stay queued."""

    def publish(
        self,
        *,
        platform_code: str | None,
        external_account_id: str | None,
        body: str,
    ) -> dict[str, Any]:
        code = (platform_code or "").strip().lower()
        if code not in {"linkedin", "instagram"} or not external_account_id:
            return {
                "provider": "awaiting_live_publisher",
                "message": "Waiting for a connected LinkedIn or Instagram account",
                "external_post_id": None,
            }
        # Tokens live on the Integration Hub connector. Until that handshake exists, do not simulate success.
        return {
            "provider": "awaiting_live_publisher",
            "platform": code,
            "message": "Account is known, but the live publisher token is not configured",
            "external_post_id": None,
        }
