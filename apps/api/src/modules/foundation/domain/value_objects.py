"""Foundation domain value objects."""

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True, slots=True)
class Email:
    value: str

    def __post_init__(self) -> None:
        if "@" not in self.value or len(self.value) > 255:
            raise ValueError("Invalid email address")


@dataclass(frozen=True, slots=True)
class PermissionCode:
    value: str

    def __post_init__(self) -> None:
        if ":" not in self.value:
            raise ValueError("Permission code must be resource:action format")


@dataclass(frozen=True, slots=True)
class TenantId:
    value: UUID


@dataclass(frozen=True, slots=True)
class TenantContext:
    tenant_id: UUID
    user_id: UUID
    user_type: str
    session_id: UUID | None = None
    company_id: UUID | None = None
    branch_id: UUID | None = None
    # Org-assigned module admin keys (role=admin). Platform admins do not need this list.
    admin_module_keys: frozenset[str] = frozenset()
    # Legacy flags — prefer has_module_wide_data_access / admin_module_keys.
    tenant_wide: bool = False
    procurement_tenant_wide: bool = False
    scoped_company_ids: tuple[UUID, ...] = ()
