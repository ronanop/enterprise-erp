"""Document services."""

from modules.document.service.application_service import DocumentApplicationService
from modules.document.service.approval_service import ApprovalService
from modules.document.service.archive_service import ArchiveService
from modules.document.service.attachment_service import AttachmentService
from modules.document.service.checkout_service import CheckoutService
from modules.document.service.comment_service import CommentService
from modules.document.service.document_audit_service import DocumentAuditService
from modules.document.service.document_report_service import DocumentReportService
from modules.document.service.document_service import DocumentService
from modules.document.service.document_version_service import DocumentVersionService
from modules.document.service.folder_service import FolderService
from modules.document.service.integration_service import DocumentIntegrationService
from modules.document.service.metadata_service import MetadataService
from modules.document.service.notification_service import NotificationService
from modules.document.service.permission_service import PermissionService
from modules.document.service.retention_policy_service import RetentionPolicyService
from modules.document.service.share_service import ShareService
from modules.document.service.tag_service import TagService
from modules.document.service.template_service import TemplateService
from modules.document.service.workflow_service import WorkflowService

__all__ = [
    "ApprovalService",
    "ArchiveService",
    "AttachmentService",
    "CheckoutService",
    "CommentService",
    "DocumentApplicationService",
    "DocumentAuditService",
    "DocumentIntegrationService",
    "DocumentReportService",
    "DocumentService",
    "DocumentVersionService",
    "FolderService",
    "MetadataService",
    "NotificationService",
    "PermissionService",
    "RetentionPolicyService",
    "ShareService",
    "TagService",
    "TemplateService",
    "WorkflowService",
]
