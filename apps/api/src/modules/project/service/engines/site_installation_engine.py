"""Table-driven state machine for site installation workflow.

Stages:
    intake → assignment → survey → scm → installation → acceptance → completed

Installation includes configuration (BIOS / FW / LLD / OS / MBSS) when in scope.
Rack-only scopes only require rack installation work in this stage.
Scopes with server work require HWAT + circle sign-off (except rack-only).
"""

from __future__ import annotations

from typing import Any

from modules.project.domain.enums import (
    SiteDeliveryType,
    SiteWorkflowStage,
    delivery_includes_bios,
    delivery_includes_os,
    delivery_includes_rack,
    delivery_includes_server,
    delivery_is_rack_only,
    delivery_needs_configuration,
    delivery_needs_hwat,
)
from modules.project.domain.exceptions import InvalidSiteInstallationState

ENTITY = "site_installation"

_TRANSITIONS: dict[str, dict[str, str]] = {
    SiteWorkflowStage.INTAKE.value: {"complete_intake": SiteWorkflowStage.ASSIGNMENT.value},
    SiteWorkflowStage.ASSIGNMENT.value: {
        "complete_assignment": SiteWorkflowStage.SURVEY.value
    },
    SiteWorkflowStage.SURVEY.value: {"complete_survey": SiteWorkflowStage.SCM.value},
    SiteWorkflowStage.SCM.value: {"complete_scm": SiteWorkflowStage.INSTALLATION.value},
    SiteWorkflowStage.INSTALLATION.value: {
        "complete_installation": SiteWorkflowStage.ACCEPTANCE.value,
        # Legacy alias — same destination as complete_installation
        "complete_installation_rack_only": SiteWorkflowStage.ACCEPTANCE.value,
    },
    SiteWorkflowStage.ACCEPTANCE.value: {
        "complete_acceptance": SiteWorkflowStage.COMPLETED.value,
    },
    SiteWorkflowStage.COMPLETED.value: {},
}

STAGE_ORDER: list[str] = [
    SiteWorkflowStage.INTAKE.value,
    SiteWorkflowStage.ASSIGNMENT.value,
    SiteWorkflowStage.SURVEY.value,
    SiteWorkflowStage.SCM.value,
    SiteWorkflowStage.INSTALLATION.value,
    SiteWorkflowStage.ACCEPTANCE.value,
    SiteWorkflowStage.COMPLETED.value,
]

STAGE_LABELS: dict[str, str] = {
    SiteWorkflowStage.INTAKE.value: "Intake & RFAI",
    SiteWorkflowStage.ASSIGNMENT.value: "Assign stage owners",
    SiteWorkflowStage.SURVEY.value: "Survey",
    SiteWorkflowStage.SCM.value: "SCM / Logistics",
    SiteWorkflowStage.INSTALLATION.value: "Installation & Configuration",
    SiteWorkflowStage.ACCEPTANCE.value: "Acceptance",
    SiteWorkflowStage.COMPLETED.value: "Completed",
}

ACTION_LABELS: dict[str, str] = {
    "complete_intake": "Complete Intake",
    "complete_assignment": "Complete Assignment",
    "complete_survey": "Complete Survey",
    "complete_scm": "Complete SCM",
    "complete_installation": "Complete Installation & Configuration",
    "complete_installation_rack_only": "Complete Installation (Rack Only)",
    "complete_acceptance": "Complete Acceptance",
}


STAGE_ASSIGNEE_FIELDS: dict[str, str] = {
    SiteWorkflowStage.SURVEY.value: "survey_assignee_employee_id",
    SiteWorkflowStage.SCM.value: "scm_assignee_employee_id",
    SiteWorkflowStage.INSTALLATION.value: "installation_assignee_employee_id",
    SiteWorkflowStage.ACCEPTANCE.value: "acceptance_assignee_employee_id",
}


def _stage_index(stage: str) -> int:
    try:
        return STAGE_ORDER.index(stage)
    except ValueError:
        return -1


def stage_work_status(stage: str, current: str, delivery_type: str) -> str:
    """pending | in_progress | done | skipped — based on workflow position."""
    del delivery_type  # reserved for future skipped-stage rules
    # Map legacy configuration stage onto installation for status display
    if stage == SiteWorkflowStage.CONFIGURATION.value:
        stage = SiteWorkflowStage.INSTALLATION.value
    if current == SiteWorkflowStage.CONFIGURATION.value:
        current = SiteWorkflowStage.INSTALLATION.value
    cur_i = _stage_index(current)
    stage_i = _stage_index(stage)
    if stage_i < 0 or cur_i < 0:
        return "pending"
    if cur_i > stage_i:
        return "done"
    if cur_i == stage_i:
        return "in_progress"
    return "pending"


