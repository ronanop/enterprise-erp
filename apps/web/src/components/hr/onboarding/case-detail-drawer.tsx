"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  FileText,
  Globe,
  LayoutList,
  Loader2,
  Save,
  UserCheck,
} from "lucide-react";

import { EmployeeIdModeFields } from "@/components/hr/onboarding/employee-id-mode-fields";
import {
  OnboardingDocumentPreviewDialog,
  OnboardingDocumentRow,
} from "@/components/hr/onboarding/onboarding-document-preview";
import { MasterSelect } from "@/components/hr/shared/employee-select";
import { toast } from "@/components/hr/setup/setup-toast";
import { HrStatusBadge, HrUnderlineTabs, type HrTabItem } from "@/components/hr/hr-primitives";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { EMPLOYMENT_TYPE_OPTIONS, employmentDurationKind, formatEmploymentTypeLabel } from "@/config/hr-master-options";
import { getInvitationUrl, type OnboardingAssignmentInput } from "@/services/onboarding-management-service";
import { previewNextEmployeeCode } from "@/services/employee-management-service";
import {
  loadHrMasterDirectory,
  type HrMasterOption,
} from "@/services/hr-master-connector";
import { listEmploymentTypeOptions, listEntityOptions, loadSetupOrgLookups } from "@/services/hr-setup-service";
import type { ManagementGroup } from "@/services/management-group-service";
import type {
  ChecklistItem,
  OnboardingCase,
  OnboardingDocument,
} from "@/types/onboarding-management";
import { PORTAL_STEPS } from "@/types/onboarding-management";
import { resolveOnboardingDisplayStatus } from "@/lib/onboarding-display-status";
import { maskAadhaar, maskEmail, maskPan, maskPhone } from "@/lib/pii-mask";
import {
  canActivateOnboardingCase,
  canApproveOnboardingCase,
  canCompleteOnboardingCase,
  hasOnboardingEmployeeRecord,
  isJoiningDateReached,
  isPortalInProgressStatus,
} from "@/lib/onboarding-workflow";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  caseRow: OnboardingCase | null;
  managementGroups: ManagementGroup[];
  onClose: () => void;
  onChecklist: (caseId: string, itemId: string, status: ChecklistItem["status"]) => void;
  onVerifyDoc: (
    caseId: string,
    docId: string,
    status: OnboardingDocument["verifyStatus"],
  ) => void;
  onSaveAssignment: (caseId: string, input: OnboardingAssignmentInput) => Promise<void>;
  onApprove: (caseId: string) => void;
  onComplete: (
    caseId: string,
    managementGroup?: ManagementGroup,
    employeeCode?: string,
  ) => void | Promise<void>;
  onActivate: (caseId: string, managementGroup?: ManagementGroup) => void | Promise<void>;
  onInvite: (caseRow: OnboardingCase) => void;
};

type AssignmentForm = {
  joiningDate: string;
  entityId: string;
  entityName: string;
  department: string;
  designation: string;
  reportingManager: string;
  branch: string;
  branchId: string;
  employmentType: string;
  probationPeriodDays: string;
  trainingDurationDays: string;
  employeeIdMode: "auto" | "manual";
  assignedEmployeeCode: string;
};

function formFromCase(c: OnboardingCase): AssignmentForm {
  return {
    joiningDate: c.joiningDate || "",
    entityId: c.entityId || "",
    entityName: c.entityName || "",
    department: c.department || "",
    designation: c.designation || "",
    reportingManager: c.reportingManager || "",
    branch: c.branch || "",
    branchId: c.branchId || "",
    employmentType: c.employmentType || "permanent",
    probationPeriodDays: c.probationPeriodDays || "",
    trainingDurationDays: c.trainingDurationDays || "",
    employeeIdMode: c.employeeIdMode === "manual" ? "manual" : "auto",
    assignedEmployeeCode: c.assignedEmployeeCode || "",
  };
}

