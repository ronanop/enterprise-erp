"""Canonical WBS template for site installation projects."""

from __future__ import annotations

from dataclasses import dataclass

from modules.project.domain.enums import (
    SiteWorkflowStage,
    delivery_includes_os,
    delivery_includes_rack,
    delivery_includes_server,
    delivery_is_rack_only,
    delivery_needs_configuration,
    delivery_needs_hwat,
)


@dataclass(frozen=True)
class WbsTaskSpec:
    task_name: str
    priority: str = "medium"


@dataclass(frozen=True)
class WbsMilestoneSpec:
    code: str
    name: str
    tasks: tuple[WbsTaskSpec, ...] = ()


@dataclass(frozen=True)
class WbsPhaseSpec:
    code: str
    name: str
    sequence_no: int
    stage: str
    milestone: WbsMilestoneSpec


SITE_INSTALLATION_WBS: tuple[WbsPhaseSpec, ...] = (
    WbsPhaseSpec(
        code="PH-INTAKE",
        name="Intake & RFAI",
        sequence_no=1,
        stage=SiteWorkflowStage.INTAKE.value,
        milestone=WbsMilestoneSpec(
            code="MS-RFAI",
            name="RFAI Issued",
            tasks=(
                WbsTaskSpec("Capture site request & requestor"),
                WbsTaskSpec("Confirm circle / cloud / site list"),
                WbsTaskSpec("Capture power requirements"),
                WbsTaskSpec("Raise RFAI request"),
                WbsTaskSpec("Record RFAI number"),
            ),
        ),
    ),
    WbsPhaseSpec(
        code="PH-SURVEY",
        name="Survey",
        sequence_no=2,
        stage=SiteWorkflowStage.SURVEY.value,
        milestone=WbsMilestoneSpec(
            code="MS-SURVEY",
            name="Survey Complete",
            tasks=(
                WbsTaskSpec("Cable length survey"),
                WbsTaskSpec("Industrial socket check"),
                WbsTaskSpec("Lugs check"),
                WbsTaskSpec("Confirm space & power available"),
                WbsTaskSpec("Record tile details"),
            ),
        ),
    ),
    WbsPhaseSpec(
        code="PH-SCM",
        name="SCM / Logistics",
        sequence_no=3,
        stage=SiteWorkflowStage.SCM.value,
        milestone=WbsMilestoneSpec(
            code="MS-WH",
            name="Warehouse Delivery",
            tasks=(
                WbsTaskSpec("Confirm site materials types & quantities"),
                WbsTaskSpec("Track server / rack / PDU WH delivery"),
            ),
        ),
    ),
    WbsPhaseSpec(
        code="PH-ONSITE-DEL",
        name="Onsite Delivery",
        sequence_no=4,
        stage=SiteWorkflowStage.ONSITE_DELIVERY.value,
        milestone=WbsMilestoneSpec(
            code="MS-ONSITE-DEL",
            name="Material Delivered On Site",
            tasks=(
                WbsTaskSpec("Raise MO request", "high"),
                WbsTaskSpec("Track server / rack / PDU on-site delivery"),
            ),
        ),
    ),
    WbsPhaseSpec(
        code="PH-MAT-HO",
        name="Material Handover",
        sequence_no=5,
        stage=SiteWorkflowStage.MATERIAL_HANDOVER.value,
        milestone=WbsMilestoneSpec(
            code="MS-MAT-HO",
            name="Material Handed Over",
            tasks=(
                WbsTaskSpec("Confirm IM material"),
                WbsTaskSpec("Power-on material check"),
                WbsTaskSpec("Material handover WH → Site", "high"),
            ),
        ),
    ),
    WbsPhaseSpec(
        code="PH-INSTALL",
        name="Installation & Configuration",
        sequence_no=6,
        stage=SiteWorkflowStage.INSTALLATION.value,
        milestone=WbsMilestoneSpec(
            code="MS-INSTALL",
            name="Install & Config Ready",
            tasks=(
                WbsTaskSpec("Rack installation + server stacking", "high"),
                WbsTaskSpec("Rack + server power on", "high"),
                WbsTaskSpec("DAC / ILO cabling"),
                WbsTaskSpec("BIOS configuration"),
                WbsTaskSpec("Firmware configuration"),
                WbsTaskSpec("LLD availability"),
                WbsTaskSpec("OS installation", "high"),
                WbsTaskSpec("VM installation", "high"),
                WbsTaskSpec("N/W configuration"),
                WbsTaskSpec("Tools integration", "high"),
                WbsTaskSpec("MBSS", "high"),
                WbsTaskSpec("VASCAN", "high"),
            ),
        ),
    ),
    WbsPhaseSpec(
        code="PH-ACCEPT",
        name="Acceptance",
        sequence_no=7,
        stage=SiteWorkflowStage.ACCEPTANCE.value,
        milestone=WbsMilestoneSpec(
            code="MS-HO",
            name="Handover / Circle Sign-off",
            tasks=(
                WbsTaskSpec("Handover to Application Team", "high"),
                WbsTaskSpec("HW-AT request", "high"),
                WbsTaskSpec("HW-AT sign-off from circle", "critical"),
            ),
        ),
    ),
)


