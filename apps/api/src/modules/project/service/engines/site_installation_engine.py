"""Table-driven state machine for site installation workflow.

Stages:
    intake → survey → scm → onsite_delivery → material_handover
    → installation → acceptance → completed

Stage owners are assigned from Project Tracking after the previous step completes
(Survey first after create). Legacy sites may still sit on ``assignment`` until
``complete_assignment`` advances them to Survey.

Historic ``onsite`` rows are soft-aliased to ``onsite_delivery`` /
``material_handover`` based on filled fields.

Installation includes configuration (BIOS / FW / LLD / OS / MBSS / VASCAN) when in scope.
Rack-only scopes only require rack installation work in this stage.
Scopes with server work require HW-AT + circle sign-off (except rack-only).
"""

from __future__ import annotations

from typing import Any

from modules.project.domain.enums import (
    SiteDeliveryType,
    SiteInstallationStatus,
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
    # Intake goes straight to Survey - stage owners are assigned from Project Tracking.
    SiteWorkflowStage.INTAKE.value: {"complete_intake": SiteWorkflowStage.SURVEY.value},
    # Legacy sites that still sit on the removed assignment step
    SiteWorkflowStage.ASSIGNMENT.value: {
        "complete_assignment": SiteWorkflowStage.SURVEY.value
    },
    SiteWorkflowStage.SURVEY.value: {"complete_survey": SiteWorkflowStage.SCM.value},
    SiteWorkflowStage.SCM.value: {
        "complete_scm": SiteWorkflowStage.ONSITE_DELIVERY.value
    },
    SiteWorkflowStage.ONSITE_DELIVERY.value: {
        "complete_onsite_delivery": SiteWorkflowStage.MATERIAL_HANDOVER.value
    },
    SiteWorkflowStage.MATERIAL_HANDOVER.value: {
        "complete_material_handover": SiteWorkflowStage.INSTALLATION.value
    },
    # Legacy combined on-site stage
    SiteWorkflowStage.ONSITE.value: {
        "complete_onsite": SiteWorkflowStage.INSTALLATION.value,
        "complete_onsite_delivery": SiteWorkflowStage.MATERIAL_HANDOVER.value,
        "complete_material_handover": SiteWorkflowStage.INSTALLATION.value,
    },
    SiteWorkflowStage.INSTALLATION.value: {
        "complete_installation": SiteWorkflowStage.ACCEPTANCE.value,
        # Legacy alias - same destination as complete_installation
        "complete_installation_rack_only": SiteWorkflowStage.ACCEPTANCE.value,
    },
    SiteWorkflowStage.ACCEPTANCE.value: {
        "complete_acceptance": SiteWorkflowStage.COMPLETED.value,
    },
    SiteWorkflowStage.COMPLETED.value: {},
}

# Visible workflow stepper (assignment is not shown - owners assigned from tracking).
DISPLAY_STAGE_ORDER: list[str] = [
    SiteWorkflowStage.INTAKE.value,
    SiteWorkflowStage.SURVEY.value,
    SiteWorkflowStage.SCM.value,
    SiteWorkflowStage.ONSITE_DELIVERY.value,
    SiteWorkflowStage.MATERIAL_HANDOVER.value,
    SiteWorkflowStage.INSTALLATION.value,
    SiteWorkflowStage.ACCEPTANCE.value,
    SiteWorkflowStage.COMPLETED.value,
]

STAGE_ORDER: list[str] = [
    SiteWorkflowStage.INTAKE.value,
    SiteWorkflowStage.ASSIGNMENT.value,
    SiteWorkflowStage.SURVEY.value,
    SiteWorkflowStage.SCM.value,
    SiteWorkflowStage.ONSITE_DELIVERY.value,
    SiteWorkflowStage.ONSITE.value,  # legacy ranking slot
    SiteWorkflowStage.MATERIAL_HANDOVER.value,
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
    SiteWorkflowStage.ONSITE_DELIVERY.value: "Onsite Delivery",
    SiteWorkflowStage.MATERIAL_HANDOVER.value: "Material Handover",
    SiteWorkflowStage.INSTALLATION.value: "Installation & Configuration",
    SiteWorkflowStage.ACCEPTANCE.value: "Acceptance",
    SiteWorkflowStage.COMPLETED.value: "Completed",
}

