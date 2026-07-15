"""Document module router aggregation."""

from fastapi import APIRouter

from modules.document.routers import (
    archives_router,
    document_approvals_router,
    document_attachments_router,
    document_audits_router,
    document_checkouts_router,
    document_comments_router,
    document_metadata_router,
    document_permissions_router,
    document_shares_router,
    document_tag_maps_router,
    document_tags_router,
    document_versions_router,
    document_workflows_router,
    documents_router,
    folders_router,
    notifications_router,
    reports_router,
    retention_policies_router,
    template_fields_router,
    templates_router,
)

document_router = APIRouter(prefix="/documents")
document_router.include_router(folders_router)
document_router.include_router(documents_router)
document_router.include_router(document_versions_router)
document_router.include_router(document_metadata_router)
document_router.include_router(document_tags_router)
document_router.include_router(document_tag_maps_router)
document_router.include_router(document_permissions_router)
document_router.include_router(document_shares_router)
document_router.include_router(document_comments_router)
document_router.include_router(document_approvals_router)
document_router.include_router(document_workflows_router)
document_router.include_router(document_checkouts_router)
document_router.include_router(document_audits_router)
document_router.include_router(document_attachments_router)
document_router.include_router(templates_router)
document_router.include_router(template_fields_router)
document_router.include_router(retention_policies_router)
document_router.include_router(archives_router)
document_router.include_router(notifications_router)
document_router.include_router(reports_router)
