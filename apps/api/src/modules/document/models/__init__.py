"""Document ORM models."""

from modules.document.models.archive import DocArchive
from modules.document.models.document import DocDocument
from modules.document.models.document_approval import DocDocumentApproval
from modules.document.models.document_attachment import DocDocumentAttachment
from modules.document.models.document_audit import DocDocumentAudit
from modules.document.models.document_checkout import DocDocumentCheckout
from modules.document.models.document_comment import DocDocumentComment
from modules.document.models.document_metadata import DocDocumentMetadata
from modules.document.models.document_permission import DocDocumentPermission
from modules.document.models.document_share import DocDocumentShare
from modules.document.models.document_tag import DocDocumentTag
from modules.document.models.document_tag_map import DocDocumentTagMap
from modules.document.models.document_version import DocDocumentVersion
from modules.document.models.document_workflow import DocDocumentWorkflow
from modules.document.models.folder import DocFolder
from modules.document.models.notification import DocNotification
from modules.document.models.report import DocReport
from modules.document.models.retention_policy import DocRetentionPolicy
from modules.document.models.template import DocTemplate
from modules.document.models.template_field import DocTemplateField

__all__ = [
    "DocFolder",
    "DocDocument",
    "DocDocumentVersion",
    "DocDocumentMetadata",
    "DocDocumentTag",
    "DocDocumentTagMap",
    "DocDocumentPermission",
    "DocDocumentShare",
    "DocDocumentComment",
    "DocDocumentApproval",
    "DocDocumentWorkflow",
    "DocDocumentCheckout",
    "DocDocumentAudit",
    "DocDocumentAttachment",
    "DocTemplate",
    "DocTemplateField",
    "DocRetentionPolicy",
    "DocArchive",
    "DocNotification",
    "DocReport",
]
