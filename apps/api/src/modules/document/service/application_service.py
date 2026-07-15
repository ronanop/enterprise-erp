"""Document application service facade."""

from sqlalchemy.orm import Session

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


class DocumentApplicationService:
    def __init__(self, db: Session) -> None:
        self.folders = FolderService(db)
        self.documents = DocumentService(db)
        self.versions = DocumentVersionService(db)
        self.metadata = MetadataService(db)
        self.tags = TagService(db)
        self.permissions = PermissionService(db)
        self.shares = ShareService(db)
        self.comments = CommentService(db)
        self.approvals = ApprovalService(db)
        self.workflows = WorkflowService(db)
        self.checkouts = CheckoutService(db)
        self.audits = DocumentAuditService(db)
        self.attachments = AttachmentService(db)
        self.templates = TemplateService(db)
        self.retention = RetentionPolicyService(db)
        self.archives = ArchiveService(db)
        self.notifications = NotificationService(db)
        self.reports = DocumentReportService(db)
        self.integration = DocumentIntegrationService(db)