export function CaseDetailDrawer({
  open,
  caseRow,
  managementGroups,
  onClose,
  onChecklist,
  onVerifyDoc,
  onSaveAssignment,
  onApprove,
  onComplete,
  onActivate,
  onInvite,
}: Props) {
  const [tab, setTab] = useState<"overview" | "portal" | "docs" | "checklist" | "timeline">(
    "overview",
  );
  const [note, setNote] = useState("");
  const [previewDoc, setPreviewDoc] = useState<OnboardingDocument | null>(null);
  const [managementGroupId, setManagementGroupId] = useState(
    () => caseRow?.managementGroupId ?? "",
  );
  const [form, setForm] = useState<AssignmentForm | null>(null);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [actionBusy, setActionBusy] = useState<"complete" | "activate" | null>(null);
  const [masters, setMasters] = useState<{
    departments: HrMasterOption[];
    designations: HrMasterOption[];
    managers: HrMasterOption[];
    branches: HrMasterOption[];
  }>({
    departments: [],
    designations: [],
    managers: [],
    branches: [],
  });
  const [employmentTypes, setEmploymentTypes] = useState(EMPLOYMENT_TYPE_OPTIONS);
  const [entities, setEntities] = useState<{ value: string; label: string }[]>([]);
  const [nextAutoCode, setNextAutoCode] = useState("");

  useEffect(() => {
    if (!open) setActionBusy(null);
  }, [open]);

  useEffect(() => {
    if (!caseRow) {
      setForm(null);
      return;
    }
    setForm(formFromCase(caseRow));
    setManagementGroupId(caseRow.managementGroupId ?? "");
  }, [caseRow?.id, caseRow?.updatedAt]);

  useEffect(() => {
    if (!open) return;
    void Promise.all([
      loadHrMasterDirectory(),
      listEmploymentTypeOptions(),
      listEntityOptions(),
      loadSetupOrgLookups(),
    ]).then(([m, types, entityOpts, org]) => {
      // Prefer Org Setup → Branches (Sultanpur, etc.) so HR sees company branches
      const orgBranches: HrMasterOption[] = org.branches.map((b) => ({
        id: b.value,
        label: b.label,
        companyId: b.companyId,
      }));
      const byId = new Map<string, HrMasterOption>();
      for (const b of [...orgBranches, ...m.branches]) {
        if (b.id && !byId.has(b.id)) byId.set(b.id, b);
      }
      const branches = [...byId.values()];
      setMasters({
        departments: m.departments,
        designations: m.designations,
        managers: m.managers,
        branches,
      });
      setEmploymentTypes(types);
      setEntities(entityOpts);
      setNextAutoCode(previewNextEmployeeCode());
    });
  }, [open]);

  const timeline = useMemo(() => {
    if (!caseRow) return [];
    const items: { label: string; at?: string; done: boolean }[] = [
      { label: "Case created", at: caseRow.createdAt, done: true },
      {
        label: "Invitation sent",
        at: caseRow.invitation?.sentAt,
        done: Boolean(caseRow.invitation?.sentAt),
      },
      {
        label: "Portal in progress",
        done: isPortalInProgressStatus(caseRow.status),
      },
      {
        label: "Candidate submitted",
        at: caseRow.portal.submittedAt,
        done: Boolean(caseRow.portal.submittedAt),
      },
      {
        label: "HR verified",
        done: ["ready_to_join", "pending_join", "joined"].includes(caseRow.status),
      },
      {
        label: "Employee profile created",
        done: hasOnboardingEmployeeRecord(caseRow),
      },
      {
        label: "Employee activated",
        at: caseRow.activatedAt,
        done: caseRow.status === "joined",
      },
    ];
    return items;
  }, [caseRow]);

  if (!caseRow || !form) return null;

  const hrTasks = caseRow.checklist.filter((t) => t.owner === "hr");
  const mgrTasks = caseRow.checklist.filter((t) => t.owner === "manager");
  const showChecklist = caseRow.status === "joined" && caseRow.checklist.length > 0;
  const canApprove = canApproveOnboardingCase(caseRow);
  const canComplete = canCompleteOnboardingCase(caseRow);
  const canActivate = canActivateOnboardingCase(caseRow);
  const isPendingJoin = caseRow.status === "pending_join";
  const joiningNotReached = isPendingJoin && !isJoiningDateReached(caseRow.joiningDate);
  const selectedManagementGroup =
    managementGroups.find((group) => group.id === managementGroupId) ?? undefined;
  const assignmentEditable = !["joined", "cancelled"].includes(caseRow.status);

  async function runComplete() {
    if (actionBusy || !form) return;
    if (form.employeeIdMode === "manual" && !form.assignedEmployeeCode.trim()) {
      toast("Enter an employee ID or switch to auto-generate.", "error");
      return;
    }
    setActionBusy("complete");
    try {
      await onComplete(
        caseRow.id,
        selectedManagementGroup,
        form.employeeIdMode === "manual" ? form.assignedEmployeeCode.trim().toUpperCase() : undefined,
      );
    } finally {
      setActionBusy(null);
    }
  }

  async function runActivate() {
    if (actionBusy) return;
    setActionBusy("activate");
    try {
      await onActivate(caseRow.id, selectedManagementGroup);
    } finally {
      setActionBusy(null);
    }
  }

  const drawerTabs: HrTabItem[] = [
    { id: "overview", label: "Overview", icon: LayoutList },
    { id: "portal", label: "Portal", icon: Globe },
    { id: "docs", label: "Documents", icon: FileText },
    ...(showChecklist ? [{ id: "checklist", label: "Checklist", icon: ClipboardList }] : []),
    { id: "timeline", label: "Timeline", icon: CheckCircle2 },
  ];

  async function handleSaveAssignment() {
    if (!caseRow || !form) return;
    setSavingAssignment(true);
    try {
      const entity = entities.find((e) => e.value === form.entityId);
      await onSaveAssignment(caseRow.id, {
        joiningDate: form.joiningDate,
        entityId: form.entityId,
        entityName: entity?.label || form.entityName,
        department: form.department,
        designation: form.designation,
        reportingManager: form.reportingManager,
        branch: form.branch,
        branchId: form.branchId || undefined,
        employmentType: form.employmentType,
        probationPeriodDays: form.probationPeriodDays,
        trainingDurationDays: form.trainingDurationDays,
        employeeIdMode: form.employeeIdMode,
        employeeCode: form.assignedEmployeeCode,
      });
    } finally {
      setSavingAssignment(false);
    }
  }

  function patchForm(partial: Partial<AssignmentForm>) {
    setForm((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title={caseRow.candidateName}
      description={`${caseRow.caseCode} · ${resolveOnboardingDisplayStatus(caseRow.status, caseRow.joiningDate)} · ${caseRow.progressPct}%`}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={Boolean(actionBusy)}
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={Boolean(actionBusy)}
            onClick={() => onInvite(caseRow)}
          >
            Invitation
          </Button>
          {canApprove ? (
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={Boolean(actionBusy)}
              onClick={() => onApprove(caseRow.id)}
            >
              Approve submission
            </Button>
          ) : null}
          {canComplete ? (
            <Button
              type="button"
              className="cursor-pointer"
              disabled={Boolean(actionBusy)}
              onClick={() => void runComplete()}
            >
              {actionBusy === "complete" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <UserCheck className="size-3.5" />
              )}
              {actionBusy === "complete" ? "Opening…" : "Complete onboarding"}
            </Button>
          ) : null}
          {isPendingJoin ? (
            <Button
              type="button"
              className="cursor-pointer"
              disabled={Boolean(actionBusy)}
              title={
                joiningNotReached
                  ? `Joining date ${caseRow.joiningDate} — will stay on Pending Join until then`
                  : "Activate employee for Workforce"
              }
              onClick={() => void runActivate()}
            >
              {actionBusy === "activate" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <UserCheck className="size-3.5" />
              )}
              {actionBusy === "activate" ? "Opening employee…" : "Activate employee"}
            </Button>
          ) : null}
        </>
      }
    >
      {actionBusy ? (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground">
          <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
          <span>
            {actionBusy === "activate"
              ? "Activating employee and opening details…"
              : "Completing onboarding and opening employee details…"}
          </span>
        </div>
      ) : null}
      <HrUnderlineTabs
        embedded
        size="sm"
        className="mb-3"
        tabs={drawerTabs}
        value={tab}
        onChange={setTab}
      />

      {tab === "overview" ? (
        <div className="space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Case status</p>
              <HrStatusBadge
                status={resolveOnboardingDisplayStatus(caseRow.status, caseRow.joiningDate)}
              />
            </div>
            {assignmentEditable && form && !hasOnboardingEmployeeRecord(caseRow) ? (
              <div className="min-w-[16rem]">
                <EmployeeIdModeFields
                  mode={form.employeeIdMode}
                  manualCode={form.assignedEmployeeCode}
                  nextAutoCode={nextAutoCode}
                  onModeChange={(employeeIdMode) => patchForm({ employeeIdMode })}
                  onManualCodeChange={(assignedEmployeeCode) => patchForm({ assignedEmployeeCode })}
                />
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Employee ID:{" "}
                <span className="font-medium text-foreground">
                  {caseRow.employeeId || caseRow.assignedEmployeeCode || "Assigned after completion"}
                </span>
              </p>
            )}
          </div>

          {assignmentEditable ? (
            <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              After verifying documents, assign department, designation, reporting manager,
              employment type, and duration here. Save, then Approve submission.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {assignmentEditable ? (
              <>
                <SetupField label="Joining date" required>
                  <SetupInput
                    type="date"
                    value={form.joiningDate}
                    onChange={(e) => patchForm({ joiningDate: e.target.value })}
                  />
                </SetupField>
                <SetupField label="Legal entity" hint="HR Setup → Legal Entities">
                  <SetupSelect
                    value={form.entityId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const ent = entities.find((x) => x.value === id);
                      patchForm({ entityId: id, entityName: ent?.label || "" });
                    }}
                  >
                    <option value="">Select entity…</option>
                    {entities.map((e) => (
                      <option key={e.value} value={e.value}>
                        {e.label}
                      </option>
                    ))}
                  </SetupSelect>
                </SetupField>
                <SetupField label="Employment type" required>
                  <SetupSelect
                    value={form.employmentType}
                    onChange={(e) => {
                      const next = e.target.value;
                      const kind = employmentDurationKind(next);
                      patchForm({
                        employmentType: next,
                        probationPeriodDays: kind === "probation" ? form.probationPeriodDays : "",
                        trainingDurationDays: kind === "training" ? form.trainingDurationDays : "",
                      });
                    }}
                  >
                    {employmentTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </SetupSelect>
                </SetupField>
                {employmentDurationKind(form.employmentType) === "probation" ? (
                  <SetupField
                    label="Probation period (days)"
                    required
                    hint="Applied when the employee is activated"
                  >
                    <SetupInput
                      type="number"
                      min={1}
                      max={730}
                      placeholder="e.g. 90"
                      value={form.probationPeriodDays}
                      onChange={(e) => patchForm({ probationPeriodDays: e.target.value })}
                    />
                  </SetupField>
                ) : null}
                {employmentDurationKind(form.employmentType) === "training" ? (
                  <SetupField
                    label="Training duration (days)"
                    required
                    hint="Intern / trainee duration"
                  >
                    <SetupInput
                      type="number"
                      min={1}
                      max={730}
                      placeholder="e.g. 90"
                      value={form.trainingDurationDays}
                      onChange={(e) => patchForm({ trainingDurationDays: e.target.value })}
                    />
                  </SetupField>
                ) : null}
                <MasterSelect
                  label="Department"
                  required
                  value={masters.departments.find((d) => d.label === form.department)?.id || ""}
                  options={masters.departments}
                  onChange={(_id, opt) => patchForm({ department: opt?.label || "" })}
                  placeholder="Select department…"
                />
                <MasterSelect
                  label="Designation"
                  required
                  value={masters.designations.find((d) => d.label === form.designation)?.id || ""}
                  options={masters.designations}
                  onChange={(_id, opt) => patchForm({ designation: opt?.label || "" })}
                  placeholder="Select designation…"
                />
                <MasterSelect
                  label="Reporting manager"
                  hint="Employees marked as reporting managers"
                  value={
                    masters.managers.find((m) => m.label.startsWith(form.reportingManager))?.id ||
                    ""
                  }
                  options={masters.managers}
                  onChange={(_id, opt) =>
                    patchForm({
                      reportingManager: opt ? opt.label.split(" (")[0] : "",
                    })
                  }
                  placeholder="Select manager…"
                />
                <MasterSelect
                  label="Branch"
                  hint="Org Setup → Branches (company branches e.g. Sultanpur)"
                  value={
                    form.branchId ||
                    masters.branches.find((b) => b.label === form.branch)?.id ||
                    ""
                  }
                  options={masters.branches}
                  onChange={(id, opt) =>
                    patchForm({
                      branchId: id,
                      branch: opt?.label || "",
                    })
                  }
                  placeholder={
                    masters.branches.length
                      ? "Select company branch…"
                      : "No branches — add in Org Setup → Branches"
                  }
                />
              </>
            ) : (
              <>
                <Info label="Joining date" value={caseRow.joiningDate || "—"} />
                <Info label="Legal entity" value={caseRow.entityName || "—"} />
                <Info
                  label="Employment type"
                  value={formatEmploymentTypeLabel(caseRow.employmentType)}
                />
                {employmentDurationKind(caseRow.employmentType) === "probation" ? (
                  <Info
                    label="Probation"
                    value={
                      caseRow.probationPeriodDays
                        ? `${caseRow.probationPeriodDays} days`
                        : "—"
                    }
                  />
                ) : null}
                {employmentDurationKind(caseRow.employmentType) === "training" ? (
                  <Info
                    label="Training duration"
                    value={
                      caseRow.trainingDurationDays
                        ? `${caseRow.trainingDurationDays} days`
                        : "—"
                    }
                  />
                ) : null}
                <Info label="Department" value={caseRow.department || "—"} />
                <Info label="Designation" value={caseRow.designation || "—"} />
                <Info label="Reporting manager" value={caseRow.reportingManager || "—"} />
                <Info label="Branch" value={caseRow.branch || "—"} />
                <Info label="HR owner" value={caseRow.hrOwner || "—"} />
              </>
            )}
          </div>

          {assignmentEditable ? (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                className="cursor-pointer gap-1"
                disabled={savingAssignment}
                onClick={() => void handleSaveAssignment()}
              >
                <Save className="size-3.5" />
                {savingAssignment ? "Saving…" : "Save details"}
              </Button>
            </div>
          ) : null}

          {(canComplete || isPendingJoin) ? (
            <SetupField
              label="Employment group"
              hint="Optional. Applies the group's default shift, calendars, and HRMS feature toggles."
              labelClassName="normal-case"
            >
              <SetupSelect
                value={managementGroupId}
                onChange={(event) => setManagementGroupId(event.target.value)}
              >
                <option value="">No employment group</option>
                {managementGroups
                  .filter((group) => group.status === "active")
                  .map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.group_name} · {group.employment_type}
                    </option>
                  ))}
              </SetupSelect>
            </SetupField>
          ) : null}
          {caseRow.status !== "joined" ? (
            <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              {canApprove
                ? "Verify all documents, save assignment on Overview, then approve the submission."
                : isPendingJoin
                  ? joiningNotReached
                    ? `Employee profile created (${caseRow.employeeId}). Activation is available on or after ${caseRow.joiningDate}. They appear under Pending Join in Employee Management until then.`
                    : `Employee profile ready (${caseRow.employeeId}). Click Activate employee to move them to Probation in Workforce.`
                  : canComplete
                    ? "Complete onboarding to create the employee profile and open their details. If joining date is in the future, they are added to the list and activate on that date."
                    : "After verification and assignment, complete onboarding to create the employee record."}{" "}
              Employment group is optional; you can still assign shifts, leave policy, and other
              details from Workforce once the employee is active.
            </p>
          ) : null}
          {isPendingJoin ? (
            <div
              className={cn(
                "rounded-lg border px-3 py-3 text-xs",
                canActivate
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-amber-200 bg-amber-50 text-amber-950",
              )}
            >
              <p className="font-medium">
                {canActivate ? "Ready to activate" : "Waiting for joining date"}
              </p>
              <p className="mt-1 text-[11px] opacity-90">
                {canActivate
                  ? "Use Activate employee below to move this hire into Workforce (Probation)."
                  : `If you activate before ${caseRow.joiningDate}, they stay on the employee list and become active on the joining date.`}
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-2 cursor-pointer"
                disabled={Boolean(actionBusy)}
                title={
                  joiningNotReached
                    ? `Added to list — active on ${caseRow.joiningDate}`
                    : "Activate employee for Workforce"
                }
                onClick={() => void runActivate()}
              >
                {actionBusy === "activate" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <UserCheck className="size-3.5" />
                )}
                {actionBusy === "activate" ? "Opening employee…" : "Activate employee"}
              </Button>
            </div>
          ) : null}
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${caseRow.progressPct}%` }}
            />
          </div>
          {caseRow.invitation?.token ? (
            <p className="break-all font-mono text-[10px] text-muted-foreground">
              Portal: {getInvitationUrl(caseRow.invitation.token)}
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "portal" ? (
        <div className="space-y-2">
          {PORTAL_STEPS.map((s, i) => {
            const currentIdx = PORTAL_STEPS.findIndex((x) => x.id === caseRow.portal.currentStep);
            const done = caseRow.portal.submittedAt
              ? true
              : i < currentIdx || (i === currentIdx && caseRow.status !== "invitation_sent");
            return (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs"
              >
                {done ? (
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                ) : (
                  <Circle className="size-3.5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">
                    Step {i + 1}. {s.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{s.description}</p>
                </div>
              </div>
            );
          })}
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs">
            <p className="font-medium text-foreground">Personal snapshot</p>
            <p className="mt-1 text-muted-foreground">
              {caseRow.portal.personal.firstName} {caseRow.portal.personal.lastName} ·{" "}
              {maskEmail(caseRow.portal.personal.email || caseRow.candidateEmail)}
            </p>
            <p className="text-muted-foreground">
              Phone {maskPhone(caseRow.portal.personal.phone || caseRow.candidatePhone) || "—"}
            </p>
            <p className="text-muted-foreground">
              PAN {maskPan(caseRow.portal.governmentIds.pan) || "—"} · Aadhaar{" "}
              {maskAadhaar(caseRow.portal.governmentIds.aadhaar) || "—"}
            </p>
          </div>
        </div>
      ) : null}

      {tab === "docs" ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Click the file name or View to open a preview (PDF, images, Word, Excel, text).
          </p>
          {caseRow.portal.documents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            caseRow.portal.documents.map((d) => (
              <OnboardingDocumentRow
                key={d.id}
                doc={d}
                onView={setPreviewDoc}
                onVerify={() => onVerifyDoc(caseRow.id, d.id, "verified")}
                onReject={() => onVerifyDoc(caseRow.id, d.id, "rejected")}
              />
            ))
          )}
        </div>
      ) : null}

      <OnboardingDocumentPreviewDialog
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      {tab === "checklist" && showChecklist ? (
        <div className="space-y-4">
          <p className="text-[11px] text-muted-foreground">
            Post-join tasks — complete assignment details in Workforce as each item is done.
          </p>
          <ChecklistGroup
            title="HR Tasks"
            items={hrTasks}
            onToggle={(id, status) => onChecklist(caseRow.id, id, status)}
          />
          <ChecklistGroup
            title="Manager Tasks"
            items={mgrTasks}
            onToggle={(id, status) => onChecklist(caseRow.id, id, status)}
          />
          <SetupField label="Notes">
            <SetupTextarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </SetupField>
        </div>
      ) : null}

      {tab === "timeline" ? <CircularTimeline items={timeline} /> : null}
    </SetupDrawer>
  );
}

function CircularTimeline({
  items,
}: {
  items: { label: string; at?: string; done: boolean }[];
}) {
  const n = items.length;
  if (!n) return null;

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === n;
  const currentIdx = allDone ? n - 1 : Math.min(doneCount, n - 1);
  const current = items[currentIdx];

  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 78;
  const circ = 2 * Math.PI * r;
  const progress = doneCount / n;
  const dashOffset = circ * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-6 py-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={6}
            className="text-border"
          />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dashOffset}
            className="text-emerald-500 transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          />
        </svg>

        {items.map((item, i) => {
          const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          const isCurrent = i === currentIdx && !allDone;

          return (
            <div
              key={item.label}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: x, top: y }}
            >
              <span
                className={cn(
                  "block size-3 rounded-full border-2 border-card transition-all duration-500",
                  item.done ? "scale-100 bg-emerald-500" : "scale-90 bg-muted-foreground/40",
                  isCurrent && "scale-125 ring-4 ring-emerald-500/25",
                )}
              />
            </div>
          );
        })}

        <div
          key={current?.label}
          className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center animate-in fade-in-0 zoom-in-95 duration-300"
        >
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {allDone ? "Complete" : "Current"}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">{current?.label}</p>
          {current?.at ? (
            <p className="mt-1 text-[10px] text-muted-foreground">
              {new Date(current.at).toLocaleString()}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {doneCount}/{n} steps
          </p>
        </div>
      </div>

      <ol className="grid w-full max-w-xs grid-cols-1 gap-1.5">
        {items.map((t, i) => (
          <li
            key={t.label}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors duration-300",
              i === currentIdx ? "bg-emerald-500/10" : "bg-transparent",
            )}
          >
            <span
              className={cn(
                "size-2 shrink-0 rounded-full transition-colors duration-500",
                t.done ? "bg-emerald-500" : "bg-muted-foreground/40",
              )}
            />
            <span className={cn("font-medium", t.done ? "text-foreground" : "text-muted-foreground")}>
              {t.label}
            </span>
            {t.at ? (
              <span className="ml-auto text-[10px] text-muted-foreground">
                {new Date(t.at).toLocaleDateString()}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}

function ChecklistGroup({
  title,
  items,
  onToggle,
}: {
  title: string;
  items: ChecklistItem[];
  onToggle: (id: string, status: ChecklistItem["status"]) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2 text-xs transition-colors hover:bg-muted/40"
          >
            <input
              type="checkbox"
              className="cursor-pointer"
              checked={item.status === "done"}
              onChange={(e) => onToggle(item.id, e.target.checked ? "done" : "pending")}
            />
            <span className="flex-1">{item.name}</span>
            <HrStatusBadge status={item.status} />
          </label>
        ))}
      </div>
    </div>
  );
}