ACTION_LABELS: dict[str, str] = {
    "complete_intake": "Complete Intake",
    "complete_assignment": "Complete Assignment",
    "complete_survey": "Complete Survey",
    "complete_scm": "Complete SCM",
    "complete_onsite_delivery": "Complete Onsite Delivery",
    "complete_material_handover": "Complete Material Handover",
    "complete_onsite": "Complete On-site",
    "complete_installation": "Complete Installation & Configuration",
    "complete_installation_rack_only": "Complete Installation (Rack Only)",
    "complete_acceptance": "Complete Acceptance",
}


# Partial completed unlocks next-owner assignment; only Completed closes My Jobs.
PROGRESS_UNLOCK_STATUSES = frozenset({"partial_completed", "completed"})
PROGRESS_COMPLETED_STATUS = "completed"

ASSIGNABLE_STAGE_ORDER: list[str] = [
    SiteWorkflowStage.SURVEY.value,
    SiteWorkflowStage.SCM.value,
    SiteWorkflowStage.ONSITE_DELIVERY.value,
    SiteWorkflowStage.MATERIAL_HANDOVER.value,
    SiteWorkflowStage.INSTALLATION.value,
    SiteWorkflowStage.ACCEPTANCE.value,
]


def resolve_legacy_onsite_stage(record: Any) -> str:
    """Map historic ``onsite`` into the nearest split stage from filled fields."""
    stage = getattr(record, "workflow_stage", None)
    if stage != SiteWorkflowStage.ONSITE.value:
        return stage
    if (
        getattr(record, "material_handover_done", False)
        or getattr(record, "im_material", False)
        or getattr(record, "power_on_material", False)
        or getattr(record, "material_handover_progress_status", None)
        or getattr(record, "material_handover_assignee_employee_id", None)
    ):
        return SiteWorkflowStage.MATERIAL_HANDOVER.value
    return SiteWorkflowStage.ONSITE_DELIVERY.value


def stage_progress_status(record: Any, stage: str) -> str | None:
    field = STAGE_PROGRESS_FIELDS.get(stage)
    if not field:
        return None
    value = getattr(record, field, None)
    if value is None and stage in {
        SiteWorkflowStage.ONSITE_DELIVERY.value,
        SiteWorkflowStage.MATERIAL_HANDOVER.value,
    }:
        # Fall back to legacy combined onsite progress when split columns are empty
        legacy = getattr(record, "onsite_progress_status", None)
        if isinstance(legacy, str):
            return legacy
    return value if isinstance(value, str) else None


def is_stage_progress_unlocked(record: Any, stage: str) -> bool:
    """Partial completed or Completed - unlocks next-stage assignment."""
    return stage_progress_status(record, stage) in PROGRESS_UNLOCK_STATUSES


def is_stage_progress_done(record: Any, stage: str) -> bool:
    """Backward-compatible alias for unlock semantics (partial or completed)."""
    return is_stage_progress_unlocked(record, stage)


def is_stage_assignee_completed(record: Any, stage: str) -> bool:
    """Only Completed counts as done for My Jobs / read-only."""
    return stage_progress_status(record, stage) == PROGRESS_COMPLETED_STATUS


def is_stage_unlocked_by_progress(record: Any, stage: str) -> bool:
    """Standalone steps - prior stage progress does not block this stage."""
    del record, stage
    return True


def assignee_work_status(record: Any, assigned_stage: str, current_stage: str) -> str:
    """My Jobs / Completed Jobs - only Completed progress is ``done``.

    SCM and Onsite Delivery stay ``in_progress`` while PO remaining qty > 0,
    matching Partial-completed open behaviour even if progress/workflow advanced early.
    """
    qty_keeps_open = False
    if assigned_stage == SiteWorkflowStage.SCM.value:
        qty_keeps_open = cloud_po_lines_have_scm_remaining(record)
    elif assigned_stage == SiteWorkflowStage.ONSITE_DELIVERY.value:
        qty_keeps_open = cloud_po_lines_have_onsite_remaining(record)
    elif assigned_stage == SiteWorkflowStage.INSTALLATION.value:
        qty_keeps_open = cloud_po_lines_have_install_remaining(record)

    if not qty_keeps_open and is_stage_assignee_completed(record, assigned_stage):
        return "done"
    effective = resolve_legacy_onsite_stage(record) if current_stage == SiteWorkflowStage.ONSITE.value else current_stage
    delivery = getattr(record, "delivery_type", SiteDeliveryType.SERVER_OS_RACK.value)
    status = stage_work_status(assigned_stage, effective, delivery)
    if qty_keeps_open and status == "done":
        status = "in_progress"
    # Early assignment: once a future stage has an owner, treat it as actionable.
    if status == "pending":
        field = STAGE_ASSIGNEE_FIELDS.get(assigned_stage)
        assignee_val = getattr(record, field, None) if field else None
        if assignee_val is None and assigned_stage == SiteWorkflowStage.ONSITE_DELIVERY.value:
            assignee_val = getattr(record, "onsite_assignee_employee_id", None)
        if assignee_val is not None:
            return "in_progress"
    return status


