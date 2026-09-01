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
    tenant_wide: bool = False
    scoped_company_ids: tuple[UUID, ...] = ()
