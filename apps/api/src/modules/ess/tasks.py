"""ESS Celery tasks — feed video compression via FFmpeg."""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
from pathlib import Path
from uuid import UUID

from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _ffmpeg_bin() -> str | None:
    return shutil.which("ffmpeg")


@celery_app.task(name="ess.compress_feed_video")
def compress_feed_video(media_id: str) -> dict:
    """Transcode feed video to H.264 MP4 for efficient MinIO storage."""
    from database.session import SessionLocal
    from modules.ess.feed_storage import (
        load_feed_media_download,
        replace_feed_media_bytes,
    )
    from modules.hr.models.ess_feed import HrEssFeedMedia, HrEssFeedPost

    ffmpeg = _ffmpeg_bin()
    db = SessionLocal()
    try:
        mid = UUID(media_id)
        media = db.get(HrEssFeedMedia, mid)
        if media is None or media.is_deleted or media.media_type != "video":
            return {"ok": False, "reason": "not_found"}

        media.processing_status = "processing"
        db.commit()

        if ffmpeg is None:
            logger.warning("ffmpeg not on PATH — marking feed video ready without compress")
            media.processing_status = "ready"
            post = db.get(HrEssFeedPost, media.post_id)
            if post and post.status == "processing":
                post.status = "published"
            db.commit()
            return {"ok": True, "compressed": False}

        download = load_feed_media_download(media.storage_uri, media.file_name)
        raw = download.content
        if raw is None and download.path:
            raw = Path(download.path).read_bytes()
        if not raw:
            media.processing_status = "failed"
            db.commit()
            return {"ok": False, "reason": "empty"}

        with tempfile.TemporaryDirectory(prefix="ess-feed-") as tmp:
            src = Path(tmp) / "input.bin"
            out = Path(tmp) / "output.mp4"
            src.write_bytes(raw)
            cmd = [
                ffmpeg,
                "-y",
                "-i",
                str(src),
                "-t",
                "60",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "28",
                "-vf",
                "scale='min(1280,iw)':-2",
                "-c:a",
                "aac",
                "-b:a",
                "96k",
                "-movflags",
                "+faststart",
                str(out),
            ]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if proc.returncode != 0 or not out.is_file():
                logger.error("ffmpeg failed: %s", proc.stderr[-800:])
                media.processing_status = "failed"
                db.commit()
                return {"ok": False, "reason": "ffmpeg_failed"}

            compressed = out.read_bytes()
            post = db.get(HrEssFeedPost, media.post_id)
            author_id = post.author_employee_id if post else media.company_id
            uri = replace_feed_media_bytes(
                company_id=media.company_id,
                employee_id=author_id,
                file_name=f"{Path(media.file_name).stem}.mp4",
                raw=compressed,
                content_type="video/mp4",
            )
            media.processed_storage_uri = uri
            media.content_type = "video/mp4"
            media.byte_size = len(compressed)
            media.processing_status = "ready"
            if post and post.status == "processing":
                post.status = "published"
            db.commit()
            return {"ok": True, "compressed": True, "bytes": len(compressed)}
    except Exception:
        logger.exception("compress_feed_video failed for %s", media_id)
        db.rollback()
        try:
            media = db.get(HrEssFeedMedia, UUID(media_id))
            if media:
                media.processing_status = "failed"
                db.commit()
        except Exception:
            db.rollback()
        return {"ok": False, "reason": "exception"}
    finally:
        db.close()


@celery_app.task(name="ess.expire_stories")
def expire_stories() -> dict:
    """Soft-expire Stories past their 24h window."""
    from database.session import SessionLocal
    from modules.hr.repository.ess_story_repository import EssStoryRepository

    db = SessionLocal()
    try:
        n = EssStoryRepository(db).expire_due(limit=1000)
        db.commit()
        return {"ok": True, "expired": n}
    except Exception:
        logger.exception("expire_stories failed")
        db.rollback()
        return {"ok": False}
    finally:
        db.close()


@celery_app.task(name="ess.task_deadline_reminders")
def task_deadline_reminders() -> dict:
    """Remind assignees when workplace-task deadlines are near or overdue."""
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.foundation.service.notification_service import NotificationService
    from modules.hr.models.workplace_task import HrWorkplaceTask, HrWorkplaceTaskAssignee
    from modules.master_data.models.employee import MasterEmployee

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        window = now + timedelta(hours=24)
        rows = list(
            db.execute(
                select(HrWorkplaceTask, HrWorkplaceTaskAssignee, MasterEmployee)
                .join(
                    HrWorkplaceTaskAssignee,
                    HrWorkplaceTaskAssignee.task_id == HrWorkplaceTask.id,
                )
                .join(
                    MasterEmployee,
                    MasterEmployee.id == HrWorkplaceTaskAssignee.employee_id,
                )
                .where(
                    HrWorkplaceTask.is_deleted.is_(False),
                    HrWorkplaceTaskAssignee.is_deleted.is_(False),
                    HrWorkplaceTask.deadline.is_not(None),
                    HrWorkplaceTask.deadline <= window,
                    HrWorkplaceTask.status.in_(("open", "in_progress")),
                    HrWorkplaceTaskAssignee.status.in_(
                        (
                            "assigned",
                            "accepted",
                            "started",
                            "in_progress",
                            "redo_requested",
                        )
                    ),
                )
                .limit(500)
            ).all()
        )
        ntf = NotificationService(db)
        sent = 0
        for task, assignee, emp in rows:
            if emp.user_id is None or task.deadline is None:
                continue
            overdue = task.deadline <= now
            hours = max(0, int((task.deadline - now).total_seconds() // 3600))
            title = "Task overdue" if overdue else "Task deadline approaching"
            body = (
                f"“{task.title}” is overdue. Please finish and submit proof."
                if overdue
                else f"“{task.title}” is due in about {hours}h. Please complete it on time."
            )
            tpl = ntf.get_or_create_template(
                tenant_id=task.tenant_id,
                template_code="ess.task.deadline_reminder",
                template_name="ESS Task Deadline Reminder",
                channel="in_app",
                body_template="{{body}}",
                subject_template="{{title}}",
                created_by=None,
            )
            ntf.send(
                tenant_id=task.tenant_id,
                template_id=tpl.id,
                event_type="ess.task.deadline_reminder",
                recipient_user_id=emp.user_id,
                recipient_address=None,
                payload_json={
                    "title": title,
                    "body": body,
                    "kind": "task",
                    "href": "/task",
                    "task_id": str(task.id),
                },
                created_by=None,
                channel_override="in_app",
            )
            sent += 1
        db.commit()
        return {"ok": True, "sent": sent}
    except Exception:
        logger.exception("task_deadline_reminders failed")
        db.rollback()
        return {"ok": False}
    finally:
        db.close()
