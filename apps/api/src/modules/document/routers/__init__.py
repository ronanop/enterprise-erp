"""Document API route handlers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.document.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_db,
    get_pagination,
    paginate,
    require_permission,
)
from modules.document.schemas import (
    ArchiveCreate,
    ArchiveResponse,
    ArchiveUpdate,
    DocumentApprovalCreate,
    DocumentApprovalResponse,
    DocumentApprovalUpdate,
    DocumentAttachmentCreate,
    DocumentAttachmentResponse,
    DocumentAttachmentUpdate,
    DocumentAuditCreate,
    DocumentAuditResponse,
    DocumentAuditUpdate,
    DocumentCheckoutCreate,
    DocumentCheckoutResponse,
    DocumentCheckoutUpdate,
    DocumentCommentCreate,
    DocumentCommentResponse,
    DocumentCommentUpdate,
    DocumentCreate,
    DocumentMetadataCreate,
    DocumentMetadataResponse,
    DocumentMetadataUpdate,
    DocumentPermissionCreate,
    DocumentPermissionResponse,
    DocumentPermissionUpdate,
    DocumentResponse,
    DocumentShareCreate,
    DocumentShareResponse,
    DocumentShareUpdate,
    DocumentTagCreate,
    DocumentTagMapCreate,
    DocumentTagMapResponse,
    DocumentTagMapUpdate,
    DocumentTagResponse,
    DocumentTagUpdate,
    DocumentUpdate,
    DocumentVersionCreate,
    DocumentVersionResponse,
    DocumentVersionUpdate,
    DocumentWorkflowCreate,
    DocumentWorkflowResponse,
    DocumentWorkflowUpdate,
    FolderCreate,
    FolderResponse,
    FolderUpdate,
    NotificationCreate,
    NotificationResponse,
    NotificationUpdate,
    ReportCreate,
    ReportResponse,
    ReportUpdate,
    RetentionPolicyCreate,
    RetentionPolicyResponse,
    RetentionPolicyUpdate,
    TemplateCreate,
    TemplateFieldCreate,
    TemplateFieldResponse,
    TemplateFieldUpdate,
    TemplateResponse,
    TemplateUpdate,
)
from modules.document.service import (
    ApprovalService,
    ArchiveService,
    AttachmentService,
    CheckoutService,
    CommentService,
    DocumentAuditService,
    DocumentReportService,
    DocumentService,
    DocumentVersionService,
    FolderService,
    MetadataService,
    NotificationService,
    PermissionService,
    RetentionPolicyService,
    ShareService,
    TagService,
    TemplateService,
    WorkflowService,
)
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

folders_router = APIRouter(prefix="/folders", tags=["Document — Folder"])

@folders_router.get("", response_model=APIResponse[list[FolderResponse]])
def list_folders(
    ctx: Annotated[TenantContext, Depends(require_permission("document.folder:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = FolderService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@folders_router.get("/{row_id}", response_model=APIResponse[FolderResponse])
def get_folders(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.folder:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=FolderService(db).get(ctx, row_id))

@folders_router.post("", response_model=APIResponse[FolderResponse])
def create_folders(
    body: FolderCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.folder:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=FolderService(db).create(ctx, **body.model_dump(exclude_none=True)))

@folders_router.patch("/{row_id}", response_model=APIResponse[FolderResponse])
def update_folders(
    row_id: UUID,
    body: FolderUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.folder:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=FolderService(db).update(ctx, row_id, **extract_update_fields(body)))

documents_router = APIRouter(prefix="/documents", tags=["Document — Document"])

@documents_router.get("", response_model=APIResponse[list[DocumentResponse]])
def list_documents(
    ctx: Annotated[TenantContext, Depends(require_permission("document.document:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DocumentService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@documents_router.get("/{row_id}", response_model=APIResponse[DocumentResponse])
def get_documents(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.document:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DocumentService(db).get(ctx, row_id))

@documents_router.post("", response_model=APIResponse[DocumentResponse])
def create_documents(
    body: DocumentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.document:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DocumentService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@documents_router.patch("/{row_id}", response_model=APIResponse[DocumentResponse])
def update_documents(
    row_id: UUID,
    body: DocumentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.document:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DocumentService(db).update(ctx, row_id, **extract_update_fields(body)))

@documents_router.post("/{row_id}/submit", response_model=APIResponse[DocumentResponse])
def submit_documents(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.document:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=DocumentService(db).submit(ctx, row_id))

@documents_router.post("/{row_id}/approve", response_model=APIResponse[DocumentResponse])
def approve_documents(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.document:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=DocumentService(db).approve(ctx, row_id))

@documents_router.post("/{row_id}/publish", response_model=APIResponse[DocumentResponse])
def publish_documents(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.document:publish"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="publish", data=DocumentService(db).publish(ctx, row_id))

document_versions_router = APIRouter(prefix="/document-versions", tags=["Document — DocumentVersion"])

@document_versions_router.get("", response_model=APIResponse[list[DocumentVersionResponse]])
def list_document_versions(
    ctx: Annotated[TenantContext, Depends(require_permission("document.version:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DocumentVersionService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@document_versions_router.get("/{row_id}", response_model=APIResponse[DocumentVersionResponse])
def get_document_versions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.version:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DocumentVersionService(db).get(ctx, row_id))

@document_versions_router.post("", response_model=APIResponse[DocumentVersionResponse])
def create_document_versions(
    body: DocumentVersionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.version:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DocumentVersionService(db).create(ctx, **body.model_dump(exclude_none=True)))

@document_versions_router.patch("/{row_id}", response_model=APIResponse[DocumentVersionResponse])
def update_document_versions(
    row_id: UUID,
    body: DocumentVersionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.version:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DocumentVersionService(db).update(ctx, row_id, **extract_update_fields(body)))

document_metadata_router = APIRouter(prefix="/document-metadata", tags=["Document — DocumentMetadata"])

@document_metadata_router.get("", response_model=APIResponse[list[DocumentMetadataResponse]])
def list_document_metadata(
    ctx: Annotated[TenantContext, Depends(require_permission("document.metadata:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = MetadataService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@document_metadata_router.get("/{row_id}", response_model=APIResponse[DocumentMetadataResponse])
def get_document_metadata(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.metadata:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=MetadataService(db).get(ctx, row_id))

@document_metadata_router.post("", response_model=APIResponse[DocumentMetadataResponse])
def create_document_metadata(
    body: DocumentMetadataCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.metadata:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=MetadataService(db).create(ctx, **body.model_dump(exclude_none=True)))

@document_metadata_router.patch("/{row_id}", response_model=APIResponse[DocumentMetadataResponse])
def update_document_metadata(
    row_id: UUID,
    body: DocumentMetadataUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.metadata:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=MetadataService(db).update(ctx, row_id, **extract_update_fields(body)))

document_tags_router = APIRouter(prefix="/document-tags", tags=["Document — DocumentTag"])

@document_tags_router.get("", response_model=APIResponse[list[DocumentTagResponse]])
def list_document_tags(
    ctx: Annotated[TenantContext, Depends(require_permission("document.tag:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TagService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@document_tags_router.get("/{row_id}", response_model=APIResponse[DocumentTagResponse])
def get_document_tags(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.tag:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TagService(db).get(ctx, row_id))

@document_tags_router.post("", response_model=APIResponse[DocumentTagResponse])
def create_document_tags(
    body: DocumentTagCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.tag:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=TagService(db).create(ctx, **body.model_dump(exclude_none=True)))

@document_tags_router.patch("/{row_id}", response_model=APIResponse[DocumentTagResponse])
def update_document_tags(
    row_id: UUID,
    body: DocumentTagUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.tag:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=TagService(db).update(ctx, row_id, **extract_update_fields(body)))

document_tag_maps_router = APIRouter(prefix="/document-tag-maps", tags=["Document — DocumentTagMap"])

@document_tag_maps_router.get("", response_model=APIResponse[list[DocumentTagMapResponse]])
def list_document_tag_maps(
    ctx: Annotated[TenantContext, Depends(require_permission("document.tag:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TagService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@document_tag_maps_router.get("/{row_id}", response_model=APIResponse[DocumentTagMapResponse])
def get_document_tag_maps(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.tag:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TagService(db).get(ctx, row_id))

@document_tag_maps_router.post("", response_model=APIResponse[DocumentTagMapResponse])
def create_document_tag_maps(
    body: DocumentTagMapCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.tag:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=TagService(db).create(ctx, **body.model_dump(exclude_none=True)))

@document_tag_maps_router.patch("/{row_id}", response_model=APIResponse[DocumentTagMapResponse])
def update_document_tag_maps(
    row_id: UUID,
    body: DocumentTagMapUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.tag:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=TagService(db).update(ctx, row_id, **extract_update_fields(body)))

document_permissions_router = APIRouter(prefix="/document-permissions", tags=["Document — DocumentPermission"])

@document_permissions_router.get("", response_model=APIResponse[list[DocumentPermissionResponse]])
def list_document_permissions(
    ctx: Annotated[TenantContext, Depends(require_permission("document.permission:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = PermissionService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@document_permissions_router.get("/{row_id}", response_model=APIResponse[DocumentPermissionResponse])
def get_document_permissions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.permission:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PermissionService(db).get(ctx, row_id))

@document_permissions_router.post("", response_model=APIResponse[DocumentPermissionResponse])
def create_document_permissions(
    body: DocumentPermissionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.permission:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PermissionService(db).create(ctx, **body.model_dump(exclude_none=True)))

@document_permissions_router.patch("/{row_id}", response_model=APIResponse[DocumentPermissionResponse])
def update_document_permissions(
    row_id: UUID,
    body: DocumentPermissionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.permission:revoke"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PermissionService(db).update(ctx, row_id, **extract_update_fields(body)))

document_shares_router = APIRouter(prefix="/document-shares", tags=["Document — DocumentShare"])

@document_shares_router.get("", response_model=APIResponse[list[DocumentShareResponse]])
def list_document_shares(
    ctx: Annotated[TenantContext, Depends(require_permission("document.share:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ShareService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@document_shares_router.get("/{row_id}", response_model=APIResponse[DocumentShareResponse])
def get_document_shares(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.share:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ShareService(db).get(ctx, row_id))

@document_shares_router.post("", response_model=APIResponse[DocumentShareResponse])
def create_document_shares(
    body: DocumentShareCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.share:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ShareService(db).create(ctx, **body.model_dump(exclude_none=True)))

@document_shares_router.patch("/{row_id}", response_model=APIResponse[DocumentShareResponse])
def update_document_shares(
    row_id: UUID,
    body: DocumentShareUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.share:revoke"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ShareService(db).update(ctx, row_id, **extract_update_fields(body)))

document_comments_router = APIRouter(prefix="/document-comments", tags=["Document — DocumentComment"])

@document_comments_router.get("", response_model=APIResponse[list[DocumentCommentResponse]])
def list_document_comments(
    ctx: Annotated[TenantContext, Depends(require_permission("document.comment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = CommentService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@document_comments_router.get("/{row_id}", response_model=APIResponse[DocumentCommentResponse])
def get_document_comments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.comment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CommentService(db).get(ctx, row_id))

@document_comments_router.post("", response_model=APIResponse[DocumentCommentResponse])
def create_document_comments(
    body: DocumentCommentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.comment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=CommentService(db).create(ctx, **body.model_dump(exclude_none=True)))

@document_comments_router.patch("/{row_id}", response_model=APIResponse[DocumentCommentResponse])
def update_document_comments(
    row_id: UUID,
    body: DocumentCommentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.comment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=CommentService(db).update(ctx, row_id, **extract_update_fields(body)))

document_approvals_router = APIRouter(prefix="/document-approvals", tags=["Document — DocumentApproval"])

@document_approvals_router.get("", response_model=APIResponse[list[DocumentApprovalResponse]])
def list_document_approvals(
    ctx: Annotated[TenantContext, Depends(require_permission("document.approval:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ApprovalService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@document_approvals_router.get("/{row_id}", response_model=APIResponse[DocumentApprovalResponse])
def get_document_approvals(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.approval:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ApprovalService(db).get(ctx, row_id))

@document_approvals_router.post("", response_model=APIResponse[DocumentApprovalResponse])
def create_document_approvals(
    body: DocumentApprovalCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.approval:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ApprovalService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@document_approvals_router.patch("/{row_id}", response_model=APIResponse[DocumentApprovalResponse])
def update_document_approvals(
    row_id: UUID,
    body: DocumentApprovalUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.approval:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ApprovalService(db).update(ctx, row_id, **extract_update_fields(body)))

@document_approvals_router.post("/{row_id}/submit", response_model=APIResponse[DocumentApprovalResponse])
def submit_document_approvals(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.approval:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=ApprovalService(db).submit(ctx, row_id))

@document_approvals_router.post("/{row_id}/complete", response_model=APIResponse[DocumentApprovalResponse])
def complete_document_approvals(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.approval:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="complete", data=ApprovalService(db).complete(ctx, row_id))

document_workflows_router = APIRouter(prefix="/document-workflows", tags=["Document — DocumentWorkflow"])

@document_workflows_router.get("", response_model=APIResponse[list[DocumentWorkflowResponse]])
def list_document_workflows(
    ctx: Annotated[TenantContext, Depends(require_permission("document.workflow:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = WorkflowService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@document_workflows_router.get("/{row_id}", response_model=APIResponse[DocumentWorkflowResponse])
def get_document_workflows(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.workflow:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=WorkflowService(db).get(ctx, row_id))

@document_workflows_router.post("", response_model=APIResponse[DocumentWorkflowResponse])
def create_document_workflows(
    body: DocumentWorkflowCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.workflow:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=WorkflowService(db).create(ctx, **body.model_dump(exclude_none=True)))

@document_workflows_router.patch("/{row_id}", response_model=APIResponse[DocumentWorkflowResponse])
def update_document_workflows(
    row_id: UUID,
    body: DocumentWorkflowUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.workflow:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=WorkflowService(db).update(ctx, row_id, **extract_update_fields(body)))

document_checkouts_router = APIRouter(prefix="/document-checkouts", tags=["Document — DocumentCheckout"])

@document_checkouts_router.get("", response_model=APIResponse[list[DocumentCheckoutResponse]])
def list_document_checkouts(
    ctx: Annotated[TenantContext, Depends(require_permission("document.checkout:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = CheckoutService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@document_checkouts_router.get("/{row_id}", response_model=APIResponse[DocumentCheckoutResponse])
def get_document_checkouts(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.checkout:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CheckoutService(db).get(ctx, row_id))

@document_checkouts_router.post("", response_model=APIResponse[DocumentCheckoutResponse])
def create_document_checkouts(
    body: DocumentCheckoutCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.checkout:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=CheckoutService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@document_checkouts_router.patch("/{row_id}", response_model=APIResponse[DocumentCheckoutResponse])
def update_document_checkouts(
    row_id: UUID,
    body: DocumentCheckoutUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.checkout:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=CheckoutService(db).update(ctx, row_id, **extract_update_fields(body)))

@document_checkouts_router.post("/{row_id}/submit", response_model=APIResponse[DocumentCheckoutResponse])
def submit_document_checkouts(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.checkout:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=CheckoutService(db).submit(ctx, row_id))

@document_checkouts_router.post("/{row_id}/complete", response_model=APIResponse[DocumentCheckoutResponse])
def complete_document_checkouts(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.checkout:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="complete", data=CheckoutService(db).complete(ctx, row_id))

@document_checkouts_router.post("/{row_id}/checkin", response_model=APIResponse[DocumentCheckoutResponse])
def checkin_document_checkouts(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.checkout:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="checkin", data=CheckoutService(db).checkin(ctx, row_id))

document_audits_router = APIRouter(prefix="/document-audits", tags=["Document — DocumentAudit"])

@document_audits_router.get("", response_model=APIResponse[list[DocumentAuditResponse]])
def list_document_audits(
    ctx: Annotated[TenantContext, Depends(require_permission("document.audit:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DocumentAuditService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@document_audits_router.get("/{row_id}", response_model=APIResponse[DocumentAuditResponse])
def get_document_audits(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.audit:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DocumentAuditService(db).get(ctx, row_id))

@document_audits_router.post("", response_model=APIResponse[DocumentAuditResponse])
def create_document_audits(
    body: DocumentAuditCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.audit:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DocumentAuditService(db).create(ctx, **body.model_dump(exclude_none=True)))

@document_audits_router.patch("/{row_id}", response_model=APIResponse[DocumentAuditResponse])
def update_document_audits(
    row_id: UUID,
    body: DocumentAuditUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.audit:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DocumentAuditService(db).update(ctx, row_id, **extract_update_fields(body)))

document_attachments_router = APIRouter(prefix="/document-attachments", tags=["Document — DocumentAttachment"])

@document_attachments_router.get("", response_model=APIResponse[list[DocumentAttachmentResponse]])
def list_document_attachments(
    ctx: Annotated[TenantContext, Depends(require_permission("document.attachment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = AttachmentService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@document_attachments_router.get("/{row_id}", response_model=APIResponse[DocumentAttachmentResponse])
def get_document_attachments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.attachment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AttachmentService(db).get(ctx, row_id))

@document_attachments_router.post("", response_model=APIResponse[DocumentAttachmentResponse])
def create_document_attachments(
    body: DocumentAttachmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.attachment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=AttachmentService(db).create(ctx, **body.model_dump(exclude_none=True)))

@document_attachments_router.patch("/{row_id}", response_model=APIResponse[DocumentAttachmentResponse])
def update_document_attachments(
    row_id: UUID,
    body: DocumentAttachmentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.attachment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=AttachmentService(db).update(ctx, row_id, **extract_update_fields(body)))

templates_router = APIRouter(prefix="/templates", tags=["Document — Template"])

@templates_router.get("", response_model=APIResponse[list[TemplateResponse]])
def list_templates(
    ctx: Annotated[TenantContext, Depends(require_permission("document.template:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TemplateService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@templates_router.get("/{row_id}", response_model=APIResponse[TemplateResponse])
def get_templates(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.template:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TemplateService(db).get(ctx, row_id))

@templates_router.post("", response_model=APIResponse[TemplateResponse])
def create_templates(
    body: TemplateCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.template:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=TemplateService(db).create(ctx, **body.model_dump(exclude_none=True)))

@templates_router.patch("/{row_id}", response_model=APIResponse[TemplateResponse])
def update_templates(
    row_id: UUID,
    body: TemplateUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.template:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=TemplateService(db).update(ctx, row_id, **extract_update_fields(body)))

template_fields_router = APIRouter(prefix="/template-fields", tags=["Document — TemplateField"])

@template_fields_router.get("", response_model=APIResponse[list[TemplateFieldResponse]])
def list_template_fields(
    ctx: Annotated[TenantContext, Depends(require_permission("document.template:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TemplateService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@template_fields_router.get("/{row_id}", response_model=APIResponse[TemplateFieldResponse])
def get_template_fields(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.template:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TemplateService(db).get(ctx, row_id))

@template_fields_router.post("", response_model=APIResponse[TemplateFieldResponse])
def create_template_fields(
    body: TemplateFieldCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.template:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=TemplateService(db).create(ctx, **body.model_dump(exclude_none=True)))

@template_fields_router.patch("/{row_id}", response_model=APIResponse[TemplateFieldResponse])
def update_template_fields(
    row_id: UUID,
    body: TemplateFieldUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.template:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=TemplateService(db).update(ctx, row_id, **extract_update_fields(body)))

retention_policies_router = APIRouter(prefix="/retention-policies", tags=["Document — RetentionPolicy"])

@retention_policies_router.get("", response_model=APIResponse[list[RetentionPolicyResponse]])
def list_retention_policies(
    ctx: Annotated[TenantContext, Depends(require_permission("document.retention:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = RetentionPolicyService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@retention_policies_router.get("/{row_id}", response_model=APIResponse[RetentionPolicyResponse])
def get_retention_policies(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.retention:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=RetentionPolicyService(db).get(ctx, row_id))

@retention_policies_router.post("", response_model=APIResponse[RetentionPolicyResponse])
def create_retention_policies(
    body: RetentionPolicyCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.retention:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=RetentionPolicyService(db).create(ctx, **body.model_dump(exclude_none=True)))

@retention_policies_router.patch("/{row_id}", response_model=APIResponse[RetentionPolicyResponse])
def update_retention_policies(
    row_id: UUID,
    body: RetentionPolicyUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.retention:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=RetentionPolicyService(db).update(ctx, row_id, **extract_update_fields(body)))

@retention_policies_router.post("/{row_id}/submit", response_model=APIResponse[RetentionPolicyResponse])
def submit_retention_policies(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.retention:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=RetentionPolicyService(db).submit(ctx, row_id))

@retention_policies_router.post("/{row_id}/approve", response_model=APIResponse[RetentionPolicyResponse])
def approve_retention_policies(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.retention:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=RetentionPolicyService(db).approve(ctx, row_id))

archives_router = APIRouter(prefix="/archives", tags=["Document — Archive"])

@archives_router.get("", response_model=APIResponse[list[ArchiveResponse]])
def list_archives(
    ctx: Annotated[TenantContext, Depends(require_permission("document.archive:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ArchiveService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@archives_router.get("/{row_id}", response_model=APIResponse[ArchiveResponse])
def get_archives(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.archive:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ArchiveService(db).get(ctx, row_id))

@archives_router.post("", response_model=APIResponse[ArchiveResponse])
def create_archives(
    body: ArchiveCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.archive:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ArchiveService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@archives_router.patch("/{row_id}", response_model=APIResponse[ArchiveResponse])
def update_archives(
    row_id: UUID,
    body: ArchiveUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.archive:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ArchiveService(db).update(ctx, row_id, **extract_update_fields(body)))

@archives_router.post("/{row_id}/submit", response_model=APIResponse[ArchiveResponse])
def submit_archives(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.archive:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=ArchiveService(db).submit(ctx, row_id))

@archives_router.post("/{row_id}/approve", response_model=APIResponse[ArchiveResponse])
def approve_archives(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.archive:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=ArchiveService(db).approve(ctx, row_id))

notifications_router = APIRouter(prefix="/notifications", tags=["Document — Notification"])

@notifications_router.get("", response_model=APIResponse[list[NotificationResponse]])
def list_notifications(
    ctx: Annotated[TenantContext, Depends(require_permission("document.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = NotificationService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@notifications_router.get("/{row_id}", response_model=APIResponse[NotificationResponse])
def get_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=NotificationService(db).get(ctx, row_id))

@notifications_router.post("", response_model=APIResponse[NotificationResponse])
def create_notifications(
    body: NotificationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=NotificationService(db).create(ctx, **body.model_dump(exclude_none=True)))

@notifications_router.patch("/{row_id}", response_model=APIResponse[NotificationResponse])
def update_notifications(
    row_id: UUID,
    body: NotificationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=NotificationService(db).update(ctx, row_id, **extract_update_fields(body)))

reports_router = APIRouter(prefix="/reports", tags=["Document — Report"])

@reports_router.get("", response_model=APIResponse[list[ReportResponse]])
def list_reports(
    ctx: Annotated[TenantContext, Depends(require_permission("document.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DocumentReportService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@reports_router.get("/{row_id}", response_model=APIResponse[ReportResponse])
def get_reports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("document.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DocumentReportService(db).get(ctx, row_id))

@reports_router.post("", response_model=APIResponse[ReportResponse])
def create_reports(
    body: ReportCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.report:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DocumentReportService(db).create(ctx, **body.model_dump(exclude_none=True)))

@reports_router.patch("/{row_id}", response_model=APIResponse[ReportResponse])
def update_reports(
    row_id: UUID,
    body: ReportUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("document.report:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DocumentReportService(db).update(ctx, row_id, **extract_update_fields(body)))

