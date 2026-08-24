"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ClipboardList, FileText, GitBranch, MessageSquare, Plus, Upload, Wallet } from "lucide-react";

import {
  ExitDocumentDrawer,
  ExitInterviewDrawer,
  NewResignationDrawer,
} from "@/components/hr/offboarding/offboarding-drawers";
import {
  HrAuthBanner,
  HrEmptyState,
  HrKpiGrid,
  HrLoadingBlock,
  HrStatusBadge,
  HrToolbar,
  HrUnderlineTabs,
  type HrTabItem,
} from "@/components/hr/hr-primitives";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SetupSelect } from "@/components/hr/setup/setup-drawer";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  isApiError,
  loadOffboardingCases,
  offboardingAction,
  patchOffboardingCaseFromRow,
} from "@/services/offboarding-service";
import type { OffboardingCase } from "@/types/offboarding";
import {
  POST_HR_STEPS,
  SEPARATION_TYPE_LABELS,
  WORKFLOW_STEPS,
  postHrStepIndex,
  workflowStepIndex,
} from "@/types/offboarding";

type TabId = "resignations" | "workflow" | "clearance" | "exit_interview" | "documents" | "fnf";

const TABS: HrTabItem[] = [
  { id: "resignations", label: "Resignations", icon: FileText },
  { id: "workflow", label: "Exit Workflow", icon: GitBranch },
  { id: "clearance", label: "Clearance", icon: ClipboardList },
  { id: "exit_interview", label: "Exit Interview", icon: MessageSquare },
  { id: "documents", label: "Documents", icon: Upload },
  { id: "fnf", label: "FNF Settlement", icon: Wallet },
];

