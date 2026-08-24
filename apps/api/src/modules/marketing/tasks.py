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
    from modules.marketing.domain.enums import ContentRequestStatus, ContentStatus
    from modules.marketing.models import MktContentRequest, MktGeneratedContent, MktPlatform
    from modules.marketing.service.engines.agent_pipeline import run_agent_pipeline

    db = SessionLocal()
    try:
        req = db.get(MktContentRequest, UUID(request_id))
        if req is None or req.is_deleted:
            return {"status": "missing"}
        req.status = ContentRequestStatus.PROCESSING.value
        req.updated_at = _utcnow()
        db.flush()

        platform_code = None
        if req.platform_id:
            platform = db.get(MktPlatform, req.platform_id)
            platform_code = platform.platform_code if platform else None

        result = run_agent_pipeline(req.topic, req.content_type, req.tone, platform_code)
        content_payload = result["content"]

        generated = MktGeneratedContent(
            id=uuid4(),
            tenant_id=req.tenant_id,
            company_id=req.company_id,
            branch_id=req.branch_id,
            content_request_id=req.id,
            campaign_id=req.campaign_id,
            platform_id=req.platform_id,
            headline=content_payload.get("headline"),
            hook=content_payload.get("hook"),
            body=content_payload.get("body") or "",
            cta=content_payload.get("cta"),
            hashtags=content_payload.get("hashtags"),
            scores=result["scores"],
            pipeline_result=result,
            content_version=1,
            ai_model="marketing.agent_pipeline.v1",
            token_count=len((content_payload.get("body") or "").split()),
            status=ContentStatus.DRAFT.value,
            created_by=UUID(user_id) if user_id else req.created_by,
            updated_by=UUID(user_id) if user_id else req.updated_by,
        )
        db.add(generated)
        req.status = ContentRequestStatus.COMPLETED.value
        req.error_message = None
        req.updated_at = _utcnow()
        db.commit()
        return {"status": "completed", "content_id": str(generated.id)}
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
        job.status = PublishJobStatus.RUNNING.value
        job.started_at = _utcnow()
        db.flush()

        job.result_payload = {
            "provider": "stub",
            "message": "Publish simulated successfully",
            "external_post_id": f"stub-{job_id[:8]}",
        }
        job.status = PublishJobStatus.SUCCEEDED.value
        job.completed_at = _utcnow()

        content = db.get(MktGeneratedContent, job.content_id)
        if content is not None:
            content.status = ContentStatus.PUBLISHED.value
            content.updated_at = _utcnow()
        db.commit()
        return {"status": "succeeded"}
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
