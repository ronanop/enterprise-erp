"""Unit tests for master data enums and code generation."""

from modules.master_data.domain.enums import CODE_PREFIXES, MasterEntityType, normalize_employee_status


def test_code_prefixes_defined_for_key_entities() -> None:
    assert MasterEntityType.EMPLOYEE in CODE_PREFIXES
    assert CODE_PREFIXES[MasterEntityType.EMPLOYEE][0] == "EMP-"
    assert CODE_PREFIXES[MasterEntityType.CUSTOMER][0] == "CUST-"
    assert CODE_PREFIXES[MasterEntityType.PRODUCT][0] == "PRD-"


def test_normalize_employee_status_maps_ui_lifecycle() -> None:
    assert normalize_employee_status("archived") == "ex_employee"
    assert normalize_employee_status("inactive") == "terminated"
    assert normalize_employee_status("notice") == "notice_period"
    assert normalize_employee_status("active") == "active"
