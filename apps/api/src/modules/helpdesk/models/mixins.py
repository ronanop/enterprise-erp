"""Helpdesk ORM mixin bundles per ERD_17."""

from database.mixins import (
    AuditMixin,
    BranchMixin,
    CompanyMixin,
    SoftDeleteMixin,
    TenantMixin,
    VersionMixin,
)

HdMasterMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    SoftDeleteMixin,
    VersionMixin,
)

HdTransactionMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    BranchMixin,
    SoftDeleteMixin,
    VersionMixin,
)

HdDetailMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    SoftDeleteMixin,
    VersionMixin,
)
