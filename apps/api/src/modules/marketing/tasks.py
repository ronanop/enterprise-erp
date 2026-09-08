"""Celery agent pipeline for content intelligence (ERP-aligned)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from workers.celery_app import celery_app


def _utcnow():
    return datetime.now(timezone.utc)


@celery_app.task(name="marketing.run_content_agent_pipeline")
def run_content_agent_pipeline(request_id: str, tenant_id: str, user_id: str) -> dict:
    from database.session import SessionLocal
    from modules.marketing.domain.enums import ContentRequestStatus
    from modules.marketing.models import MktContentRequest

    db = SessionLocal()
    try:
        req = db.get(MktContentRequest, UUID(request_id))
        if req is None or req.is_deleted:
            return {"status": "missing"}
        req.status = ContentRequestStatus.PROCESSING.value
        req.updated_at = _utcnow()
        db.flush()

        from modules.foundation.domain.value_objects import TenantContext
        from modules.marketing.service.engines.writer_pipeline import generate_variants

        actor = UUID(user_id) if user_id else req.created_by
        ctx = TenantContext(
            tenant_id=req.tenant_id,
            user_id=actor,
            user_type="user",
            company_id=req.company_id,
        )
        created = generate_variants(db, ctx, req)
        req.status = ContentRequestStatus.COMPLETED.value
        req.error_message = None
        req.updated_at = _utcnow()
        db.commit()
        return {"status": "completed", "content_ids": [str(row.id) for row in created]}
    except Exception as exc:  # noqa: BLE001 — worker must mark failure
        db.rollback()
        req = db.get(MktContentRequest, UUID(request_id))
        if req is not None:
            req.status = ContentRequestStatus.FAILED.value
            req.error_message = str(exc)[:2000]
            req.updated_at = _utcnow()
            db.commit()
        return {"status": "failed", "error": str(exc)}
    finally:
        db.close()


@celery_app.task(name="marketing.run_publish_job")
def run_publish_job(job_id: str) -> dict:
    from database.session import SessionLocal
    from modules.marketing.domain.enums import ContentStatus, PublishJobStatus
    from modules.marketing.models import MktGeneratedContent, MktPublishJob

    db = SessionLocal()
    try:
        job = db.get(MktPublishJob, UUID(job_id))
        if job is None or job.is_deleted:
            return {"status": "missing"}
        from modules.marketing.adapters.social_publish_adapter import SocialPublishAdapter
        from modules.marketing.models import MktPlatform, MktSocialAccount
        from modules.marketing.service.publish_truth import is_live_post_id

        job.status = PublishJobStatus.RUNNING.value
        job.started_at = _utcnow()
        db.flush()

        content = db.get(MktGeneratedContent, job.content_id)
        account = db.get(MktSocialAccount, job.social_account_id) if job.social_account_id else None
        platform = db.get(MktPlatform, job.platform_id) if job.platform_id else None
        result = SocialPublishAdapter().publish(
            platform_code=platform.platform_code if platform else None,
            external_account_id=account.external_account_id if account else None,
            body=content.body if content is not None else "",
        )
        job.result_payload = result
        if is_live_post_id(result.get("external_post_id")):
            job.status = PublishJobStatus.SUCCEEDED.value
            job.completed_at = _utcnow()
            if content is not None:
                content.status = ContentStatus.PUBLISHED.value
                content.updated_at = _utcnow()
        else:
            job.status = PublishJobStatus.QUEUED.value
            job.completed_at = None
            if content is not None and content.status == ContentStatus.APPROVED.value:
                content.status = ContentStatus.SCHEDULED.value
                content.updated_at = _utcnow()
        db.commit()
        return {"status": job.status}
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        job = db.get(MktPublishJob, UUID(job_id))
        if job is not None:
            job.status = PublishJobStatus.FAILED.value
            job.error_message = str(exc)[:2000]
            job.completed_at = _utcnow()
            db.commit()
        return {"status": "failed", "error": str(exc)}
    finally:
        db.close()
