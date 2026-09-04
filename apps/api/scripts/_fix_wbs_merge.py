from pathlib import Path

p = Path(r"d:\ERP\apps\api\src\modules\project\service\engines\site_installation_template.py")
text = p.read_text(encoding="utf-8")
start = text.index('    WbsPhaseSpec(\n        code="PH-INSTALL"')
new_tail = '''    WbsPhaseSpec(
        code="PH-INSTALL",
        name="Installation & Configuration",
        sequence_no=4,
        stage=SiteWorkflowStage.INSTALLATION.value,
        milestone=WbsMilestoneSpec(
            code="MS-INSTALL",
            name="Install & Config Ready",
            tasks=(
                WbsTaskSpec("Rack installation + server stacking", "high"),
                WbsTaskSpec("Rack + server power on", "high"),
                WbsTaskSpec("DAC / ILO cabling"),
                WbsTaskSpec("BIOS configuration"),
                WbsTaskSpec("Firmware / N/W configuration"),
                WbsTaskSpec("LLD availability"),
                WbsTaskSpec("OS installation", "high"),
                WbsTaskSpec("MBSS", "high"),
            ),
        ),
    ),
    WbsPhaseSpec(
        code="PH-ACCEPT",
        name="Acceptance",
        sequence_no=5,
        stage=SiteWorkflowStage.ACCEPTANCE.value,
        milestone=WbsMilestoneSpec(
            code="MS-HO",
            name="Handover / Circle Sign-off",
            tasks=(
                WbsTaskSpec("Handover to Application Team", "high"),
                WbsTaskSpec("HWAT request", "high"),
                WbsTaskSpec("HWAT sign-off from circle", "critical"),
            ),
        ),
    ),
)


def wbs_for_delivery_type(delivery_type: str) -> tuple[WbsPhaseSpec, ...]:
    """Filter WBS phases/tasks by delivery scope."""
    config_tasks = {
        "BIOS configuration",
        "Firmware / N/W configuration",
        "LLD availability",
        "OS installation",
        "MBSS",
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
                    t for t in tasks if t.task_name not in {"OS installation", "MBSS"}
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
'''
p.write_text(text[:start] + new_tail, encoding="utf-8", newline="\n")
print("ok")
