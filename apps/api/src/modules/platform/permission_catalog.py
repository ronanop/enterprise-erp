"""Single permission catalog assembled from HRMS module ``permissions.py`` files."""

from __future__ import annotations

from modules.foundation import permissions as foundation_permissions
from modules.hr import permissions as hr_permissions
from modules.master_data import permissions as master_data_permissions
from modules.organization import permissions as organization_permissions
from modules.payroll import permissions as payroll_permissions
from modules.platform import permissions as platform_permissions
from modules.recruitment import permissions as recruitment_permissions

_PERMISSION_MODULES = (
    foundation_permissions,
    hr_permissions,
    master_data_permissions,
    organization_permissions,
    payroll_permissions,
    platform_permissions,
    recruitment_permissions,
)


def all_permission_entries() -> list[tuple[str, str, str, str]]:
    """(permission_code, resource, action, module) across all modules, de-duplicated."""
    seen: dict[str, tuple[str, str, str, str]] = {}
    for mod in _PERMISSION_MODULES:
        for name, value in vars(mod).items():
            if not (name.isupper() and isinstance(value, list)):
                continue
            for item in value:
                if isinstance(item, tuple) and len(item) == 4 and isinstance(item[0], str):
                    seen.setdefault(item[0], item)
    return list(seen.values())


def all_permission_codes() -> set[str]:
    return {entry[0] for entry in all_permission_entries()}
