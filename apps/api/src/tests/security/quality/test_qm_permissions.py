"""Quality RBAC permission constants."""

import re

from modules.quality.permissions import (
    QM_PERMISSIONS,
    QM_PHASE16_PERMISSIONS,
    QUALITY_AUDITOR_PERMISSIONS,
    QUALITY_ENGINEER_PERMISSIONS,
    QUALITY_INSPECTOR_PERMISSIONS,
    QUALITY_MANAGER_PERMISSIONS,
)

_PERM_CODE = re.compile(r"^quality\.[a-z0-9_]+:[a-z_]+$")

PREEXISTING_INSPECTOR = {
    "quality.inspection_plan:read",
    "quality.sampling_plan:read",
    "quality.characteristic:read",
    "quality.incoming_inspection:read",
    "quality.incoming_inspection:create",
    "quality.incoming_inspection:update",
    "quality.incoming_inspection:complete",
    "quality.inprocess_inspection:read",
    "quality.inprocess_inspection:create",
    "quality.inprocess_inspection:complete",
    "quality.final_inspection:read",
    "quality.final_inspection:create",
    "quality.final_inspection:submit",
    "quality.defect:read",
    "quality.defect:create",
    "quality.defect_type:read",
    "quality.ncr:read",
    "quality.ncr:create",
    "quality.ncr:submit",
    "quality.customer_complaint:read",
    "quality.customer_complaint:create",
    "quality.audit:read",
    "quality.score:read",
    "quality.report:read",
}

PREEXISTING_ENGINEER_EXTRAS = {
    "quality.inspection_plan:create",
    "quality.inspection_plan:update",
    "quality.sampling_plan:create",
    "quality.sampling_plan:update",
    "quality.characteristic:create",
    "quality.characteristic:update",
    "quality.defect_type:create",
    "quality.defect_type:update",
    "quality.defect:update",
    "quality.capa:read",
    "quality.capa:create",
    "quality.capa:submit",
    "quality.capa:verify",
    "quality.supplier_quality:read",
    "quality.customer_complaint:update",
}

PREEXISTING_AUDITOR = {
    "quality.inspection_plan:read",
    "quality.sampling_plan:read",
    "quality.characteristic:read",
    "quality.incoming_inspection:read",
    "quality.inprocess_inspection:read",
    "quality.final_inspection:read",
    "quality.defect:read",
    "quality.defect_type:read",
    "quality.ncr:read",
    "quality.capa:read",
    "quality.supplier_quality:read",
    "quality.customer_complaint:read",
    "quality.audit:read",
    "quality.audit:create",
    "quality.audit:update",
    "quality.audit:close",
    "quality.score:read",
    "quality.report:read",
    "quality.report:export",
}

PREEXISTING_MANAGER_EXTRAS = {
    "quality.incoming_inspection:approve",
    "quality.final_inspection:approve",
    "quality.final_inspection:complete",
    "quality.ncr:approve",
    "quality.ncr:close",
    "quality.capa:approve",
    "quality.capa:close",
    "quality.supplier_quality:publish",
    "quality.customer_complaint:close",
    "quality.score:publish",
    "quality.report:export",
}


def test_qm_permissions_non_empty():
    assert len(QM_PERMISSIONS) >= 40
    codes = {p[0] for p in QM_PERMISSIONS}
    assert "quality.incoming_inspection:approve" in codes
    assert "quality.capa:verify" in codes
    assert "quality.score:publish" in codes
    assert "quality.spc_reading:read" in codes
    assert "quality.spc_reading:create" in codes
    assert "quality.scar:issue" in codes
    assert "quality.scar:verify" in codes
    assert "quality.vin_trace:read" in codes
    assert "quality.vin_trace:create" in codes
    assert "quality.warranty_claim:read" in codes
    assert "quality.warranty_claim:close" in codes
    assert "quality.recall:read" in codes
    assert "quality.recall:close" in codes


def test_phase16_permission_codes_follow_snake_entity_verb():
    for code, resource, action, module in QM_PERMISSIONS:
        assert _PERM_CODE.match(code), code
        assert module == "quality"
        assert code == f"{resource}:{action}"
        entity = resource.split(".", 1)[1]
        assert entity == entity.lower()
        assert "-" not in entity
    for code in QM_PHASE16_PERMISSIONS:
        assert _PERM_CODE.match(code), code
        assert code.startswith("quality.")


def test_role_packs_only_extended_not_reduced():
    inspector = set(QUALITY_INSPECTOR_PERMISSIONS)
    engineer = set(QUALITY_ENGINEER_PERMISSIONS)
    auditor = set(QUALITY_AUDITOR_PERMISSIONS)
    manager = set(QUALITY_MANAGER_PERMISSIONS)
    assert PREEXISTING_INSPECTOR <= inspector
    assert PREEXISTING_ENGINEER_EXTRAS <= engineer
    assert PREEXISTING_AUDITOR <= auditor
    assert PREEXISTING_MANAGER_EXTRAS <= manager


def test_role_permission_lists():
    assert len(QUALITY_INSPECTOR_PERMISSIONS) > 0
    assert len(QUALITY_ENGINEER_PERMISSIONS) >= len(QUALITY_INSPECTOR_PERMISSIONS)
    assert len(QUALITY_AUDITOR_PERMISSIONS) > 0
    assert len(QUALITY_MANAGER_PERMISSIONS) >= len(QUALITY_ENGINEER_PERMISSIONS)
    assert "quality.ppap:approve" in QUALITY_MANAGER_PERMISSIONS
    assert "quality.pfmea:create" in QUALITY_ENGINEER_PERMISSIONS
    assert "quality.pfmea:update" in QUALITY_ENGINEER_PERMISSIONS
    assert "quality.audit:close" in QUALITY_AUDITOR_PERMISSIONS
    assert "quality.spc_reading:create" in QUALITY_INSPECTOR_PERMISSIONS
    assert "quality.spc_reading:read" in QUALITY_AUDITOR_PERMISSIONS
    assert "quality.scar:issue" in QUALITY_ENGINEER_PERMISSIONS
    assert "quality.scar:close" in QUALITY_MANAGER_PERMISSIONS
    assert "quality.vin_trace:create" in QUALITY_INSPECTOR_PERMISSIONS
    assert "quality.vin_trace:read" in QUALITY_AUDITOR_PERMISSIONS
    assert "quality.warranty_claim:create" in QUALITY_INSPECTOR_PERMISSIONS
    assert "quality.warranty_claim:read" in QUALITY_AUDITOR_PERMISSIONS
    assert "quality.warranty_claim:close" in QUALITY_MANAGER_PERMISSIONS
    assert "quality.recall:create" in QUALITY_INSPECTOR_PERMISSIONS
    assert "quality.recall:read" in QUALITY_AUDITOR_PERMISSIONS
    assert "quality.recall:close" in QUALITY_MANAGER_PERMISSIONS