def can_open_stage_form(record: Any, assigned_stage: str, current_stage: str) -> bool:
    """Assignee may open their step form anytime before Completed progress."""
    if is_stage_progress_unlocked(record, assigned_stage):
        return True
    if current_stage == SiteWorkflowStage.COMPLETED.value:
        field = STAGE_ASSIGNEE_FIELDS.get(assigned_stage)
        if field and getattr(record, field, None):
            return True
    field = STAGE_ASSIGNEE_FIELDS.get(assigned_stage)
    if field and getattr(record, field, None):
        return True
    effective = resolve_legacy_onsite_stage(record) if current_stage == SiteWorkflowStage.ONSITE.value else current_stage
    delivery = getattr(record, "delivery_type", SiteDeliveryType.SERVER_OS_RACK.value)
    if stage_work_status(assigned_stage, effective, delivery) == "in_progress":
        return True
    return is_stage_unlocked_by_progress(record, assigned_stage)


STAGE_ASSIGNEE_FIELDS: dict[str, str] = {
    SiteWorkflowStage.SURVEY.value: "survey_assignee_employee_id",
    SiteWorkflowStage.SCM.value: "scm_assignee_employee_id",
    SiteWorkflowStage.ONSITE_DELIVERY.value: "onsite_delivery_assignee_employee_id",
    SiteWorkflowStage.MATERIAL_HANDOVER.value: "material_handover_assignee_employee_id",
    # Legacy combined stage - still referenced for historic rows
    SiteWorkflowStage.ONSITE.value: "onsite_assignee_employee_id",
    SiteWorkflowStage.INSTALLATION.value: "installation_assignee_employee_id",
    SiteWorkflowStage.ACCEPTANCE.value: "acceptance_assignee_employee_id",
}

STAGE_PROGRESS_FIELDS: dict[str, str] = {
    SiteWorkflowStage.SURVEY.value: "survey_progress_status",
    SiteWorkflowStage.SCM.value: "scm_progress_status",
    SiteWorkflowStage.ONSITE_DELIVERY.value: "onsite_delivery_progress_status",
    SiteWorkflowStage.MATERIAL_HANDOVER.value: "material_handover_progress_status",
    SiteWorkflowStage.ONSITE.value: "onsite_progress_status",
    SiteWorkflowStage.INSTALLATION.value: "installation_progress_status",
    SiteWorkflowStage.ACCEPTANCE.value: "acceptance_progress_status",
}

STAGE_ATTACHMENT_FIELDS: dict[str, str] = {
    SiteWorkflowStage.SURVEY.value: "survey_attachment_name",
    SiteWorkflowStage.SCM.value: "scm_attachment_name",
    SiteWorkflowStage.ONSITE_DELIVERY.value: "onsite_delivery_attachment_name",
    SiteWorkflowStage.MATERIAL_HANDOVER.value: "material_handover_attachment_name",
    SiteWorkflowStage.ONSITE.value: "onsite_attachment_name",
    SiteWorkflowStage.INSTALLATION.value: "installation_attachment_name",
    SiteWorkflowStage.ACCEPTANCE.value: "acceptance_attachment_name",
}

STAGE_REMARKS_FIELDS: dict[str, str] = {
    SiteWorkflowStage.SURVEY.value: "survey_remarks",
    SiteWorkflowStage.SCM.value: "scm_remarks",
    SiteWorkflowStage.ONSITE_DELIVERY.value: "onsite_delivery_remarks",
    SiteWorkflowStage.MATERIAL_HANDOVER.value: "material_handover_remarks",
    SiteWorkflowStage.ONSITE.value: "onsite_remarks",
    SiteWorkflowStage.INSTALLATION.value: "installation_remarks",
    SiteWorkflowStage.ACCEPTANCE.value: "acceptance_remarks",
}