def wbs_for_delivery_type(delivery_type: str) -> tuple[WbsPhaseSpec, ...]:
    """Filter WBS phases/tasks by delivery scope."""
    config_tasks = {
        "BIOS configuration",
        "Firmware configuration",
        "LLD availability",
        "OS installation",
        "VM installation",
        "N/W configuration",
        "Tools integration",
        "MBSS",
        "VASCAN",
    }
    phases: list[WbsPhaseSpec] = []
    for phase in SITE_INSTALLATION_WBS:
        if phase.stage == SiteWorkflowStage.CONFIGURATION.value:
            continue
        tasks = phase.milestone.tasks
        if phase.stage == SiteWorkflowStage.INSTALLATION.value:
            if not delivery_needs_configuration(delivery_type):
                tasks = tuple(t for t in tasks if t.task_name not in config_tasks)
            elif not delivery_includes_os(delivery_type):
                tasks = tuple(
                    t
                    for t in tasks
                    if t.task_name not in {
                        "OS installation",
                        "VM installation",
                        "N/W configuration",
                        "Tools integration",
                        "MBSS",
                        "VASCAN",
                    }
                )
            if delivery_is_rack_only(delivery_type):
                tasks = tuple(
                    t
                    for t in tasks
                    if "power on" not in t.task_name.lower()
                    and "dac" not in t.task_name.lower()
                    and t.task_name not in config_tasks
                )
                tasks = tuple(
                    WbsTaskSpec("Rack installation", t.priority)
                    if "stacking" in t.task_name.lower()
                    else t
                    for t in tasks
                )
            elif (
                delivery_includes_server(delivery_type)
                and not delivery_includes_rack(delivery_type)
            ):
                renamed: list[WbsTaskSpec] = []
                for t in tasks:
                    lower = t.task_name.lower()
                    if "stacking" in lower:
                        renamed.append(WbsTaskSpec("Server stacking", t.priority))
                    elif "power on" in lower:
                        renamed.append(WbsTaskSpec("Server power on", t.priority))
                    else:
                        renamed.append(t)
                tasks = tuple(renamed)
        if (
            not delivery_needs_hwat(delivery_type)
            and phase.stage == SiteWorkflowStage.ACCEPTANCE.value
        ):
            tasks = tuple(t for t in tasks if "HWAT" not in t.task_name)
        phases.append(
            WbsPhaseSpec(
                code=phase.code,
                name=phase.name,
                sequence_no=phase.sequence_no,
                stage=phase.stage,
                milestone=WbsMilestoneSpec(
                    code=phase.milestone.code,
                    name=phase.milestone.name,
                    tasks=tasks,
                ),
            )
        )
    return tuple(phases)
