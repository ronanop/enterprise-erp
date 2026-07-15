"""Analytics ORM mixin bundles per ERD_20."""

from database.mixins import (
    AuditMixin,
    CompanyMixin,
    SoftDeleteMixin,
    TenantMixin,
    VersionMixin,
)

# Optional branch_id is declared per-model (ERD: branch optional on all bi_* tables).
BiRowMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    SoftDeleteMixin,
    VersionMixin,
)
