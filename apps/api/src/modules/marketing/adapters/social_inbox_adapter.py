"""Pull comments and mentions for posts this module actually published."""

from __future__ import annotations

from typing import Any


class SocialInboxAdapter:
    def pull(
        self,
        *,
        platform_code: str | None,
        external_post_id: str | None,
    ) -> list[dict[str, Any]]:
        post_id = (external_post_id or "").strip()
        if not post_id or post_id.startswith("stub-"):
            return []
        code = (platform_code or "").strip().lower()
        if code not in {"linkedin", "instagram"}:
            return []
        # Live Graph / LinkedIn comment APIs require the Integration Hub token.
        # Return nothing rather than a fake thread.
        return []
