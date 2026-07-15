"""Document Celery task stubs per ERD_18 section 15."""

from workers.celery_app import celery_app


@celery_app.task(name="document.retention_policy_runner")
def retention_policy_runner() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.document.models import DocRetentionPolicy

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(DocRetentionPolicy).where(
                    DocRetentionPolicy.is_deleted.is_(False),
                    DocRetentionPolicy.status == "active",
                )
            ).all()
        )
        return {"status": "ok", "active_policies": len(rows)}
    finally:
        db.close()


@celery_app.task(name="document.archive_scheduler")
def archive_scheduler() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.document.models import DocArchive

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(DocArchive).where(
                    DocArchive.is_deleted.is_(False),
                    DocArchive.status.in_(["draft", "submitted"]),
                )
            ).all()
        )
        return {"status": "ok", "pending_archives": len(rows)}
    finally:
        db.close()


@celery_app.task(name="document.document_expiry_notifications")
def document_expiry_notifications() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.document.models import DocDocument

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(DocDocument).where(
                    DocDocument.is_deleted.is_(False),
                    DocDocument.expires_at.is_not(None),
                    DocDocument.status.in_(["published", "approved"]),
                )
            ).all()
        )
        return {"status": "ok", "expiring_documents": len(rows)}
    finally:
        db.close()


@celery_app.task(name="document.document_review_reminders")
def document_review_reminders() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.document.models import DocDocumentApproval

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(DocDocumentApproval).where(
                    DocDocumentApproval.is_deleted.is_(False),
                    DocDocumentApproval.status == "submitted",
                )
            ).all()
        )
        return {"status": "ok", "pending_approvals": len(rows)}
    finally:
        db.close()


@celery_app.task(name="document.metadata_index_refresh")
def metadata_index_refresh() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.document.models import DocDocumentMetadata

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(DocDocumentMetadata).where(
                    DocDocumentMetadata.is_deleted.is_(False),
                    DocDocumentMetadata.status == "active",
                )
            ).all()
        )
        return {"status": "ok", "active_metadata_rows": len(rows)}
    finally:
        db.close()


@celery_app.task(name="document.retry_finance_posting")
def retry_finance_posting() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.document.models import DocDocument

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(DocDocument).where(
                    DocDocument.is_deleted.is_(False),
                    DocDocument.status == "published",
                    DocDocument.finance_journal_id.is_(None),
                )
            ).all()
        )
        return {"status": "ok", "unposted_documents": len(rows)}
    finally:
        db.close()