def _require_stage_assignees(record: Any, delivery: str) -> None:
    del delivery
    required = [
        (SiteWorkflowStage.SURVEY.value, "Survey"),
        (SiteWorkflowStage.SCM.value, "SCM / Logistics"),
        (SiteWorkflowStage.INSTALLATION.value, "Installation & Configuration"),
        (SiteWorkflowStage.ACCEPTANCE.value, "Acceptance"),
    ]
    for stage_key, label in required:
        field = STAGE_ASSIGNEE_FIELDS[stage_key]
        if not getattr(record, field, None):
            raise InvalidSiteInstallationState(
                f"{label} assignee must be set before continuing to Survey"
            )


def _require(record: Any, field: str, label: str) -> None:
    value = getattr(record, field, None)
    if value is None or (isinstance(value, str) and not value.strip()):
        raise InvalidSiteInstallationState(f"{label} is required before advancing")


def _require_material_lines(record: Any, field: str, label: str) -> None:
    lines = getattr(record, field, None) or []
    if not isinstance(lines, list) or not lines:
        raise InvalidSiteInstallationState(
            f"{label} type, quantity, and date are required before advancing"
        )
    valid = False
    for line in lines:
        if not isinstance(line, dict):
            continue
        typ = str(line.get("type") or "").strip()
        line_date = str(line.get("date") or "").strip()
        qty = line.get("quantity")
        try:
            qty_n = int(qty)
        except (TypeError, ValueError):
            qty_n = 0
        if typ and qty_n > 0 and line_date:
            valid = True
            break
    if not valid:
        raise InvalidSiteInstallationState(
            f"{label}: select a type, enter quantity, and date before advancing"
        )


def _require_true_with_date(record: Any, flag: str, date_field: str, label: str) -> None:
    """If the checkbox is checked, its date is required. Checkbox itself is optional."""
    if getattr(record, flag, False) and not getattr(record, date_field, None):
        raise InvalidSiteInstallationState(f"{label} date is required before advancing")


def allowed_actions(stage: str, delivery_type: str) -> list[str]:
    del delivery_type
    actions = list(_TRANSITIONS.get(stage, {}).keys())
    if stage == SiteWorkflowStage.INSTALLATION.value:
        return ["complete_installation", "complete_installation_rack_only"]
    return sorted(actions)


def transition(stage: str, action: str, delivery_type: str) -> str:
    allowed = allowed_actions(stage, delivery_type)
    if action not in allowed:
        raise InvalidSiteInstallationState(
            f"Action '{action}' is not allowed in stage '{stage}' for {delivery_type}"
        )
    return _TRANSITIONS[stage][action]


def _assert_installation_and_config_gates(record: Any, delivery: str) -> None:
    if delivery_is_rack_only(delivery):
        _require_true_with_date(
            record, "rack_server_stacking_done", "rack_server_stacking_date", "Rack Installation"
        )
        return

    if delivery_includes_server(delivery):
        _require_true_with_date(
            record,
            "rack_server_stacking_done",
            "rack_server_stacking_date",
            "Rack Installation + Server Stacking"
            if delivery_needs_configuration(delivery)
            else "Server Installation",
        )
        _require_true_with_date(
            record,
            "rack_server_power_on_done",
            "rack_server_power_on_date",
            "Rack + Server Power On",
        )
        _require_true_with_date(
            record,
            "dac_ilo_cabling_done",
            "dac_ilo_cabling_date",
            "DAC/ILO Cabling",
        )

    if delivery_includes_bios(delivery):
        _require_true_with_date(
            record,
            "bios_configuration_done",
            "bios_configuration_date",
            "BIOS Configuration",
        )
        _require_true_with_date(
            record,
            "firmware_nw_config_done",
            "firmware_nw_config_date",
            "Firmware / N/W Configuration",
        )
        _require_true_with_date(record, "lld_done", "lld_date", "LLD")
    if delivery_includes_os(delivery):
        _require_true_with_date(
            record, "os_installation_done", "os_installation_date", "OS Installation"
        )
        _require_true_with_date(record, "mbss_done", "mbss_date", "MBSS")


