"""Non-blocking feed → Foundation Notification Engine (in-app + push fan-out)."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.models.employee import MasterEmployee

logger = logging.getLogger(__name__)

FEED_FANOUT_CAP = 200
FEED_HREF = "/MainTabs/Feed"


def _actor_name(first: str, last: str) -> str:
    return f"{(first or '').strip()} {(last or '').strip()}".strip() or "A teammate"


def _notify_user(
    db: Session,
    *,
    ctx: TenantContext,
    recipient_user_id: UUID,
    template_code: str,
    template_name: str,
    event_type: str,
    title: str,
    body: str,
    post_id: UUID,
) -> None:
    from modules.foundation.service.notification_service import NotificationService

    ntf = NotificationService(db)
    tpl = ntf.get_or_create_template(
        tenant_id=ctx.tenant_id,
        template_code=template_code,
        template_name=template_name,
        channel="in_app",
        body_template="{{body}}",
        subject_template="{{title}}",
        created_by=ctx.user_id,
    )
    ntf.send(
        tenant_id=ctx.tenant_id,
        template_id=tpl.id,
        event_type=event_type,
        recipient_user_id=recipient_user_id,
        recipient_address=None,
        payload_json={
            "title": title,
            "body": body,
            "kind": "feed",
            "href": FEED_HREF,
            "post_id": str(post_id),
        },
        created_by=ctx.user_id,
        channel_override="in_app",
    )


def notify_company_new_post(
    db: Session,
    *,
    ctx: TenantContext,
    company_id: UUID,
    author_employee_id: UUID,
    author_first: str,
    author_last: str,
    post_id: UUID,
    caption: str,
) -> None:
    try:
        actor = _actor_name(author_first, author_last)
        preview = (caption or "").strip()
        if len(preview) > 80:
            preview = preview[:77] + "…"
        body = f"{actor} shared a photo" + (f": {preview}" if preview else "")

        rows = list(
            db.scalars(
                select(MasterEmployee.user_id).where(
                    MasterEmployee.tenant_id == ctx.tenant_id,
                    MasterEmployee.company_id == company_id,
                    MasterEmployee.is_deleted.is_(False),
                    MasterEmployee.status.in_(
                        ("active", "probation", "on_leave", "notice_period")
                    ),
                    MasterEmployee.user_id.is_not(None),
                    MasterEmployee.id != author_employee_id,
                ).limit(FEED_FANOUT_CAP)
            ).all()
        )
        for user_id in rows:
            if user_id is None or user_id == ctx.user_id:
                continue
            _notify_user(
                db,
                ctx=ctx,
                recipient_user_id=user_id,
                template_code="ess.feed.post",
                template_name="ESS Feed New Post",
                event_type="ess.feed.post",
                title="New feed post",
                body=body,
                post_id=post_id,
            )
    except Exception:  # noqa: BLE001 — never break feed write path
        logger.exception("feed notify company new post failed post_id=%s", post_id)


def notify_post_author(
    db: Session,
    *,
    ctx: TenantContext,
    author_employee_id: UUID,
    actor_first: str,
    actor_last: str,
    post_id: UUID,
    kind: str,
    comment_preview: str | None = None,
) -> None:
    """Notify post author of like or comment (skip self-actions)."""
    try:
        author = db.scalar(
            select(MasterEmployee).where(
                MasterEmployee.id == author_employee_id,
                MasterEmployee.is_deleted.is_(False),
            )
        )
        if author is None or author.user_id is None:
            return
        if author.user_id == ctx.user_id:
            return

        actor = _actor_name(actor_first, actor_last)
        if kind == "like":
            title = "New like"
            body = f"{actor} liked your post"
            code = "ess.feed.like"
            name = "ESS Feed Like"
            event = "ess.feed.like"
        else:
            title = "New comment"
            preview = (comment_preview or "").strip()
            if len(preview) > 80:
                preview = preview[:77] + "…"
            body = f"{actor} commented" + (f": {preview}" if preview else "")
            code = "ess.feed.comment"
            name = "ESS Feed Comment"
            event = "ess.feed.comment"

        _notify_user(
            db,
            ctx=ctx,
            recipient_user_id=author.user_id,
            template_code=code,
            template_name=name,
            event_type=event,
            title=title,
            body=body,
            post_id=post_id,
        )
    except Exception:  # noqa: BLE001
        logger.exception(
            "feed notify author failed kind=%s post_id=%s", kind, post_id
        )