# All Yes/No checklist bool fields that stamp checkpoint_yes_at when Yes is clicked.
CHECKPOINT_YES_STAMP_FIELDS: frozenset[str] = frozenset(
    {
        "space_available",
        "power_available",
        "survey_completed",
        "mo_request",
        "im_material",
        "material_handover_done",
        "rack_installation_done",
        "server_stacking_done",
        "rack_power_on_done",
        "server_power_on_done",
        "rack_server_stacking_done",
        "rack_server_power_on_done",
        "dac_ilo_cabling_done",
        "lld_done",
        "bios_configuration_done",
        "firmware_config_done",
        "os_installation_done",
        "vm_installation_done",
        "nw_config_done",
        "tools_integration_done",
        "mbss_done",
        "vascan_done",
        "handover_to_cloud_done",
        "hwat_request_done",
        "hwat_signoff_received",
    }
)

# Yes/No checklist fields that can be answered No - labels for admin alerts.
STAGE_CHECKLIST_NO_FIELDS: dict[str, tuple[tuple[str, str], ...]] = {
    SiteWorkflowStage.SURVEY.value: (
        ("space_available", "Space Available"),
        ("power_available", "Power Available"),
        ("survey_completed", "Survey Completed"),
    ),
    SiteWorkflowStage.ONSITE_DELIVERY.value: (
        ("mo_request", "MO Request"),
    ),
    SiteWorkflowStage.MATERIAL_HANDOVER.value: (
        ("im_material", "IM Material"),
        ("material_handover_done", "Material Handover (WH → Site)"),
    ),
    SiteWorkflowStage.ONSITE.value: (
        ("mo_request", "MO Request"),
        ("im_material", "IM Material"),
        ("material_handover_done", "Material Handover (WH → Site)"),
    ),
    SiteWorkflowStage.INSTALLATION.value: (
        ("rack_installation_done", "Rack Installation"),
        ("server_stacking_done", "Server Stacking"),
        ("rack_power_on_done", "Rack Power On"),
        ("server_power_on_done", "Server Power On"),
        ("dac_ilo_cabling_done", "DAC / ILO Cabling"),
        ("lld_done", "LLD Availability"),
        ("bios_configuration_done", "BIOS Configuration"),
        ("firmware_config_done", "Firmware Configuration"),
        ("os_installation_done", "OS Installation"),
        ("vm_installation_done", "VM Installation"),
        ("nw_config_done", "N/W Configuration"),
        ("tools_integration_done", "Tools Integration"),
        ("mbss_done", "MBSS"),
        ("vascan_done", "VASCAN"),
    ),
    SiteWorkflowStage.ACCEPTANCE.value: (
        ("handover_to_cloud_done", "Handover to Application Team"),
        ("hwat_request_done", "HW-AT Request"),
        ("hwat_signoff_received", "HW-AT Sign-off from Circle"),
    ),
}

PROGRESS_STATUS_LABELS: dict[str, str] = {
    "completed": "Completed",
    "partial_completed": "Partial completed",
    "in_progress": "In progress",
}

STAGE_FORM_SEGMENTS: dict[str, str] = {
    SiteWorkflowStage.SURVEY.value: "survey",
    SiteWorkflowStage.SCM.value: "scm",
    SiteWorkflowStage.ONSITE_DELIVERY.value: "onsite-delivery",
    SiteWorkflowStage.MATERIAL_HANDOVER.value: "material-handover",
    SiteWorkflowStage.ONSITE.value: "onsite-delivery",
    SiteWorkflowStage.INSTALLATION.value: "installation",
    SiteWorkflowStage.ACCEPTANCE.value: "acceptance",
}