def assert_advance_gates(record: Any, action: str) -> None:
    """Validate mandatory verticals before a stage transition."""
    delivery = getattr(record, "delivery_type", SiteDeliveryType.SERVER_OS_RACK.value)

    if action == "complete_intake":
        _require(record, "site_name", "Site Name")
        if getattr(record, "rfai_request_done", False):
            _require(record, "power_requirements", "Power Requirements")
            _require(record, "rfai_number", "RFAI Number")
        return

    if action == "complete_assignment":
        _require_stage_assignees(record, delivery)
        return

    if action == "complete_survey":
        if delivery_includes_rack(delivery):
            _require_material_lines(record, "cable_lines", "Cable")
            _require_material_lines(record, "industrial_socket_lines", "Industrial Socket")
            _require_material_lines(record, "lug_lines", "Lugs")
        else:
            _require(record, "cable_length", "Cable Length")
        _require_true_with_date(
            record, "power_on_material", "power_on_material_date", "Power-on Material"
        )
        _require_true_with_date(
            record, "survey_completed", "survey_completed_date", "Survey Completed"
        )
        _require_true_with_date(
            record, "space_available", "space_available_date", "Space Available"
        )
        _require_true_with_date(
            record, "power_available", "power_available_date", "Power Available"
        )
        _require(record, "tile_details", "Tile Details")
        return

    if action == "complete_scm":
        _require_true_with_date(record, "mo_request", "mo_request_date", "MO Request")
        _require_true_with_date(record, "im_material", "im_material_date", "IM Material")
        _require_true_with_date(
            record, "material_handover_done", "material_handover_date", "Material Handover"
        )
        if getattr(record, "server_qty", None) is None:
            raise InvalidSiteInstallationState("Server QTY is required before advancing")
        if delivery_includes_rack(delivery) and getattr(record, "rack_qty", None) is None:
            raise InvalidSiteInstallationState("Rack Qty is required before advancing")
        return

    if action in {"complete_installation", "complete_installation_rack_only"}:
        _assert_installation_and_config_gates(record, delivery)
        return

    if action == "complete_acceptance":
        _require_true_with_date(
            record, "handover_to_cloud_done", "handover_to_cloud_date", "Handover to Application Team"
        )
        if delivery_needs_hwat(delivery):
            _require_true_with_date(
                record, "hwat_request_done", "hwat_request_date", "HWAT Request"
            )
            _require_true_with_date(
                record,
                "hwat_signoff_received",
                "hwat_signoff_date",
                "HWAT Sign off from Circle",
            )
        return


def blueprint_state(record: Any) -> dict[str, Any]:
    stage = getattr(record, "workflow_stage", SiteWorkflowStage.INTAKE.value)
    if stage == SiteWorkflowStage.CONFIGURATION.value:
        stage = SiteWorkflowStage.INSTALLATION.value
    delivery = getattr(record, "delivery_type", SiteDeliveryType.SERVER_OS_RACK.value)
    actions = allowed_actions(stage, delivery)
    assignments = []
    for s in STAGE_ORDER:
        if s in (
            SiteWorkflowStage.INTAKE.value,
            SiteWorkflowStage.ASSIGNMENT.value,
            SiteWorkflowStage.COMPLETED.value,
        ):
            continue
        field = STAGE_ASSIGNEE_FIELDS.get(s)
        if not field:
            continue
        assignments.append(
            {
                "stage": s,
                "label": STAGE_LABELS.get(s, s),
                "assignee_employee_id": getattr(record, field, None),
                "work_status": stage_work_status(s, stage, delivery),
            }
        )
    return {
        "entity": ENTITY,
        "state": stage,
        "delivery_type": delivery,
        "allowed_actions": actions,
        "action_labels": {a: ACTION_LABELS.get(a, a) for a in actions},
        "stages": [{"key": s, "label": STAGE_LABELS.get(s, s)} for s in STAGE_ORDER],
        "stage_assignments": assignments,
        "terminal": stage == SiteWorkflowStage.COMPLETED.value,
        "includes_os": delivery_includes_os(delivery),
        "includes_bios": delivery_includes_bios(delivery),
        "includes_server": delivery_includes_server(delivery),
        "is_rack_only": delivery_is_rack_only(delivery),
        "needs_hwat": delivery_needs_hwat(delivery),
    }
