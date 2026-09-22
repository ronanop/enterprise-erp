"""Inventory ORM mixin bundles per ERD_07."""

from database.mixins import (
    AuditMixin,
    BranchMixin,
    CompanyMixin,
    SoftDeleteMixin,
    TenantMixin,
    VersionMixin,
)

InvMasterMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    SoftDeleteMixin,
    VersionMixin,
)

InvTransactionMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    BranchMixin,
    SoftDeleteMixin,
    VersionMixin,
)

# Ledger is append-only - no soft delete / version.
InvLedgerMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    BranchMixin,
)