# (assigned_date_field, finished_date_field) per tracked work stage
STAGE_DATE_FIELDS: dict[str, tuple[str, str]] = {
    SiteWorkflowStage.SURVEY.value: ("survey_assigned_date", "survey_finished_date"),
    SiteWorkflowStage.SCM.value: ("scm_assigned_date", "scm_finished_date"),
    SiteWorkflowStage.ONSITE_DELIVERY.value: (
        "onsite_delivery_assigned_date",
        "onsite_delivery_finished_date",
    ),
    SiteWorkflowStage.MATERIAL_HANDOVER.value: (
        "material_handover_assigned_date",
        "material_handover_finished_date",
    ),
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
        SiteWorkflowStage.ONSITE_DELIVERY.value,
    ),
    "complete_onsite_delivery": (
        SiteWorkflowStage.ONSITE_DELIVERY.value,
        SiteWorkflowStage.MATERIAL_HANDOVER.value,
    ),
    "complete_material_handover": (
        SiteWorkflowStage.MATERIAL_HANDOVER.value,
        SiteWorkflowStage.INSTALLATION.value,
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
    """pending | in_progress | done | skipped - based on workflow position."""
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

    Later stage owners may be assigned any time from Project Tracking, including
    before the previous step is fully completed.
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


def _line_int(line: dict, key: str) -> int:
    try:
        return int(line.get(key) or 0)
    except (TypeError, ValueError):
        return 0


def _cloud_po_lines_meaningful(record: Any) -> list[dict]:
    lines = getattr(record, "cloud_po_lines", None) or []
    if not isinstance(lines, list):
        return []
    out: list[dict] = []
    for line in lines:
        if not isinstance(line, dict):
            continue
        if _line_int(line, "quantity") > 0:
            out.append(line)
    return out


def cloud_po_lines_are_fully_delivered(record: Any) -> bool:
    """True when every PO line with qty > 0 is fully SCM-delivered (or no lines)."""
    meaningful = _cloud_po_lines_meaningful(record)
    if not meaningful:
        return True
    for line in meaningful:
        if _line_int(line, "delivered_quantity") < _line_int(line, "quantity"):
            return False
    return True


def cloud_po_lines_are_fully_onsite(record: Any) -> bool:
    """True when every original PO qty has been received on site."""
    meaningful = _cloud_po_lines_meaningful(record)
    if not meaningful:
        return False
    for line in meaningful:
        if _line_int(line, "onsite_delivered_quantity") < _line_int(line, "quantity"):
            return False
    return True


def cloud_po_lines_have_scm_remaining(record: Any) -> bool:
    """True when at least one PO line still needs SCM delivery."""
    meaningful = _cloud_po_lines_meaningful(record)
    if not meaningful:
        return False
    return not cloud_po_lines_are_fully_delivered(record)


def cloud_po_lines_have_onsite_remaining(record: Any) -> bool:
    """True when at least one PO line still needs onsite receipt."""
    meaningful = _cloud_po_lines_meaningful(record)
    if not meaningful:
        return False
    return not cloud_po_lines_are_fully_onsite(record)


def cloud_po_lines_are_fully_installed(record: Any) -> bool:
    """True when every original PO qty has been installed on site."""
    meaningful = _cloud_po_lines_meaningful(record)
    if not meaningful:
        return False
    for line in meaningful:
        if _line_int(line, "installed_quantity") < _line_int(line, "quantity"):
            return False
    return True


def cloud_po_lines_have_install_remaining(record: Any) -> bool:
    """True when at least one PO line still needs installation."""
    meaningful = _cloud_po_lines_meaningful(record)
    if not meaningful:
        return False
    return not cloud_po_lines_are_fully_installed(record)


def _require_cloud_po_lines_fully_delivered(record: Any) -> None:
    """SCM cannot complete until every type/qty line is fully delivered."""
    lines = getattr(record, "cloud_po_lines", None) or []
    if not isinstance(lines, list) or not lines:
        return
    for index, line in enumerate(lines):
        if not isinstance(line, dict):
            continue
        qty = _line_int(line, "quantity")
        if qty <= 0:
            continue
        delivered = _line_int(line, "delivered_quantity")
        if delivered < qty:
            label = str(line.get("line_type") or "").strip() or f"Line {index + 1}"
            raise InvalidSiteInstallationState(
                f"Deliver all quantities before completing SCM "
                f"({label}: {delivered}/{qty} delivered)"
            )


def _require_cloud_po_lines_fully_delivered_onsite(record: Any) -> None:
    """Onsite Delivery cannot complete until every original PO qty is on site."""
    lines = getattr(record, "cloud_po_lines", None) or []
    if not isinstance(lines, list) or not lines:
        raise InvalidSiteInstallationState(
            "No cloud PO lines to receive on site"
        )
    meaningful = 0
    for index, line in enumerate(lines):
        if not isinstance(line, dict):
            continue
        qty = _line_int(line, "quantity")
        if qty <= 0:
            continue
        meaningful += 1
        onsite_delivered = _line_int(line, "onsite_delivered_quantity")
        if onsite_delivered < qty:
            label = str(line.get("line_type") or "").strip() or f"Line {index + 1}"
            raise InvalidSiteInstallationState(
                f"Receive all quantities on site before completing Onsite Delivery "
                f"({label}: {onsite_delivered}/{qty} on site)"
            )
    if meaningful == 0:
        raise InvalidSiteInstallationState(
            "No cloud PO quantities to receive on site"
        )


def _require_cloud_po_lines_fully_installed(record: Any) -> None:
    """Installation cannot complete until every original PO qty is installed."""
    lines = getattr(record, "cloud_po_lines", None) or []
    if not isinstance(lines, list) or not lines:
        return
    meaningful = 0
    for index, line in enumerate(lines):
        if not isinstance(line, dict):
            continue
        qty = _line_int(line, "quantity")
        if qty <= 0:
            continue
        meaningful += 1
        installed = _line_int(line, "installed_quantity")
        if installed < qty:
            label = str(line.get("line_type") or "").strip() or f"Line {index + 1}"
            raise InvalidSiteInstallationState(
                f"Install all quantities before completing Installation "
                f"({label}: {installed}/{qty} installed)"
            )
    if meaningful == 0:
        return


def incomplete_qty_stage_heal_updates(record: Any) -> dict[str, Any]:
    """Keep SCM / Onsite / Installation open until remaining qty is 0.

    Rows wrongly marked Completed under older gates are downgraded to Partial
    completed and, when the workflow already advanced, rewound so the earliest
    incomplete qty step stays the active open stage.
    """
    status = getattr(record, "status", None)
    stage = getattr(record, "workflow_stage", None)
    if status == SiteInstallationStatus.COMPLETED.value:
        return {}
    if stage == SiteWorkflowStage.COMPLETED.value:
        return {}

    updates: dict[str, Any] = {}

    if cloud_po_lines_have_scm_remaining(record):
        if stage_progress_status(record, SiteWorkflowStage.SCM.value) == PROGRESS_COMPLETED_STATUS:
            updates["scm_progress_status"] = "partial_completed"

    if cloud_po_lines_have_onsite_remaining(record):
        if (
            stage_progress_status(record, SiteWorkflowStage.ONSITE_DELIVERY.value)
            == PROGRESS_COMPLETED_STATUS
        ):
            updates["onsite_delivery_progress_status"] = "partial_completed"
            updates["onsite_delivery_finished_date"] = None

        effective = (
            resolve_legacy_onsite_stage(record)
            if stage == SiteWorkflowStage.ONSITE.value
            else stage
        )
        if isinstance(effective, str):
            onsite_i = _stage_index(SiteWorkflowStage.ONSITE_DELIVERY.value)
            cur_i = _stage_index(effective)
            # Past Onsite Delivery but qty still remaining → reopen that step
            if cur_i > onsite_i >= 0:
                updates["workflow_stage"] = SiteWorkflowStage.ONSITE_DELIVERY.value

    elif cloud_po_lines_have_install_remaining(record):
        if (
            stage_progress_status(record, SiteWorkflowStage.INSTALLATION.value)
            == PROGRESS_COMPLETED_STATUS
        ):
            updates["installation_progress_status"] = "partial_completed"
            updates["installation_finished_date"] = None

        effective = (
            resolve_legacy_onsite_stage(record)
            if stage == SiteWorkflowStage.ONSITE.value
            else stage
        )
        if isinstance(effective, str):
            install_i = _stage_index(SiteWorkflowStage.INSTALLATION.value)
            cur_i = _stage_index(effective)
            if cur_i > install_i >= 0:
                updates["workflow_stage"] = SiteWorkflowStage.INSTALLATION.value

    return updates


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
    # Soft-alias: historic onsite can complete via split actions
    if stage == SiteWorkflowStage.ONSITE.value and action == "complete_onsite_delivery":
        return SiteWorkflowStage.MATERIAL_HANDOVER.value
    if stage == SiteWorkflowStage.ONSITE.value and action == "complete_material_handover":
        return SiteWorkflowStage.INSTALLATION.value
    allowed = allowed_actions(stage, delivery_type)
    if action not in allowed:
        raise InvalidSiteInstallationState(
            f"Action '{action}' is not allowed in stage '{stage}' for {delivery_type}"
        )
    return _TRANSITIONS[stage][action]


def resolve_action_target(action: str, delivery_type: str) -> str:
    """Target workflow stage for a complete_* action (standalone - any step)."""
    del delivery_type
    if action == "complete_configuration":
        action = "complete_installation"
    for stage, actions in _TRANSITIONS.items():
        if action not in actions:
            continue
        if stage == SiteWorkflowStage.ONSITE.value and action == "complete_onsite_delivery":
            return SiteWorkflowStage.MATERIAL_HANDOVER.value
        if stage == SiteWorkflowStage.ONSITE.value and action == "complete_material_handover":
            return SiteWorkflowStage.INSTALLATION.value
        return actions[action]
    raise InvalidSiteInstallationState(f"Unknown workflow action '{action}'")


def workflow_stage_after_action(current_stage: str, action: str, delivery_type: str) -> str | None:
    """Move workflow forward only - completing a step never rewinds the pipeline."""
    target = resolve_action_target(action, delivery_type)
    current = _normalize_stage(current_stage)
    if current == SiteWorkflowStage.ASSIGNMENT.value:
        current = SiteWorkflowStage.SURVEY.value
    if current == SiteWorkflowStage.ONSITE.value:
        current = SiteWorkflowStage.ONSITE_DELIVERY.value
    if _stage_index(target) > _stage_index(current):
        return target
    return None


def _assert_installation_and_config_gates(record: Any, delivery: str) -> None:
    if delivery_is_rack_only(delivery):
        _require_true_with_date(
            record, "rack_installation_done", "rack_installation_date", "Rack Installation"
        )
        _require_cloud_po_lines_fully_installed(record)
        return

    if delivery_includes_server(delivery):
        has_rack = delivery_includes_rack(delivery)
        if has_rack:
            _require_true_with_date(
                record,
                "rack_installation_done",
                "rack_installation_date",
                "Rack Installation",
            )
        _require_true_with_date(
            record,
            "server_stacking_done",
            "server_stacking_date",
            "Server Stacking",
        )
        if has_rack:
            _require_true_with_date(
                record,
                "rack_power_on_done",
                "rack_power_on_date",
                "Rack Power On",
            )
        _require_true_with_date(
            record,
            "server_power_on_done",
            "server_power_on_date",
            "Server Power On",
        )
        _require_true_with_date(
            record,
            "dac_ilo_cabling_done",
            "dac_ilo_cabling_date",
            "DAC/ILO Cabling",
        )

    if delivery_includes_bios(delivery):
        _require_true_with_date(record, "lld_done", "lld_date", "LLD")
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

    _require_cloud_po_lines_fully_installed(record)


def _require_stage_attachment(record: Any, field: str, label: str) -> None:
    value = getattr(record, field, None)
    if not (isinstance(value, str) and value.strip()):
        raise InvalidSiteInstallationState(
            f"{label} attachment is required before continuing"
        )


def _assert_onsite_delivery_gates(record: Any, delivery: str) -> None:
    del delivery
    attachment = STAGE_ATTACHMENT_FIELDS[SiteWorkflowStage.ONSITE_DELIVERY.value]
    # Fall back to legacy attachment column when split column empty
    if not (isinstance(getattr(record, attachment, None), str) and getattr(record, attachment).strip()):
        legacy = getattr(record, "onsite_attachment_name", None)
        if not (isinstance(legacy, str) and legacy.strip()):
            raise InvalidSiteInstallationState(
                "Onsite Delivery attachment is required before continuing"
            )
    _require_true_with_date(record, "mo_request", "mo_request_date", "MO Request")
    _require_cloud_po_lines_fully_delivered_onsite(record)


def _assert_material_handover_gates(record: Any, delivery: str) -> None:
    del delivery
    attachment = STAGE_ATTACHMENT_FIELDS[SiteWorkflowStage.MATERIAL_HANDOVER.value]
    if not (isinstance(getattr(record, attachment, None), str) and getattr(record, attachment).strip()):
        legacy = getattr(record, "onsite_attachment_name", None)
        if not (isinstance(legacy, str) and legacy.strip()):
            raise InvalidSiteInstallationState(
                "Material Handover attachment is required before continuing"
            )
    _require_true_with_date(record, "im_material", "im_material_date", "IM Material")
    _require_true_with_date(
        record, "material_handover_done", "material_handover_date", "Material Handover"
    )
    if getattr(record, "material_handover_done", False) and not getattr(
        record, "material_handover_to_name", None
    ):
        raise InvalidSiteInstallationState(
            "Material handover person name is required when handover is Yes"
        )


def _require_survey_evidence_for_material(record: Any) -> None:
    """Site material cannot be ordered without the signed-off survey report."""
    attachment = getattr(record, "survey_attachment_name", None)
    if not (isinstance(attachment, str) and attachment.strip()):
        raise InvalidSiteInstallationState(
            "Upload the site survey report before ordering site material - "
            "cable and socket quantities are ordered off that report"
        )
    if not getattr(record, "survey_completed", False):
        raise InvalidSiteInstallationState(
            "Mark the site survey complete before ordering site material"
        )


def assert_advance_gates(record: Any, action: str) -> None:
    """Validate mandatory verticals before a stage transition."""
    delivery = getattr(record, "delivery_type", SiteDeliveryType.SERVER_OS_RACK.value)

    if action == "complete_intake":
        _require(record, "site_name", "Site Name")
        if getattr(record, "rfai_request_done", False):
            # Power Requirements is optional (UI removed); only RFAI number is required.
            _require(record, "rfai_number", "RFAI Number")
        return

    if action == "complete_assignment":
        _require_stage_assignees(record, delivery)
        return

    if action == "complete_survey":
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
        _require_stage_attachment(record, "scm_attachment_name", "SCM / Logistics")
        if delivery_includes_rack(delivery):
            # Cable and other site material is ordered off the site survey
            # report, so that evidence has to be on record first.
            _require_survey_evidence_for_material(record)
            _require_material_lines(record, "cable_lines", "Cable", require_date=True)
            _require_material_lines(
                record, "industrial_socket_lines", "Industrial Socket", require_date=True
            )
            _require_material_lines(record, "lug_lines", "Lugs", require_date=True)
        _require_cloud_po_lines_fully_delivered(record)
        return

    if action == "complete_onsite_delivery":
        _assert_onsite_delivery_gates(record, delivery)
        return

    if action == "complete_material_handover":
        _assert_material_handover_gates(record, delivery)
        return

    if action == "complete_onsite":
        # Legacy combined gate - both delivery + handover verticals
        _require_stage_attachment(record, "onsite_attachment_name", "On-site")
        _require_true_with_date(record, "mo_request", "mo_request_date", "MO Request")
        _require_true_with_date(record, "im_material", "im_material_date", "IM Material")
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
        _require_stage_attachment(
            record, "installation_attachment_name", "Installation"
        )
        _assert_installation_and_config_gates(record, delivery)
        return

    if action == "complete_acceptance":
        _require_stage_attachment(record, "acceptance_attachment_name", "Acceptance")
        _require_true_with_date(
            record, "handover_to_cloud_done", "handover_to_cloud_date", "Handover to Application Team"
        )
        if delivery_needs_hwat(delivery):
            _require_true_with_date(
                record, "hwat_request_done", "hwat_request_date", "HW-AT Request"
            )
            _require_true_with_date(
                record,
                "hwat_signoff_received",
                "hwat_signoff_date",
                "HW-AT Sign off from Circle",
            )
        return


def blueprint_state(record: Any) -> dict[str, Any]:
    stage = getattr(record, "workflow_stage", SiteWorkflowStage.INTAKE.value)
    if stage == SiteWorkflowStage.CONFIGURATION.value:
        stage = SiteWorkflowStage.INSTALLATION.value
    # Legacy assignment step - present as Survey in the UI stepper
    if stage == SiteWorkflowStage.ASSIGNMENT.value:
        display_state = SiteWorkflowStage.SURVEY.value
    elif stage == SiteWorkflowStage.ONSITE.value:
        display_state = resolve_legacy_onsite_stage(record)
    else:
        display_state = stage
    delivery = getattr(record, "delivery_type", SiteDeliveryType.SERVER_OS_RACK.value)
    actions = allowed_actions(stage, delivery)
    assignments = []
    for s in ASSIGNABLE_STAGE_ORDER:
        field = STAGE_ASSIGNEE_FIELDS.get(s)
        if not field:
            continue
        progress_field = STAGE_PROGRESS_FIELDS.get(s, "")
        remarks_field = STAGE_REMARKS_FIELDS.get(s, "")
        progress_val = getattr(record, progress_field, None) if progress_field else None
        if progress_val is None and s in {
            SiteWorkflowStage.ONSITE_DELIVERY.value,
            SiteWorkflowStage.MATERIAL_HANDOVER.value,
        }:
            progress_val = getattr(record, "onsite_progress_status", None)
        assignee_val = getattr(record, field, None)
        if assignee_val is None and s == SiteWorkflowStage.ONSITE_DELIVERY.value:
            assignee_val = getattr(record, "onsite_assignee_employee_id", None)
        assignments.append(
            {
                "stage": s,
                "label": (
                    "Installation"
                    if s == SiteWorkflowStage.INSTALLATION.value
                    and delivery_is_rack_only(delivery)
                    else STAGE_LABELS.get(s, s)
                ),
                "assignee_employee_id": assignee_val,
                "work_status": assignee_work_status(record, s, stage),
                "progress_status": progress_val,
                "remarks": getattr(record, remarks_field, None) if remarks_field else None,
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
