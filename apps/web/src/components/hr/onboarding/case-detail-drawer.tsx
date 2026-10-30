"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  FileText,
  Globe,
  LayoutList,
  Loader2,
  Mail,
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
import {
  hydrateOnboardingCaseFiles,
  mergeBgCheckDocumentsIntoCase,
  type OnboardingAssignmentInput,
} from "@/services/onboarding-management-service";
import { previewNextEmployeeCodeForEntity } from "@/services/employee-management-service";
import {
  loadHrMasterDirectory,
  type HrMasterOption,
} from "@/services/hr-master-connector";
import {
  listEmploymentTypeOptions,
  listEntityOptions,
  loadSetupOrgLookups,
  type SetupMasterOption,
} from "@/services/hr-setup-service";
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
  canApproveOnboardingCase,
  canCompleteOnboardingCase,
  hasOnboardingEmployeeRecord,
  isJoiningDateReached,
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
  onApprove: (caseId: string) => void | Promise<void>;
  onComplete: (
    caseId: string,
    managementGroup?: ManagementGroup,
    employeeCode?: string,
  ) => void | Promise<void>;
  onActivate: (caseId: string, managementGroup?: ManagementGroup) => void | Promise<void>;
  /** Resend onboarding invite email (portal link + login) via SMTP. */
  onResendInvitation?: (caseId: string) => void | Promise<void>;
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
  onResendInvitation,
}: Props) {
  const [tab, setTab] = useState<"overview" | "portal" | "docs" | "checklist">("overview");
  const [note, setNote] = useState("");
  const [previewDoc, setPreviewDoc] = useState<OnboardingDocument | null>(null);
  const [hydratedCase, setHydratedCase] = useState<OnboardingCase | null>(caseRow);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [managementGroupId, setManagementGroupId] = useState(
    () => caseRow?.managementGroupId ?? "",
  );
  const [form, setForm] = useState<AssignmentForm | null>(null);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);
  const [resendingInvite, setResendingInvite] = useState(false);
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
  const [entities, setEntities] = useState<SetupMasterOption[]>([]);
  const [nextAutoCode, setNextAutoCode] = useState("");

  useEffect(() => {
    if (!open) setActionBusy(false);
  }, [open]);

  useEffect(() => {
    if (!caseRow) {
      setHydratedCase(null);
      return;
    }
    // Keep file bytes from prior hydration; always take latest metadata (verifyStatus).
    setHydratedCase((prev) => {
      if (!prev || prev.id !== caseRow.id) return caseRow;
      return {
        ...caseRow,
        portal: {
          ...caseRow.portal,
          documents: caseRow.portal.documents.map((d) => {
            const prior = prev.portal.documents.find((x) => x.id === d.id);
            if (!prior?.fileDataUrl?.trim() || d.fileDataUrl?.trim()) return d;
            return {
              ...d,
              fileDataUrl: prior.fileDataUrl,
              mimeType: d.mimeType || prior.mimeType,
            };
          }),
          policies: {
            ...caseRow.portal.policies,
            signatureDataUrl:
              caseRow.portal.policies.signatureDataUrl?.trim() ||
              prev.portal.policies.signatureDataUrl,
            signatureMimeType:
              caseRow.portal.policies.signatureMimeType ||
              prev.portal.policies.signatureMimeType,
            signatureFileName:
              caseRow.portal.policies.signatureFileName ||
              prev.portal.policies.signatureFileName,
          },
        },
      };
    });
  }, [caseRow]);

  useEffect(() => {
    if (!caseRow) {
      setForm(null);
      return;
    }
    setForm(formFromCase(caseRow));
    setManagementGroupId(caseRow.managementGroupId ?? "");
  }, [caseRow?.id, caseRow?.updatedAt]);

  useEffect(() => {
    if (!open || tab !== "docs" || !caseRow) return;
    let cancelled = false;
    const metaCase = caseRow;
    void (async () => {
      const [hydrated, withBg] = await Promise.all([
        hydrateOnboardingCaseFiles(metaCase),
        mergeBgCheckDocumentsIntoCase(metaCase),
      ]);
      if (cancelled) return;
      // Prefer current caseRow verifyStatus over anything hydrate may have reloaded.
      setHydratedCase((prev) => {
        const statusSource = prev && prev.id === metaCase.id ? prev : metaCase;
        const hydratedById = new Map(hydrated.portal.documents.map((d) => [d.id, d]));
        const mergedDocs = withBg.portal.documents.map((d) => {
          const fromHydrate = hydratedById.get(d.id);
          const prior = statusSource.portal.documents.find((x) => x.id === d.id);
          const base = prior ?? d;
          if (base.fileDataUrl?.trim()) return { ...d, ...base, source: d.source ?? base.source };
          if (fromHydrate?.fileDataUrl?.trim()) {
            return {
              ...d,
              ...base,
              fileDataUrl: fromHydrate.fileDataUrl,
              mimeType: base.mimeType || fromHydrate.mimeType,
              source: d.source ?? base.source,
            };
          }
          return { ...base, ...d, source: d.source ?? base.source };
        });
        // Keep any hydrated-only docs not present after BG merge keying
        for (const d of hydrated.portal.documents) {
          if (!mergedDocs.some((x) => x.id === d.id)) mergedDocs.push(d);
        }
        return {
          ...statusSource,
          portal: {
            ...statusSource.portal,
            documents: mergedDocs,
            policies: {
              ...statusSource.portal.policies,
              signatureDataUrl:
                statusSource.portal.policies.signatureDataUrl?.trim() ||
                hydrated.portal.policies.signatureDataUrl,
              signatureMimeType:
                statusSource.portal.policies.signatureMimeType ||
                hydrated.portal.policies.signatureMimeType,
              signatureFileName:
                statusSource.portal.policies.signatureFileName ||
                hydrated.portal.policies.signatureFileName,
            },
          },
        };
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tab, caseRow?.id, caseRow?.updatedAt]);

  async function openDocPreview(doc: OnboardingDocument) {
    const base = hydratedCase ?? caseRow;
    if (!base) {
      setPreviewDoc(doc);
      return;
    }
    if (doc.fileDataUrl?.trim()) {
      setPreviewDoc(doc);
      return;
    }
    setPreviewLoading(true);
    try {
      const next = await hydrateOnboardingCaseFiles(base);
      setHydratedCase(next);
      const restored = next.portal.documents.find((d) => d.id === doc.id) ?? doc;
      setPreviewDoc(restored);
    } finally {
      setPreviewLoading(false);
    }
  }

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
    });
  }, [open]);

  useEffect(() => {
    if (!open || !form) return;
    const ent = entities.find((e) => e.value === form.entityId);
    const code = ent?.code;
    let cancelled = false;
    void previewNextEmployeeCodeForEntity(form.entityId || undefined, code).then((next) => {
      if (!cancelled) setNextAutoCode(next);
    });
    return () => {
      cancelled = true;
    };
  }, [open, form?.entityId, entities]);

  if (!caseRow || !form) return null;

  const hrTasks = caseRow.checklist.filter((t) => t.owner === "hr");
  const mgrTasks = caseRow.checklist.filter((t) => t.owner === "manager");
  const showChecklist = caseRow.status === "joined" && caseRow.checklist.length > 0;
  const canApprove = canApproveOnboardingCase(caseRow);
  const canComplete = canCompleteOnboardingCase(caseRow);
  const isPendingJoin = caseRow.status === "pending_join";
  const isActivated =
    caseRow.status === "joined" || Boolean(caseRow.activatedAt);
  const joiningNotReached = isPendingJoin && !isJoiningDateReached(caseRow.joiningDate);
  const selectedManagementGroup =
    managementGroups.find((group) => group.id === managementGroupId) ?? undefined;
  const assignmentEditable = !["joined", "cancelled"].includes(caseRow.status);
  /** Hide once the employee has been activated (Joined). */
  const showActivate =
    !isActivated && (canApprove || canComplete || isPendingJoin);

  async function runActivateEmployee() {
    if (actionBusy || !form) return;
    if (
      (canApprove || canComplete) &&
      form.employeeIdMode === "manual" &&
      !form.assignedEmployeeCode.trim()
    ) {
      toast("Enter an employee ID or switch to auto-generate.", "error");
      return;
    }
    setActionBusy(true);
    try {
      if (canApprove) {
        await onApprove(caseRow.id);
      }
      if (canApprove || canComplete) {
        await onComplete(
          caseRow.id,
          selectedManagementGroup,
          form.employeeIdMode === "manual"
            ? form.assignedEmployeeCode.trim().toUpperCase()
            : undefined,
        );
        return;
      }
      if (isPendingJoin) {
        await onActivate(caseRow.id, selectedManagementGroup);
      }
    } finally {
      setActionBusy(false);
    }
  }

  const drawerTabs: HrTabItem[] = [
    { id: "overview", label: "Overview", icon: LayoutList },
    { id: "portal", label: "Portal", icon: Globe },
    { id: "docs", label: "Documents", icon: FileText },
    ...(showChecklist ? [{ id: "checklist", label: "Checklist", icon: ClipboardList }] : []),
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
        managementGroupId: managementGroupId || undefined,
        managementGroupName: selectedManagementGroup?.group_name,
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
        showActivate ? (
          <Button
            type="button"
            className="cursor-pointer"
            disabled={Boolean(actionBusy)}
            title={
              joiningNotReached
                ? `Joining date ${caseRow.joiningDate} - will stay on Pending Join until then`
                : "Activate employee for Workforce"
            }
            onClick={() => void runActivateEmployee()}
          >
            {actionBusy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <UserCheck className="size-3.5" />
            )}
            {actionBusy ? "Opening…" : "Activate employee"}
          </Button>
        ) : null
      }
    >
      {actionBusy ? (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground">
          <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
          <span>Activating employee and opening details…</span>
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
                <SetupField label="Legal entity">
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
                        {e.code ? `${e.label} (${e.code})` : e.label}
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
                  <SetupField label="Probation period (days)" required>
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
                  <SetupField label="Training duration (days)" required>
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
                    masters.branches.length ? "Select company branch…" : "No branches available"
                  }
                />
              </>
            ) : (
              <>
                <Info label="Joining date" value={caseRow.joiningDate || "-"} />
                <Info label="Legal entity" value={caseRow.entityName || "-"} />
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
                        : "-"
                    }
                  />
                ) : null}
                {employmentDurationKind(caseRow.employmentType) === "training" ? (
                  <Info
                    label="Training duration"
                    value={
                      caseRow.trainingDurationDays
                        ? `${caseRow.trainingDurationDays} days`
                        : "-"
                    }
                  />
                ) : null}
                <Info label="Department" value={caseRow.department || "-"} />
                <Info label="Designation" value={caseRow.designation || "-"} />
                <Info label="Reporting manager" value={caseRow.reportingManager || "-"} />
                <Info label="Branch" value={caseRow.branch || "-"} />
                <Info label="HR owner" value={caseRow.hrOwner || "-"} />
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

          {assignmentEditable || canComplete || isPendingJoin ? (
            <SetupField label="Employment group" labelClassName="normal-case">
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
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${caseRow.progressPct}%` }}
            />
          </div>
          {onResendInvitation ? (
            <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">
                Portal login is emailed to the candidate only. Resend to deliver a fresh
                link and password for completing onboarding details.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 cursor-pointer"
                disabled={resendingInvite}
                onClick={() => {
                  void (async () => {
                    setResendingInvite(true);
                    try {
                      await onResendInvitation(caseRow.id);
                    } finally {
                      setResendingInvite(false);
                    }
                  })();
                }}
              >
                {resendingInvite ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Mail className="size-3.5" />
                )}
                {resendingInvite
                  ? "Sending…"
                  : caseRow.invitation?.sentAt
                    ? "Resend invitation"
                    : "Send invitation"}
              </Button>
              {caseRow.invitation?.sentAt ? (
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Last sent {new Date(caseRow.invitation.sentAt).toLocaleString()}
                  {caseRow.invitation.resendCount
                    ? ` · Resends: ${caseRow.invitation.resendCount}`
                    : ""}
                </p>
              ) : null}
            </div>
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
              Phone {maskPhone(caseRow.portal.personal.phone || caseRow.candidatePhone) || "-"}
            </p>
            <p className="text-muted-foreground">
              PAN {maskPan(caseRow.portal.governmentIds.pan) || "-"} · Aadhaar{" "}
              {maskAadhaar(caseRow.portal.governmentIds.aadhaar) || "-"}
            </p>
          </div>
        </div>
      ) : null}

      {tab === "docs" ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Click the file name or View to open a preview (PDF, images, Word, Excel, text).
          </p>
          {previewLoading ? (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Loading file for preview…
            </p>
          ) : null}
          {(hydratedCase ?? caseRow).portal.documents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            (hydratedCase ?? caseRow).portal.documents.map((d) => (
              <OnboardingDocumentRow
                key={d.id}
                doc={d}
                subtitle={
                  d.source === "bg_check"
                    ? `${d.kind.replace(/_/g, " ")} · BG check`
                    : undefined
                }
                acting={verifyingDocId === d.id}
                onView={(doc) => {
                  void openDocPreview(doc);
                }}
                onVerify={
                  d.source === "bg_check"
                    ? undefined
                    : () => {
                        const base = hydratedCase ?? caseRow;
                        const previousDocs = base.portal.documents;
                        setHydratedCase({
                          ...base,
                          portal: {
                            ...base.portal,
                            documents: previousDocs.map((doc) =>
                              doc.id === d.id ? { ...doc, verifyStatus: "verified" } : doc,
                            ),
                          },
                        });
                        setVerifyingDocId(d.id);
                        void Promise.resolve(onVerifyDoc(caseRow.id, d.id, "verified"))
                          .catch(() => {
                            setHydratedCase((current) => {
                              const source = current ?? base;
                              return {
                                ...source,
                                portal: { ...source.portal, documents: previousDocs },
                              };
                            });
                          })
                          .finally(() => {
                            setVerifyingDocId((current) => (current === d.id ? null : current));
                          });
                      }
                }
                onReject={
                  d.source === "bg_check"
                    ? undefined
                    : () => {
                        setVerifyingDocId(d.id);
                        void Promise.resolve(onVerifyDoc(caseRow.id, d.id, "rejected")).finally(
                          () => {
                            setVerifyingDocId((current) => (current === d.id ? null : current));
                          },
                        );
                      }
                }
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
            Post-join tasks - complete assignment details in Workforce as each item is done.
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
    </SetupDrawer>
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