function WorkflowStrip({ c }: { c: OffboardingCase }) {
  const active = workflowStepIndex(c.status, c.fnfStatus);
  const postActive = postHrStepIndex(c);
  return (
    <div className="space-y-2">
      <ol className="flex flex-wrap items-center gap-1.5">
        {WORKFLOW_STEPS.map((step, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li key={step.key} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors duration-200",
                  done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : current
                      ? "border-primary/40 bg-primary/5 text-foreground"
                      : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3" /> : null}
                {step.label}
              </span>
              {i < WORKFLOW_STEPS.length - 1 ? (
                <span className="text-[10px] text-muted-foreground">→</span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {postActive >= 0 ? (
        <ol className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2">
          <li className="text-[10px] font-medium text-muted-foreground mr-1">After HR:</li>
          {POST_HR_STEPS.map((step, i) => {
            const done = i < postActive;
            const current = i === postActive;
            return (
              <li key={step.key} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium",
                    done
                      ? "border-sky-200 bg-sky-50 text-sky-900"
                      : current
                        ? "border-primary/40 bg-primary/5 text-foreground"
                        : "border-border bg-muted/40 text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3" /> : null}
                  {step.label}
                </span>
                {i < POST_HR_STEPS.length - 1 ? (
                  <span className="text-[10px] text-muted-foreground">→</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

function OffboardingCaseHeader({ c }: { c: OffboardingCase }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border/60 pb-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-foreground">{c.employeeName}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span className="font-mono font-medium text-foreground">{c.employeeCode}</span>
          <span className="mx-1.5 text-border">|</span>
          <span className="font-mono">{c.documentNumber}</span>
          <span className="mx-1.5 text-border">|</span>
          {SEPARATION_TYPE_LABELS[c.separationType] ?? c.separationType}
          <span className="mx-1.5 text-border">|</span>
          LWD {c.approvedLwd || c.requestedLwd || "—"}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5">
        <HrStatusBadge status={c.status} />
        <HrStatusBadge status={c.fnfStatus} />
      </div>
    </div>
  );
}

function OffboardingCasePicker({
  cases,
  selectedId,
  onSelect,
}: {
  cases: OffboardingCase[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="text-xs font-medium text-muted-foreground shrink-0">Employee / case</span>
      <SetupSelect
        className="min-w-[min(100%,20rem)] flex-1"
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="">Select offboarding case…</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.employeeName} ({c.employeeCode}) — {c.documentNumber}
          </option>
        ))}
      </SetupSelect>
    </div>
  );
}

export function OffboardingManagementPage() {
  const [cases, setCases] = useState<OffboardingCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("resignations");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await loadOffboardingCases();
      setCases(rows);
      setSelectedId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : rows[0]?.id ?? null));
    } catch (e) {
      toast(isApiError(e), "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => cases.find((c) => c.id === selectedId) ?? null,
    [cases, selectedId],
  );

  function tabForCase(c: OffboardingCase): TabId {
    const st = c.status.toLowerCase();
    if (
      ["draft", "submitted", "manager_approved", "it_approved", "accounts_approved"].includes(st)
    ) {
      return "workflow";
    }
    if (st === "hr_approved") {
      if (!c.exitInterview) return "exit_interview";
      if ((c.documents?.length ?? 0) === 0) return "documents";
      if (!["settled", "waived"].includes(c.fnfStatus.toLowerCase())) return "fnf";
      return "documents";
    }
    return "workflow";
  }

  function openCase(c: OffboardingCase, nextTab?: TabId) {
    setSelectedId(c.id);
    setTab(nextTab ?? tabForCase(c));
  }

  const authBlocked = !isAuthenticated() && !loading && cases.length === 0;

  async function act(action: string, body?: Record<string, unknown>, label?: string) {
    if (!selected) return;
    setActing(true);
    try {
      await offboardingAction(selected.id, action, body);
      toast(label ?? "Updated", "success");
      await load();
    } catch (e) {
      toast(isApiError(e), "error");
    } finally {
      setActing(false);
    }
  }

  async function toggleChecklist(key: string, done: boolean) {
    if (!selected) return;
    setActing(true);
    try {
      const row = await offboardingAction(selected.id, "checklist", { item_key: key, done });
      setCases((prev) =>
        prev.map((c) => (c.id === selected.id ? patchOffboardingCaseFromRow(c, row) : c)),
      );
      toast(done ? "Marked cleared" : "Clearance reset", "success");
    } catch (e) {
      toast(isApiError(e), "error");
    } finally {
      setActing(false);
    }
  }

  const openCount = cases.filter((c) => !["completed", "cancelled"].includes(c.status.toLowerCase())).length;
  const resignationCount = cases.filter((c) => c.separationType === "resignation").length;

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Offboarding"
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Button
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => setNewOpen(true)}
            >
              <Plus className="size-3.5" />
              New resignation
            </Button>
          </HrToolbar>
        }
      />
      {authBlocked ? <HrAuthBanner /> : null}
      {loading && cases.length === 0 ? <HrLoadingBlock /> : null}

      <HrKpiGrid
        items={[
          { label: "Open Cases", value: openCount },
          { label: "Resignations", value: resignationCount },
          {
            label: "Pending Clearance",
            value: cases.filter(
              (c) =>
                c.checklist.some((i) => !i.done) &&
                !["completed", "cancelled"].includes(c.status.toLowerCase()),
            ).length,
          },
          {
            label: "FNF pending",
            value: cases.filter(
              (c) =>
                ["hr_approved", "manager_approved"].includes(c.status.toLowerCase()) &&
                !["settled", "waived"].includes(c.fnfStatus.toLowerCase()),
            ).length,
          },
        ]}
      />

      <HrUnderlineTabs tabs={TABS} value={tab} onChange={(id) => setTab(id as TabId)} />

      {tab !== "resignations" && cases.length > 0 ? (
        <div className="rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm">
          <OffboardingCasePicker
            cases={cases}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
          />
        </div>
      ) : null}

      {tab === "resignations" ? (
        <section className="space-y-3">
          {cases.length === 0 ? (
            <HrEmptyState
              title="No offboarding cases"
              description="Create a resignation or exit request to start the workflow."
              action={
                <Button size="sm" className="cursor-pointer" onClick={() => setNewOpen(true)}>
                  New resignation
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm">
              <p className="border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
                Click a row to open that case. Status opens exit workflow; FNF opens settlement.
              </p>
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Document</th>
                    <th className="px-3 py-2 font-medium">Employee</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Last working day</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">FNF</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "cursor-pointer border-b border-border/50 transition-colors duration-200 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        selectedId === c.id && "bg-muted/40",
                      )}
                      onClick={() => openCase(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openCase(c);
                        }
                      }}
                    >
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs font-medium text-primary underline-offset-2 hover:underline">
                          {c.documentNumber}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium">{c.employeeName}</td>
                      <td className="px-3 py-2 text-xs capitalize">
                        {SEPARATION_TYPE_LABELS[c.separationType] ?? c.separationType}
                      </td>
                      <td className="px-3 py-2 text-xs tabular-nums">
                        {c.approvedLwd || c.requestedLwd || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCase(c, "workflow");
                          }}
                        >
                          <HrStatusBadge status={c.status} />
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCase(c, "fnf");
                          }}
                        >
                          <HrStatusBadge status={c.fnfStatus} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {!selected && tab !== "resignations" ? (
        <HrEmptyState
          title="Select a Case"
          description="Choose an offboarding case from Resignations to manage workflow, clearance, interview, and FNF."
          action={
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setTab("resignations")}>
              View resignations
            </Button>
          }
        />
      ) : null}

      {selected && tab === "workflow" ? (
        <section className="space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <OffboardingCaseHeader c={selected} />
          <WorkflowStrip c={selected} />
          <div className="flex flex-wrap gap-2">
            {selected.status === "draft" ? (
              <Button
                size="sm"
                className="cursor-pointer"
                disabled={acting}
                onClick={() => void act("submit", {}, "Submitted for approval")}
              >
                Submit
              </Button>
            ) : null}
            {selected.status === "submitted" ? (
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={acting}
                onClick={() => void act("approve", { stage: "manager" }, "Manager approved")}
              >
                Manager approve
              </Button>
            ) : null}
            {selected.status === "manager_approved" ? (
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={acting}
                onClick={() => void act("approve", { stage: "it" }, "IT approved")}
              >
                IT approve
              </Button>
            ) : null}
            {selected.status === "it_approved" ? (
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={acting}
                onClick={() => void act("approve", { stage: "accounts" }, "Accounts approved")}
              >
                Accounts approve
              </Button>
            ) : null}
            {selected.status === "accounts_approved" ? (
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={acting}
                onClick={() => void act("approve", { stage: "hr" }, "HR approved")}
              >
                HR approve
              </Button>
            ) : null}
            {selected.status === "hr_approved" && !selected.exitInterview ? (
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={acting}
                onClick={() => setInterviewOpen(true)}
              >
                Record exit interview
              </Button>
            ) : null}
            {selected.status === "hr_approved" && selected.exitInterview ? (
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={acting}
                onClick={() => setDocumentOpen(true)}
              >
                Upload document
              </Button>
            ) : null}
            {selected.status === "hr_approved" &&
            selected.exitInterview &&
            ["pending", "prepared"].includes(selected.fnfStatus.toLowerCase()) ? (
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={acting}
                onClick={() => void act("fnf/prepare", {}, "FNF prepared")}
              >
                Prepare FNF
              </Button>
            ) : null}
            {["calculated", "prepared"].includes(selected.fnfStatus.toLowerCase()) ? (
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={acting}
                onClick={() => void act("fnf/settle", {}, "FNF settled")}
              >
                Settle FNF
              </Button>
            ) : null}
            {selected.status === "hr_approved" &&
            ["settled", "waived"].includes(selected.fnfStatus.toLowerCase()) ? (
              <Button
                size="sm"
                className="cursor-pointer"
                disabled={acting}
                onClick={() => void act("complete", {}, "Offboarding completed")}
              >
                Complete exit
              </Button>
            ) : null}
          </div>
          {selected.reason ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Reason:</span> {selected.reason}
            </p>
          ) : null}
        </section>
      ) : null}

      {selected && tab === "clearance" ? (
        <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <OffboardingCaseHeader c={selected} />
          <h3 className="text-sm font-semibold">Clearance Checklist</h3>
          <p className="text-xs text-muted-foreground">
            Sign-off for <span className="font-medium text-foreground">{selected.employeeName}</span>{" "}
            ({selected.employeeCode}) before FNF and completion.
          </p>
          <ul className="space-y-2">
            {selected.checklist.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  {item.notes ? (
                    <p className="text-[10px] text-muted-foreground">{item.notes}</p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant={item.done ? "secondary" : "outline"}
                  className="h-7 cursor-pointer text-xs"
                  disabled={acting || selected.status === "completed"}
                  onClick={() => void toggleChecklist(item.key, !item.done)}
                >
                  {item.done ? "Cleared" : "Mark cleared"}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {selected && tab === "exit_interview" ? (
        <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <OffboardingCaseHeader c={selected} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Exit Interview</h3>
              <p className="text-xs text-muted-foreground">
                Structured feedback for {selected.employeeName} ({selected.employeeCode}). Required
                before FNF.
              </p>
            </div>
            <Button
              size="sm"
              className="cursor-pointer"
              disabled={
                selected.status === "completed" || selected.status.toLowerCase() !== "hr_approved"
              }
              onClick={() => setInterviewOpen(true)}
            >
              {selected.exitInterview ? "Update interview" : "Record interview"}
            </Button>
          </div>
          {selected.exitInterview ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs space-y-2">
              {Object.entries(selected.exitInterview.answers).map(([k, v]) => (
                <p key={k}>
                  <span className="font-medium capitalize">{k.replace(/_/g, " ")}:</span> {v}
                </p>
              ))}
              {selected.exitInterview.interviewerNotes ? (
                <p className="border-t border-border/50 pt-2 text-muted-foreground">
                  HR notes: {selected.exitInterview.interviewerNotes}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No exit interview recorded yet.</p>
          )}
        </section>
      ) : null}

      {selected && tab === "documents" ? (
        <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <OffboardingCaseHeader c={selected} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Exit Documents</h3>
              <p className="text-xs text-muted-foreground">
                Upload resignation / relieving / experience letters after HR approval.
              </p>
            </div>
            <Button
              size="sm"
              className="cursor-pointer"
              disabled={
                selected.status === "completed" ||
                !["hr_approved", "manager_approved", "it_approved", "accounts_approved"].includes(
                  selected.status.toLowerCase(),
                )
              }
              onClick={() => setDocumentOpen(true)}
            >
              Upload document
            </Button>
          </div>
          {selected.documents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No exit documents recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {selected.documents.map((d) => (
                <li
                  key={d.id}
                  className="rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <p className="font-medium">{d.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {d.docType.replace(/_/g, " ")}
                    {d.fileName ? ` · ${d.fileName}` : ""}
                    {d.uploadedAt ? ` · ${d.uploadedAt.slice(0, 10)}` : ""}
                  </p>
                  {d.notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">{d.notes}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {selected && tab === "fnf" ? (
        <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <OffboardingCaseHeader c={selected} />
          <h3 className="text-sm font-semibold">FNF Settlement</h3>
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground">How FNF works</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                Complete approvals: Manager → IT → Accounts → <strong>HR</strong>.
              </li>
              <li>
                Record <strong>Exit Interview</strong>, then upload exit <strong>Documents</strong>.
              </li>
              <li>
                Click <strong>Prepare FNF</strong> to create a final-settlement payroll run with leave
                encashment and gratuity.
              </li>
              <li>
                <strong>Settle FNF</strong>, then <strong>Complete exit</strong> to close employment.
              </li>
            </ol>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 px-3 py-2">
              <dt className="text-[10px] uppercase text-muted-foreground">FNF status</dt>
              <dd className="mt-1">
                <HrStatusBadge status={selected.fnfStatus} />
              </dd>
            </div>
            <div className="rounded-lg border border-border/60 px-3 py-2">
              <dt className="text-[10px] uppercase text-muted-foreground">Payroll run</dt>
              <dd className="mt-1 font-mono text-xs">{selected.fnfPayrollRunId ?? "—"}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            {selected.status.toLowerCase() === "hr_approved" &&
            selected.exitInterview &&
            ["pending", "prepared"].includes(selected.fnfStatus.toLowerCase()) ? (
              <Button
                size="sm"
                className="cursor-pointer"
                disabled={acting}
                onClick={() => void act("fnf/prepare", {}, "FNF calculation started")}
              >
                Prepare FNF
              </Button>
            ) : null}
            {["calculated", "prepared"].includes(selected.fnfStatus.toLowerCase()) ? (
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={acting}
                onClick={() => void act("fnf/settle", {}, "FNF marked settled")}
              >
                Mark FNF settled
              </Button>
            ) : null}
          </div>
          {selected.fnfMeta ? (
            <pre className="max-h-40 overflow-auto rounded-lg bg-muted/30 p-2 text-[10px]">
              {JSON.stringify(selected.fnfMeta, null, 2)}
            </pre>
          ) : null}
        </section>
      ) : null}

      <NewResignationDrawer
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={() => {
          toast("Offboarding case created", "success");
          void load();
          setTab("workflow");
        }}
      />
      {selected ? (
        <>
          <ExitInterviewDrawer
            open={interviewOpen}
            onClose={() => setInterviewOpen(false)}
            caseId={selected.id}
            initialNotes={selected.exitInterview?.interviewerNotes ?? undefined}
            onSaved={() => {
              toast("Exit interview saved", "success");
              void load();
            }}
          />
          <ExitDocumentDrawer
            open={documentOpen}
            onClose={() => setDocumentOpen(false)}
            caseId={selected.id}
            onSaved={() => {
              toast("Document recorded", "success");
              void load();
            }}
          />
        </>
      ) : null}
    </div>
  );
}
