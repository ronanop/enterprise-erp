"""Table-driven state machine for site installation workflow.

Stages:
    intake → survey → scm → onsite → installation → acceptance → completed

Stage owners are assigned from Project Tracking after the previous step completes
(Survey first after create). Legacy sites may still sit on ``assignment`` until
``complete_assignment`` advances them to Survey.

Installation includes configuration (BIOS / FW / LLD / OS / MBSS / VASCAN) when in scope.
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
    delivery_needs_hwat,
)
from modules.project.domain.exceptions import InvalidSiteInstallationState

ENTITY = "site_installation"

_TRANSITIONS: dict[str, dict[str, str]] = {
    # Intake goes straight to Survey — stage owners are assigned from Project Tracking.
    SiteWorkflowStage.INTAKE.value: {"complete_intake": SiteWorkflowStage.SURVEY.value},
    # Legacy sites that still sit on the removed assignment step
    SiteWorkflowStage.ASSIGNMENT.value: {
        "complete_assignment": SiteWorkflowStage.SURVEY.value
    },
    SiteWorkflowStage.SURVEY.value: {"complete_survey": SiteWorkflowStage.SCM.value},
    SiteWorkflowStage.SCM.value: {"complete_scm": SiteWorkflowStage.ONSITE.value},
    SiteWorkflowStage.ONSITE.value: {"complete_onsite": SiteWorkflowStage.INSTALLATION.value},
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

# Visible workflow stepper (assignment is not shown — owners assigned from tracking).
DISPLAY_STAGE_ORDER: list[str] = [
    SiteWorkflowStage.INTAKE.value,
    SiteWorkflowStage.SURVEY.value,
    SiteWorkflowStage.SCM.value,
    SiteWorkflowStage.ONSITE.value,
    SiteWorkflowStage.INSTALLATION.value,
    SiteWorkflowStage.ACCEPTANCE.value,
    SiteWorkflowStage.COMPLETED.value,
]

STAGE_ORDER: list[str] = [
    SiteWorkflowStage.INTAKE.value,
    SiteWorkflowStage.ASSIGNMENT.value,
    SiteWorkflowStage.SURVEY.value,
    SiteWorkflowStage.SCM.value,
    SiteWorkflowStage.ONSITE.value,
    SiteWorkflowStage.INSTALLATION.value,
    SiteWorkflowStage.ACCEPTANCE.value,
    SiteWorkflowStage.COMPLETED.value,
]

STAGE_LABELS: dict[str, str] = {
    SiteWorkflowStage.INTAKE.value: "Intake & RFAI",
    SiteWorkflowStage.ASSIGNMENT.value: "Assign stage owners",
    SiteWorkflowStage.SURVEY.value: "Survey",
    SiteWorkflowStage.SCM.value: "SCM / Logistics",
    SiteWorkflowStage.ONSITE.value: "On-site",
    SiteWorkflowStage.INSTALLATION.value: "Installation & Configuration",
    SiteWorkflowStage.ACCEPTANCE.value: "Acceptance",
    SiteWorkflowStage.COMPLETED.value: "Completed",
}

ACTION_LABELS: dict[str, str] = {
    "complete_intake": "Complete Intake",
    "complete_assignment": "Complete Assignment",
    "complete_survey": "Complete Survey",
    "complete_scm": "Complete SCM",
    "complete_onsite": "Complete On-site",
    "complete_installation": "Complete Installation & Configuration",
    "complete_installation_rack_only": "Complete Installation (Rack Only)",
    "complete_acceptance": "Complete Acceptance",
}


PROGRESS_UNLOCK_STATUSES = frozenset({"partial_completed", "completed"})

ASSIGNABLE_STAGE_ORDER: list[str] = [
    SiteWorkflowStage.SURVEY.value,
    SiteWorkflowStage.SCM.value,
    SiteWorkflowStage.ONSITE.value,
    SiteWorkflowStage.INSTALLATION.value,
    SiteWorkflowStage.ACCEPTANCE.value,
]


def stage_progress_status(record: Any, stage: str) -> str | None:
    field = STAGE_PROGRESS_FIELDS.get(stage)
    if not field:
        return None
    value = getattr(record, field, None)
    return value if isinstance(value, str) else None


def is_stage_progress_done(record: Any, stage: str) -> bool:
    return stage_progress_status(record, stage) in PROGRESS_UNLOCK_STATUSES


def is_stage_unlocked_by_progress(record: Any, stage: str) -> bool:
    """True when every prior assignable stage has Partial completed or Completed progress."""
    if stage not in ASSIGNABLE_STAGE_ORDER:
        return False
    idx = ASSIGNABLE_STAGE_ORDER.index(stage)
    if idx <= 0:
        return True
    for prior in ASSIGNABLE_STAGE_ORDER[:idx]:
        if not is_stage_progress_done(record, prior):
            return False
    return True


def assignee_work_status(record: Any, assigned_stage: str, current_stage: str) -> str:
    """My Jobs / Completed Jobs — honour step-owner progress before workflow position."""
    if is_stage_progress_done(record, assigned_stage):
        return "done"
    delivery = getattr(record, "delivery_type", SiteDeliveryType.SERVER_OS_RACK.value)
    return stage_work_status(assigned_stage, current_stage, delivery)


def can_open_stage_form(record: Any, assigned_stage: str, current_stage: str) -> bool:
    """Assignee may open the step form (active stage or pre-assigned after prior progress)."""
    if is_stage_progress_done(record, assigned_stage):
        return True
    if current_stage == SiteWorkflowStage.COMPLETED.value:
        field = STAGE_ASSIGNEE_FIELDS.get(assigned_stage)
        if field and getattr(record, field, None):
            return True
    delivery = getattr(record, "delivery_type", SiteDeliveryType.SERVER_OS_RACK.value)
    if stage_work_status(assigned_stage, current_stage, delivery) == "in_progress":
        return True
    return is_stage_unlocked_by_progress(record, assigned_stage)


STAGE_ASSIGNEE_FIELDS: dict[str, str] = {
    SiteWorkflowStage.SURVEY.value: "survey_assignee_employee_id",
    SiteWorkflowStage.SCM.value: "scm_assignee_employee_id",
    SiteWorkflowStage.ONSITE.value: "onsite_assignee_employee_id",
    SiteWorkflowStage.INSTALLATION.value: "installation_assignee_employee_id",
    SiteWorkflowStage.ACCEPTANCE.value: "acceptance_assignee_employee_id",
}

STAGE_PROGRESS_FIELDS: dict[str, str] = {
    SiteWorkflowStage.SURVEY.value: "survey_progress_status",
    SiteWorkflowStage.SCM.value: "scm_progress_status",
    SiteWorkflowStage.ONSITE.value: "onsite_progress_status",
    SiteWorkflowStage.INSTALLATION.value: "installation_progress_status",
    SiteWorkflowStage.ACCEPTANCE.value: "acceptance_progress_status",
}

STAGE_REMARKS_FIELDS: dict[str, str] = {
    SiteWorkflowStage.SURVEY.value: "survey_remarks",
    SiteWorkflowStage.SCM.value: "scm_remarks",
    SiteWorkflowStage.ONSITE.value: "onsite_remarks",
    SiteWorkflowStage.INSTALLATION.value: "installation_remarks",
    SiteWorkflowStage.ACCEPTANCE.value: "acceptance_remarks",
}

# (assigned_date_field, finished_date_field) per tracked work stage
STAGE_DATE_FIELDS: dict[str, tuple[str, str]] = {
    SiteWorkflowStage.SURVEY.value: ("survey_assigned_date", "survey_finished_date"),
    SiteWorkflowStage.SCM.value: ("scm_assigned_date", "scm_finished_date"),
    SiteWorkflowStage.ONSITE.value: ("onsite_assigned_date", "onsite_finished_date"),
    SiteWorkflowStage.INSTALLATION.value: (
        "installation_assigned_date",
        "installation_finished_date",
    ),
    SiteWorkflowStage.ACCEPTANCE.value: (
        "acceptance_assigned_date",
        "acceptance_finished_date",
    ),
}

# When an action completes, stamp finished date on current stage and assign next
_ADVANCE_STAGE_DATES: dict[str, tuple[str | None, str | None]] = {
    # (finished_stage, next_assigned_stage)
    "complete_survey": (
        SiteWorkflowStage.SURVEY.value,
        SiteWorkflowStage.SCM.value,
    ),
    "complete_scm": (
        SiteWorkflowStage.SCM.value,
        SiteWorkflowStage.ONSITE.value,
    ),
    "complete_onsite": (
        SiteWorkflowStage.ONSITE.value,
        SiteWorkflowStage.INSTALLATION.value,
    ),
    "complete_installation": (
        SiteWorkflowStage.INSTALLATION.value,
        SiteWorkflowStage.ACCEPTANCE.value,
    ),
    "complete_installation_rack_only": (
        SiteWorkflowStage.INSTALLATION.value,
        SiteWorkflowStage.ACCEPTANCE.value,
    ),
    "complete_configuration": (
        SiteWorkflowStage.INSTALLATION.value,
        SiteWorkflowStage.ACCEPTANCE.value,
    ),
    "complete_acceptance": (SiteWorkflowStage.ACCEPTANCE.value, None),
}


def _stage_date_value(record: Any, field: str):
    value = getattr(record, field, None)
    if value is None and field == "survey_assigned_date":
        created = getattr(record, "created_at", None)
        if created is not None:
            return created.date() if hasattr(created, "date") else created
    return value


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
    # Treat legacy assignment as survey for progress (assignment step removed from UI)
    if current == SiteWorkflowStage.ASSIGNMENT.value:
        current = SiteWorkflowStage.SURVEY.value
    if stage == SiteWorkflowStage.ASSIGNMENT.value:
        stage = SiteWorkflowStage.SURVEY.value
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
    """Assignment gate: only Survey owner is required to leave the assign step.

    Later stage owners are assigned one-by-one after the previous stage completes
    (from Project Tracking).
    """
    del delivery
    field = STAGE_ASSIGNEE_FIELDS[SiteWorkflowStage.SURVEY.value]
    if not getattr(record, field, None):
        raise InvalidSiteInstallationState(
            "Survey assignee must be set before continuing to Survey"
        )


def stage_date_updates_for_action(action: str, today) -> dict[str, Any]:
    """Return finished-date updates when advancing a stage.

    Next-stage assigned dates are set when the admin assigns that stage owner.
    """
    mapping = _ADVANCE_STAGE_DATES.get(action)
    if not mapping:
        return {}
    finished_stage, _next_stage = mapping
    updates: dict[str, Any] = {}
    if finished_stage:
        finished_field = STAGE_DATE_FIELDS[finished_stage][1]
        updates[finished_field] = today
    return updates


def _require(record: Any, field: str, label: str) -> None:
    value = getattr(record, field, None)
    if value is None or (isinstance(value, str) and not value.strip()):
        raise InvalidSiteInstallationState(f"{label} is required before advancing")


def _require_material_lines(
    record: Any, field: str, label: str, *, require_date: bool = True
) -> None:
    lines = getattr(record, field, None) or []
    need = "type, quantity, and date" if require_date else "type and quantity"
    if not isinstance(lines, list) or not lines:
        raise InvalidSiteInstallationState(
            f"{label} {need} are required before advancing"
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
        if typ and qty_n > 0 and (not require_date or line_date):
            valid = True
            break
    if not valid:
        detail = (
            "select a type, enter quantity, and date"
            if require_date
            else "select a type and enter quantity"
        )
        raise InvalidSiteInstallationState(f"{label}: {detail} before advancing")


def _require_true_with_date(record: Any, flag: str, date_field: str, label: str) -> None:
    """If the checkbox is checked, its date is required. Checkbox itself is optional."""
    if getattr(record, flag, False) and not getattr(record, date_field, None):
        raise InvalidSiteInstallationState(f"{label} date is required before advancing")


def _normalize_stage(stage: str) -> str:
    """Map legacy configuration stage onto installation."""
    if stage == SiteWorkflowStage.CONFIGURATION.value:
        return SiteWorkflowStage.INSTALLATION.value
    return stage


def allowed_actions(stage: str, delivery_type: str) -> list[str]:
    del delivery_type
    stage = _normalize_stage(stage)
    actions = list(_TRANSITIONS.get(stage, {}).keys())
    if stage == SiteWorkflowStage.INSTALLATION.value:
        return ["complete_installation", "complete_installation_rack_only"]
    return sorted(actions)


def transition(stage: str, action: str, delivery_type: str) -> str:
    stage = _normalize_stage(stage)
    # Legacy action alias from pre-merge configuration stage
    if action == "complete_configuration":
        action = "complete_installation"
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
        has_rack = delivery_includes_rack(delivery)
        _require_true_with_date(
            record,
            "rack_server_stacking_done",
            "rack_server_stacking_date",
            "Rack Installation + Server Stacking" if has_rack else "Server Stacking",
        )
        _require_true_with_date(
            record,
            "rack_server_power_on_done",
            "rack_server_power_on_date",
            "Rack + Server Power On" if has_rack else "Server Power On",
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
            "firmware_config_done",
            "firmware_config_date",
            "Firmware Configuration",
        )
        _require_true_with_date(record, "lld_done", "lld_date", "LLD")
    if delivery_includes_os(delivery):
        _require_true_with_date(
            record, "os_installation_done", "os_installation_date", "OS Installation"
        )
        _require_true_with_date(
            record, "vm_installation_done", "vm_installation_date", "VM Installation"
        )
        _require_true_with_date(
            record, "nw_config_done", "nw_config_date", "N/W Configuration"
        )
        _require_true_with_date(
            record, "tools_integration_done", "tools_integration_date", "Tools Integration"
        )
        _require_true_with_date(record, "mbss_done", "mbss_date", "MBSS")
        _require_true_with_date(record, "vascan_done", "vascan_date", "VASCAN")


def _require_stage_attachment(record: Any, field: str, label: str) -> None:
    value = getattr(record, field, None)
    if not (isinstance(value, str) and value.strip()):
        raise InvalidSiteInstallationState(
            f"{label} attachment is required before continuing"
        )


def _require_progress_completed(record: Any, stage: str, label: str) -> None:
    field = STAGE_PROGRESS_FIELDS.get(stage)
    if not field:
        return
    status = getattr(record, field, None)
    if status not in PROGRESS_UNLOCK_STATUSES:
        raise InvalidSiteInstallationState(
            f"{label} progress must be set to Partial completed or Completed before continuing"
        )


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
        _require_progress_completed(record, SiteWorkflowStage.SURVEY.value, "Survey")
        _require_stage_attachment(record, "survey_attachment_name", "Survey")
        if delivery_includes_rack(delivery):
            _require_material_lines(record, "cable_lines", "Cable", require_date=False)
            _require_material_lines(
                record, "industrial_socket_lines", "Industrial Socket", require_date=False
            )
            _require_material_lines(record, "lug_lines", "Lugs", require_date=False)
        _require_true_with_date(
            record, "space_available", "space_available_date", "Space Available"
        )
        _require_true_with_date(
            record, "power_available", "power_available_date", "Power Available"
        )
        _require(record, "tile_details", "Tile Details")
        _require_true_with_date(
            record, "survey_completed", "survey_completed_date", "Survey Completed"
        )
        return

    if action == "complete_scm":
        _require_progress_completed(record, SiteWorkflowStage.SCM.value, "SCM / Logistics")
        _require_stage_attachment(record, "scm_attachment_name", "SCM / Logistics")
        if delivery_includes_rack(delivery):
            _require_material_lines(record, "cable_lines", "Cable", require_date=True)
            _require_material_lines(
                record, "industrial_socket_lines", "Industrial Socket", require_date=True
            )
            _require_material_lines(record, "lug_lines", "Lugs", require_date=True)
        if delivery_includes_server(delivery) and getattr(record, "server_qty", None) is None:
            raise InvalidSiteInstallationState("Server QTY is required before advancing")
        if delivery_includes_rack(delivery) and getattr(record, "rack_qty", None) is None:
            raise InvalidSiteInstallationState("Rack Qty is required before advancing")
        return

    if action == "complete_onsite":
        _require_progress_completed(record, SiteWorkflowStage.ONSITE.value, "On-site")
        _require_stage_attachment(record, "onsite_attachment_name", "On-site")
        _require_true_with_date(record, "mo_request", "mo_request_date", "MO Request")
        _require_true_with_date(record, "im_material", "im_material_date", "IM Material")
        if not delivery_is_rack_only(delivery):
            _require_true_with_date(
                record, "power_on_material", "power_on_material_date", "Power-on Material"
            )
        _require_true_with_date(
            record, "material_handover_done", "material_handover_date", "Material Handover"
        )
        if getattr(record, "material_handover_done", False) and not getattr(
            record, "material_handover_to_name", None
        ):
            raise InvalidSiteInstallationState(
                "Material handover person name is required when handover is Yes"
            )
        return

    if action in {
        "complete_installation",
        "complete_installation_rack_only",
        "complete_configuration",  # legacy alias
    }:
        _require_progress_completed(
            record, SiteWorkflowStage.INSTALLATION.value, "Installation"
        )
        _require_stage_attachment(
            record, "installation_attachment_name", "Installation"
        )
        _assert_installation_and_config_gates(record, delivery)
        return

    if action == "complete_acceptance":
        _require_progress_completed(
            record, SiteWorkflowStage.ACCEPTANCE.value, "Acceptance"
        )
        _require_stage_attachment(record, "acceptance_attachment_name", "Acceptance")
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
    # Legacy assignment step — present as Survey in the UI stepper
    display_state = (
        SiteWorkflowStage.SURVEY.value
        if stage == SiteWorkflowStage.ASSIGNMENT.value
        else stage
    )
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
                "label": (
                    "Installation"
                    if s == SiteWorkflowStage.INSTALLATION.value
                    and delivery_is_rack_only(delivery)
                    else STAGE_LABELS.get(s, s)
                ),
                "assignee_employee_id": getattr(record, field, None),
                "work_status": assignee_work_status(record, s, stage),
                "progress_status": getattr(record, STAGE_PROGRESS_FIELDS.get(s, ""), None),
                "remarks": getattr(record, STAGE_REMARKS_FIELDS.get(s, ""), None),
                "assigned_date": _stage_date_value(record, STAGE_DATE_FIELDS[s][0]),
                "completed_date": _stage_date_value(record, STAGE_DATE_FIELDS[s][1]),
            }
        )
    return {
        "entity": ENTITY,
        "state": display_state,
        "delivery_type": delivery,
        "allowed_actions": actions,
        "action_labels": {a: ACTION_LABELS.get(a, a) for a in actions},
        "stages": [
            {"key": s, "label": STAGE_LABELS.get(s, s)} for s in DISPLAY_STAGE_ORDER
        ],
        "stage_assignments": assignments,
        "terminal": stage == SiteWorkflowStage.COMPLETED.value,
        "includes_os": delivery_includes_os(delivery),
        "includes_bios": delivery_includes_bios(delivery),
        "includes_server": delivery_includes_server(delivery),
        "is_rack_only": delivery_is_rack_only(delivery),
        "needs_hwat": delivery_needs_hwat(delivery),
    }
