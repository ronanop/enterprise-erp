"""Marketing ORM mixin bundles."""

from database.mixins import (
    AuditMixin,
    CompanyMixin,
    SoftDeleteMixin,
    TenantMixin,
    VersionMixin,
)

MktMasterMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    SoftDeleteMixin,
    VersionMixin,
)

# Branch is optional for marketing content ops (company-scoped workspaces).
MktTransactionMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    SoftDeleteMixin,
    VersionMixin,
)

MktDetailMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    SoftDeleteMixin,
    VersionMixin,
)
