"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  FileText,
  FolderOpen,
  LayoutList,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { CaseDetailDrawer } from "@/components/hr/onboarding/case-detail-drawer";
import {
  OnboardingDocumentPreviewDialog,
  OnboardingDocumentRow,
} from "@/components/hr/onboarding/onboarding-document-preview";
import { InvitationDrawer } from "@/components/hr/onboarding/invitation-drawer";
import { StartOnboardingDrawer } from "@/components/hr/onboarding/start-onboarding-drawer";
import {
  HrAuthBanner,
  HrEmptyState,
  HrStatusBadge,
  HrUnderlineTabs,
  type HrTabItem,
} from "@/components/hr/hr-primitives";
import { SetupDrawer } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsAvatar, EmsPagination, EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { hrmsPastelSurface } from "@/config/hrms-theme";
import { isAuthenticated } from "@/lib/auth";
import {
  buildOnboardingWorkflowSteps,
  onboardingStageRemark,
  statusToneClass,
} from "@/lib/onboarding-case-steps";
import { resolveOnboardingDisplayStatus } from "@/lib/onboarding-display-status";
import { isJoiningDateReached } from "@/lib/onboarding-workflow";
import { cn } from "@/lib/utils";
import { loadEmployeeDirectory } from "@/services/employee-management-service";
import {
  ensureOnboardingPoliciesLoaded,
  listActivePoliciesForPortal,
  listOnboardingPolicies,
} from "@/services/onboarding-policies-service";
import {
  ensureSignedPolicyDocsLoaded,
  getSignedPolicyDocsForCase,
  saveSignedPolicyDocsForCase,
} from "@/lib/onboarding-signed-docs-store";
import { stampPoliciesWithSignature } from "@/lib/stamp-policy-signatures";
import {
  activateOnboardingEmployee,
  approveCandidateReview,
  completeOnboarding,
  computeOnboardingStats,
  downloadTextFile,
  exportOnboardingCsv,
  filterOnboardingCases,
  listOnboardingAudit,
  loadOnboardingDirectory,
  sendInvitation,
  startOnboarding,
  updateChecklistItem,
  updateOnboardingAssignment,
  verifyDocument,
  copyInvitationLink,
  type OnboardingDirectory,
  type OnboardingStatBucket,
} from "@/services/onboarding-management-service";
import {
  listManagementGroups,
  type ManagementGroup,
} from "@/services/management-group-service";
import type {
  InvitationChannel,
  OnboardingCase,
  OnboardingDocument,
  OnboardingFilters,
  StartOnboardingInput,
} from "@/types/onboarding-management";
import {
  emptyOnboardingFilters,
  ONBOARDING_STATUS_LABELS,
} from "@/types/onboarding-management";

const PAGE = 10;

type Tab = "onboarding" | "documents" | "audit";
type DatePreset = "all" | "7" | "30" | "90";

/** Active onboarding = still in pipeline (not joined / cancelled). */
const ACTIVE_ONBOARDING_STATUSES = new Set([
  "draft",
  "invitation_sent",
  "in_progress",
  "submitted",
  "hr_review",
  "ready_to_join",
  "pending_join",
  "overdue",
]);

const STAT_CARDS: {
  key: OnboardingStatBucket;
  label: string;
  statKey: keyof ReturnType<typeof computeOnboardingStats>;
  tab: Tab;
  icon: typeof Users;
  hint: string;
}[] = [
  {
    key: "invitations_sent",
    label: "Invitations Sent",
    statKey: "invitationsSent",
    tab: "onboarding",
    icon: Mail,
    hint: "Portal invites",
  },
  {
    key: "pending_forms",
    label: "Pending Forms",
    statKey: "pendingForms",
    tab: "onboarding",
    icon: ClipboardList,
    hint: "Awaiting submission",
  },
  {
    key: "documents_pending",
    label: "Documents Pending",
    statKey: "documentsPending",
    tab: "documents",
    icon: FolderOpen,
    hint: "Verify uploads",
  },
  {
    key: "ready_to_join",
    label: "Ready to Join",
    statKey: "readyToJoin",
    tab: "onboarding",
    icon: UserCheck,
    hint: "Cleared for join",
  },
  {
    key: "pending_join",
    label: "Pending Join",
    statKey: "pendingJoin",
    tab: "onboarding",
    icon: Users,
    hint: "Before join date",
  },
  {
    key: "joined_today",
    label: "Joined Today",
    statKey: "joinedToday",
    tab: "onboarding",
    icon: UserPlus,
    hint: "Today",
  },
];

const STAT_LABELS: Record<OnboardingStatBucket, string> = {
  invitations_sent: "Invitations Sent",
  pending_forms: "Pending Forms",
  documents_pending: "Documents Pending",
  ready_to_join: "Ready to Join",
  pending_join: "Pending Join",
  joined_today: "Joined Today",
};

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function OnboardingManagementPage() {
  const router = useRouter();
  const [dir, setDir] = useState<OnboardingDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("onboarding");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<OnboardingFilters>(() => emptyOnboardingFilters());
  const [datePreset, setDatePreset] = useState<DatePreset>("30");
  const [statsBucket, setStatsBucket] = useState<OnboardingStatBucket | null>(null);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [startOpen, setStartOpen] = useState(false);
  const [inviteCase, setInviteCase] = useState<OnboardingCase | null>(null);
  const [detailCase, setDetailCase] = useState<OnboardingCase | null>(null);
  const [docsCase, setDocsCase] = useState<OnboardingCase | null>(null);
  const [docsSignedPolicies, setDocsSignedPolicies] = useState<OnboardingDocument[]>([]);
  const [docsPoliciesLoading, setDocsPoliciesLoading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<OnboardingDocument | null>(null);
  const [managementGroups, setManagementGroups] = useState<ManagementGroup[]>([]);

  async function openEmployeeDetails(employeeKey: string | undefined) {
    if (!employeeKey) return;
    try {
      const { records } = await loadEmployeeDirectory();
      const found = records.find(
        (r) => r.id === employeeKey || r.employeeCode === employeeKey,
      );
      router.push(`/hr/workforce/${found?.id ?? employeeKey}`);
    } catch {
      router.push(`/hr/workforce/${employeeKey}`);
    }
  }

  const loadSignedPoliciesForCase = useCallback(async (c: OnboardingCase) => {
    setDocsPoliciesLoading(true);
    try {
      await Promise.all([
        ensureSignedPolicyDocsLoaded().catch(() => ({})),
        ensureOnboardingPoliciesLoaded().catch(() => []),
      ]);
      const sigUrl = c.portal?.policies?.signatureDataUrl;
      let fromIdb = await getSignedPolicyDocsForCase(c.id);
      const fromCase = (c.portal?.policies?.signedDocuments ?? []).filter((s) =>
        Boolean(s.fileDataUrl),
      );
      // Always re-stamp when signature image exists (removes legacy "Digitally signed" text).
      if (sigUrl && sigUrl.startsWith("data:image/")) {
        try {
          const policies = listActivePoliciesForPortal();
          if (policies.length) {
            const stamped = await stampPoliciesWithSignature({
              policies,
              signatureDataUrl: sigUrl,
              signatureMimeType: c.portal?.policies?.signatureMimeType,
              candidateName: c.candidateName,
            });
            await saveSignedPolicyDocsForCase(c.id, stamped);
            fromIdb = stamped;
          }
        } catch {
          /* keep existing */
        }
      }
      const source = fromIdb.length ? fromIdb : fromCase;
      setDocsSignedPolicies(
        source.map((s) => ({
          id: `signed-policy-${c.id}-${s.policyId}`,
          kind: "other" as const,
          typeCode: `SIGNED-POLICY-${s.policyId}`,
          fileName: s.fileName || `${s.title}_signed.pdf`,
          uploadedAt: s.signedAt,
          verifyStatus: "accepted" as const,
          notes: s.title,
          fileDataUrl: s.fileDataUrl,
          mimeType: s.mimeType || "application/pdf",
        })),
      );
    } finally {
      setDocsPoliciesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!docsCase) {
      setDocsSignedPolicies([]);
      return;
    }
    void loadSignedPoliciesForCase(docsCase);
  }, [docsCase?.id, docsCase?.updatedAt, loadSignedPoliciesForCase]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [next, groups] = await Promise.all([
        loadOnboardingDirectory(),
        listManagementGroups().catch(() => []),
      ]);
      setDir(next);
      setManagementGroups(groups);
      setDocsCase((prev) =>
        prev ? (next.cases.find((c) => c.id === prev.id) ?? null) : null,
      );
    } catch {
      toast("Failed to load onboarding data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => computeOnboardingStats(dir?.cases ?? []), [dir]);
  const filtered = useMemo(() => {
    const base = filterOnboardingCases(
      dir?.cases ?? [],
      query,
      { ...filters, joiningFrom: "", joiningTo: "" },
      statsBucket,
    );
    if (datePreset === "all") return base;
    const from = isoDaysAgo(Number(datePreset));
    return base.filter((c) => {
      const created = (c.createdAt || "").slice(0, 10);
      const join = c.joiningDate || "";
      return (created && created >= from) || (join && join >= from);
    });
  }, [dir, query, filters, statsBucket, datePreset]);
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE;
    return filtered.slice(start, start + PAGE);
  }, [filtered, page]);

  useEffect(() => setPage(1), [query, filters, tab, statsBucket, datePreset]);

  const activeDocumentFolders = useMemo(() => {
    const source = statsBucket ? filtered : (dir?.cases ?? []);
    return source.filter(
      (c) =>
        ACTIVE_ONBOARDING_STATUSES.has(c.status) && c.portal.documents.length > 0,
    );
  }, [dir, filtered, statsBucket]);

  const audit = useMemo(() => listOnboardingAudit(), [dir, tab]);
  const authBlocked = !isAuthenticated() && !loading && !(dir?.cases.length);

  const allPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  function selectStatCard(card: (typeof STAT_CARDS)[number]) {
    const next = statsBucket === card.key ? null : card.key;
    setStatsBucket(next);
    if (next) {
      setTab(card.tab);
      setFilters(emptyOnboardingFilters());
      setDatePreset("all");
      setQuery("");
    }
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageRows.forEach((r) => next.delete(r.id));
      } else {
        pageRows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleStart(input: StartOnboardingInput) {
    const created = await startOnboarding(input);
    toast(`Onboarding ${created.caseCode} created`);
    await load();
    setInviteCase(created);
  }

  async function handleSend(caseId: string, channel: InvitationChannel, expiryDays: number) {
    const updated = await sendInvitation(caseId, channel, expiryDays);
    if (updated) {
      toast(`Invitation sent via ${channel}`);
      setInviteCase(updated);
      await load();
    } else {
      toast("Could not send invitation — save the case and try again", "error");
    }
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Employee Onboarding"
        description="Manage onboarding cases, track progress and ensure a smooth employee onboarding experience."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" className="cursor-pointer" onClick={() => setStartOpen(true)}>
              <Plus className="size-3.5" />
              Start Onboarding
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              disabled={!detailCase && !pageRows[0]}
              onClick={() => setInviteCase(detailCase ?? pageRows[0] ?? null)}
            >
              <Send className="size-3.5" />
              Send Invitation
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                downloadTextFile(
                  `onboarding-${new Date().toISOString().slice(0, 10)}.csv`,
                  exportOnboardingCsv(filtered),
                );
                toast("Export downloaded");
              }}
            >
              <Download className="size-3.5" />
              Export
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        }
      />

      {authBlocked ? <HrAuthBanner /> : null}

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {STAT_CARDS.map((card, index) => {
          const active = statsBucket === card.key;
          const value = Number(stats[card.statKey] ?? 0);
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => selectStatCard(card)}
              aria-pressed={active}
              className={cn(
                "flex min-h-[5.25rem] cursor-pointer flex-col justify-between rounded-2xl border px-3 py-3 text-left shadow-sm transition-all duration-200",
                hrmsPastelSurface(index),
                active
                  ? "border-foreground/20 ring-2 ring-primary"
                  : "border-border hover:border-primary/30 hover:shadow-md",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {card.label}
                </p>
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xl font-semibold tabular-nums text-foreground">
                  {loading && !dir ? "—" : value.toLocaleString("en-IN")}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{card.hint}</p>
              </div>
            </button>
          );
        })}
      </div>

      {statsBucket ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Filtered by card:</span>
          <span className="font-medium text-foreground">{STAT_LABELS[statsBucket]}</span>
          <span>
            · {filtered.length} case{filtered.length === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            className="cursor-pointer font-medium text-primary transition-colors duration-200 hover:underline"
            onClick={() => setStatsBucket(null)}
          >
            Clear
          </button>
        </div>
      ) : null}

      <HrUnderlineTabs
        tabs={
          [
            { id: "onboarding", label: "Onboarding Cases", icon: LayoutList },
            { id: "documents", label: "Documents", icon: FolderOpen },
            { id: "audit", label: "Audit Trail", icon: FileText },
          ] satisfies HrTabItem[]
        }
        value={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      {loading && !dir ? <EmsSkeleton /> : null}

      {tab === "onboarding" ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
            <div className="flex flex-wrap items-end gap-2">
              <div className="relative min-w-[14rem] flex-1 sm:max-w-md">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by candidate, case, offer, or employee ID…"
                  className="h-9 pl-8"
                />
              </div>
              <div className="w-[10rem]">
                <FilterSelect
                  value={filters.status}
                  onChange={(status) => setFilters((f) => ({ ...f, status }))}
                  options={[
                    { value: "all", label: "All Status" },
                    ...Object.entries(ONBOARDING_STATUS_LABELS)
                      .filter(([k]) => k !== "overdue")
                      .map(([k, v]) => ({ value: k, label: v })),
                  ]}
                />
              </div>
              <div className="w-[10.5rem]">
                <FilterSelect
                  value={filters.department}
                  onChange={(department) => setFilters((f) => ({ ...f, department }))}
                  options={[
                    { value: "all", label: "All Departments" },
                    ...(dir?.departments ?? []).map((d) => ({ value: d, label: d })),
                  ]}
                />
              </div>
              <div className="w-[9.5rem]">
                <FilterSelect
                  value={datePreset}
                  onChange={(v) => setDatePreset(v as DatePreset)}
                  options={[
                    { value: "all", label: "All Dates" },
                    { value: "7", label: "Last 7 Days" },
                    { value: "30", label: "Last 30 Days" },
                    { value: "90", label: "Last 90 Days" },
                  ]}
                />
              </div>
            </div>
          </div>

          {pageRows.length === 0 ? (
            <HrEmptyState
              title="No Onboarding Cases"
              description="Start onboarding for a new candidate joining the organization."
              action={
                <Button size="sm" className="cursor-pointer" onClick={() => setStartOpen(true)}>
                  <UserPlus className="size-3.5" />
                  Start Onboarding
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-xs">
                  <thead className="border-b border-border/70 bg-muted/30 text-[10px] tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="w-10 px-3 py-2.5">
                        <input
                          type="checkbox"
                          className="cursor-pointer accent-primary"
                          checked={allPageSelected}
                          onChange={toggleSelectAll}
                          aria-label="Select all on page"
                        />
                      </th>
                      <th className="px-3 py-2.5 font-medium">Case ID</th>
                      <th className="px-3 py-2.5 font-medium">Candidate</th>
                      <th className="px-3 py-2.5 font-medium">Join Date</th>
                      <th className="px-3 py-2.5 font-medium">Entity</th>
                      <th className="px-3 py-2.5 font-medium">Department</th>
                      <th className="px-3 py-2.5 font-medium">Progress</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => {
                      const open = expandedId === row.id;
                      const displayStatus = resolveOnboardingDisplayStatus(
                        row.status,
                        row.joiningDate,
                      );
                      const steps = buildOnboardingWorkflowSteps(row);
                      const currentStep = steps.find((s) => s.state === "current");
                      const photo = row.portal.documents.find(
                        (d) => d.kind === "photo" && d.fileDataUrl,
                      )?.fileDataUrl;
                      return (
                        <Fragment key={row.id}>
                          <tr
                            className={cn(
                              "border-b border-border/50 transition-colors duration-150",
                              open ? "bg-muted/20" : "hover:bg-muted/30",
                            )}
                          >
                            <td className="px-3 py-3 align-middle">
                              <input
                                type="checkbox"
                                className="cursor-pointer accent-primary"
                                checked={selected.has(row.id)}
                                onChange={() => toggleSelect(row.id)}
                                aria-label={`Select ${row.caseCode}`}
                              />
                            </td>
                            <td className="px-3 py-3 align-middle font-mono text-[11px] font-medium text-foreground">
                              {row.caseCode}
                            </td>
                            <td className="px-3 py-3 align-middle">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <EmsAvatar
                                  name={row.candidateName}
                                  photoUrl={photo}
                                  size="sm"
                                />
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-foreground">
                                    {row.candidateName}
                                  </p>
                                  <p className="truncate text-[10px] text-muted-foreground">
                                    {row.candidateEmail}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 align-middle whitespace-nowrap">
                              {row.joiningDate || "—"}
                            </td>
                            <td className="px-3 py-3 align-middle">
                              {row.entityName || "—"}
                            </td>
                            <td className="px-3 py-3 align-middle">{row.department || "—"}</td>
                            <td className="px-3 py-3 align-middle">
                              <div className="flex min-w-[7rem] items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all duration-300"
                                    style={{ width: `${Math.min(100, row.progressPct)}%` }}
                                  />
                                </div>
                                <span className="tabular-nums text-[11px] font-medium text-foreground">
                                  {row.progressPct}%
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 align-middle">
                              <span
                                className={cn(
                                  "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                                  statusToneClass(displayStatus),
                                )}
                              >
                                {displayStatus}
                              </span>
                            </td>
                            <td className="px-3 py-3 align-middle">
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 cursor-pointer"
                                  onClick={() => setDetailCase(row)}
                                >
                                  Open
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 cursor-pointer px-0"
                                  aria-expanded={open}
                                  aria-label={open ? "Collapse workflow" : "Expand workflow"}
                                  onClick={() =>
                                    setExpandedId((id) => (id === row.id ? null : row.id))
                                  }
                                >
                                  <ChevronDown
                                    className={cn(
                                      "size-4 transition-transform duration-200",
                                      open && "rotate-180",
                                    )}
                                  />
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {open ? (
                            <tr className="border-b border-border/50 bg-muted/15">
                              <td colSpan={9} className="px-4 py-4">
                                <div className="space-y-4">
                                  <ol className="flex flex-wrap items-start gap-0 overflow-x-auto pb-1">
                                    {steps.map((step, idx) => {
                                      const done = step.state === "done";
                                      const current = step.state === "current";
                                      return (
                                        <li
                                          key={step.id}
                                          className="flex min-w-[7.5rem] flex-1 items-start"
                                        >
                                          <div className="flex w-full flex-col items-center text-center">
                                            <div className="flex w-full items-center">
                                              <div
                                                className={cn(
                                                  "h-0.5 flex-1",
                                                  idx === 0
                                                    ? "bg-transparent"
                                                    : done || current
                                                      ? "bg-hrms-success/70"
                                                      : "bg-border",
                                                )}
                                              />
                                              <span
                                                className={cn(
                                                  "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-semibold",
                                                  done &&
                                                    "border-hrms-success bg-hrms-success text-white",
                                                  current &&
                                                    "border-primary bg-primary text-primary-foreground shadow-sm",
                                                  !done &&
                                                    !current &&
                                                    "border-border bg-card text-muted-foreground",
                                                )}
                                              >
                                                {done ? <Check className="size-3.5" /> : idx + 1}
                                              </span>
                                              <div
                                                className={cn(
                                                  "h-0.5 flex-1",
                                                  idx === steps.length - 1
                                                    ? "bg-transparent"
                                                    : done
                                                      ? "bg-hrms-success/70"
                                                      : "bg-border",
                                                )}
                                              />
                                            </div>
                                            <p
                                              className={cn(
                                                "mt-2 text-[11px] font-medium leading-tight",
                                                current
                                                  ? "text-primary"
                                                  : done
                                                    ? "text-foreground"
                                                    : "text-muted-foreground",
                                              )}
                                            >
                                              {step.label}
                                            </p>
                                            {step.at ? (
                                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                                {step.at}
                                              </p>
                                            ) : current ? (
                                              <p className="mt-0.5 text-[10px] font-medium text-primary">
                                                In Progress
                                              </p>
                                            ) : null}
                                          </div>
                                        </li>
                                      );
                                    })}
                                  </ol>

                                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5">
                                    <div className="flex flex-wrap items-center gap-3 text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">Current Stage</span>
                                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                                          {currentStep?.label ?? displayStatus}
                                        </span>
                                      </div>
                                      <p className="max-w-xl text-muted-foreground">
                                        <span className="font-medium text-foreground">Remarks: </span>
                                        {onboardingStageRemark(row)}
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="cursor-pointer"
                                      onClick={() => setDetailCase(row)}
                                    >
                                      View Details
                                    </Button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <EmsPagination
                page={page}
                pageSize={PAGE}
                total={filtered.length}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      ) : null}

      {tab === "documents" ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Folders for active onboarding candidates with uploads. Open{" "}
            <span className="font-medium text-foreground">View</span> to preview, verify, or reject.
          </p>
          {activeDocumentFolders.map((c) => {
            const docs = c.portal.documents;
            const verified = docs.filter((d) => d.verifyStatus === "verified").length;
            const pending = docs.filter((d) => d.verifyStatus === "pending").length;
            const rejected = docs.filter((d) => d.verifyStatus === "rejected").length;
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 text-xs"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded-md px-1 py-0.5 -mx-1 text-left transition-colors duration-200 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  onClick={() => setDocsCase(c)}
                >
                  <FolderOpen className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {c.candidateName} documents
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.caseCode} · {docs.length} file{docs.length === 1 ? "" : "s"}
                      {verified ? ` · ${verified} verified` : ""}
                      {pending ? ` · ${pending} pending` : ""}
                      {rejected ? ` · ${rejected} rejected` : ""}
                      {c.department ? ` · ${c.department}` : ""}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <HrStatusBadge
                    status={resolveOnboardingDisplayStatus(c.status, c.joiningDate)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 cursor-pointer gap-1"
                    onClick={() => setDocsCase(c)}
                  >
                    <Eye className="size-3" />
                    View
                  </Button>
                </div>
              </div>
            );
          })}
          {activeDocumentFolders.length === 0 ? (
            <HrEmptyState
              title="No active onboarding documents"
              description={
                statsBucket
                  ? "No active cases with uploads match this card filter."
                  : "Folders appear when an active onboarding candidate uploads documents via the portal."
              }
            />
          ) : null}
        </div>
      ) : null}

      {tab === "audit" ? (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/70 bg-muted/40 text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Detail</th>
                <th className="px-3 py-2">Actor</th>
              </tr>
            </thead>
            <tbody>
              {audit.slice(0, 100).map((a) => (
                <tr key={a.id} className="border-b border-border/50">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {new Date(a.at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-medium">{a.action}</td>
                  <td className="px-3 py-2">{a.detail}</td>
                  <td className="px-3 py-2">{a.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {audit.length === 0 ? (
            <div className="p-6">
              <HrEmptyState title="No audit entries" description="Actions will appear here." />
            </div>
          ) : null}
        </div>
      ) : null}

      <SetupDrawer
        open={Boolean(docsCase)}
        onClose={() => setDocsCase(null)}
        title={docsCase ? `${docsCase.candidateName} documents` : "Documents"}
        description={
          docsCase
            ? "Personal uploads and signed policies · preview, verify, or reject"
            : undefined
        }
        wide
        footer={
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={() => setDocsCase(null)}
          >
            Close
          </Button>
        }
      >
        {docsCase ? (
          <div className="space-y-5">
            <p className="text-[11px] text-muted-foreground">
              Click a file name or View to preview. Rejected personal files reopen the candidate
              portal for re-upload.
            </p>

            {(() => {
              const personalDocs = docsCase.portal.documents.filter(
                (d) =>
                  d.kind !== "signature" &&
                  !(d.typeCode || "").toUpperCase().startsWith("SIGNED-POLICY"),
              );
              const policiesAgreed = docsCase.portal.policies?.agreed;
              const acceptedIds = docsCase.portal.policies?.policies ?? [];
              const sigName =
                docsCase.portal.policies?.signatureFileName ||
                docsCase.portal.policies?.signature ||
                "";
              const sigUrl = docsCase.portal.policies?.signatureDataUrl;
              const policyCatalog = listOnboardingPolicies(true);

              return (
                <>
                  <section className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2 border-b border-border/60 pb-1.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                        Personal documents
                      </h4>
                      <span className="text-[10px] text-muted-foreground">
                        {personalDocs.length} file(s)
                      </span>
                    </div>
                    {personalDocs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No personal documents uploaded.</p>
                    ) : (
                      personalDocs.map((d) => (
                        <OnboardingDocumentRow
                          key={d.id}
                          doc={d}
                          subtitle={d.kind.replace(/_/g, " ")}
                          onView={setPreviewDoc}
                          onVerify={() => {
                            void (async () => {
                              const next = await verifyDocument(docsCase.id, d.id, "verified");
                              if (!next) {
                                toast("Failed to verify document", "error");
                                return;
                              }
                              setDocsCase(next);
                              toast("Document verified");
                              void load();
                            })();
                          }}
                          onReject={() => {
                            void (async () => {
                              const next = await verifyDocument(docsCase.id, d.id, "rejected");
                              if (!next) {
                                toast("Failed to reject document", "error");
                                return;
                              }
                              setDocsCase(next);
                              const copied = await copyInvitationLink(next);
                              setInviteCase(next);
                              toast(
                                copied
                                  ? "Document rejected — portal reopened. Link copied — send it from the invitation drawer."
                                  : "Document rejected — portal reopened. Use the invitation drawer to share the link.",
                              );
                              void load();
                            })();
                          }}
                        />
                      ))
                    )}
                  </section>

                  <section className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2 border-b border-border/60 pb-1.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                        Policies
                      </h4>
                      <span className="text-[10px] text-muted-foreground">
                        {docsPoliciesLoading
                          ? "Loading…"
                          : docsSignedPolicies.length
                            ? `${docsSignedPolicies.length} signed`
                            : policiesAgreed
                              ? "Agreed"
                              : "Not signed"}
                      </span>
                    </div>

                    {docsPoliciesLoading ? (
                      <p className="text-xs text-muted-foreground">Loading signed policies…</p>
                    ) : docsSignedPolicies.length > 0 ? (
                      <>
                        <p className="text-[10px] text-muted-foreground">
                          Signature stamped on every page · open each PDF to confirm the candidate
                          signed.
                        </p>
                        {docsSignedPolicies.map((d) => (
                          <OnboardingDocumentRow
                            key={d.id}
                            doc={d}
                            subtitle={d.notes || "Signed policy"}
                            onView={setPreviewDoc}
                          />
                        ))}
                      </>
                    ) : policiesAgreed || acceptedIds.length > 0 ? (
                      <>
                        <p className="text-[10px] text-amber-700">
                          Candidate agreed to policies
                          {sigName ? ` · signature: ${sigName}` : ""}
                          {!sigUrl
                            ? " — no signature image / stamped PDFs yet (legacy typed name)."
                            : " — stamped PDFs not available yet."}
                        </p>
                        <ul className="space-y-1.5">
                          {(acceptedIds.length
                            ? acceptedIds
                            : policyCatalog.filter((p) => p.status === "active").map((p) => p.id)
                          ).map((id) => {
                            const title =
                              policyCatalog.find((p) => p.id === id)?.title ||
                              id.replace(/_/g, " ");
                            return (
                              <li
                                key={id}
                                className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-xs"
                              >
                                <span className="font-medium">{title}</span>
                                <HrStatusBadge status="pending" />
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No policy acceptance yet. Signed PDFs appear here after the candidate
                        uploads a signature and submits onboarding.
                      </p>
                    )}

                    {sigUrl ? (
                      <OnboardingDocumentRow
                        doc={{
                          id: `sig-${docsCase.id}`,
                          kind: "signature",
                          typeCode: "DOC-SIGN",
                          fileName: sigName || "Digital signature",
                          uploadedAt: docsCase.portal.policies?.acceptedAt || "",
                          verifyStatus: "accepted",
                          fileDataUrl: sigUrl,
                          mimeType: "image/png",
                        }}
                        subtitle="Signature image"
                        onView={setPreviewDoc}
                      />
                    ) : null}
                  </section>
                </>
              );
            })()}
          </div>
        ) : null}
      </SetupDrawer>

      <OnboardingDocumentPreviewDialog
        doc={previewDoc}
        subtitle={
          previewDoc && docsCase
            ? `${docsCase.candidateName} · ${previewDoc.kind}`
            : previewDoc
              ? (dir?.cases ?? [])
                  .flatMap((c) =>
                    c.portal.documents.map((d) => ({
                      d,
                      label: `${c.candidateName} · ${d.kind}`,
                    })),
                  )
                  .find((x) => x.d.id === previewDoc.id)?.label
              : undefined
        }
        onClose={() => setPreviewDoc(null)}
      />

      <StartOnboardingDrawer
        open={startOpen}
        onClose={() => setStartOpen(false)}
        onSubmit={handleStart}
      />

      <InvitationDrawer
        open={Boolean(inviteCase)}
        caseRow={inviteCase}
        onClose={() => setInviteCase(null)}
        onSend={handleSend}
      />

      <CaseDetailDrawer
        key={detailCase?.id ?? "no-case"}
        open={Boolean(detailCase)}
        caseRow={detailCase}
        managementGroups={managementGroups}
        onClose={() => setDetailCase(null)}
        onInvite={(c) => {
          setDetailCase(null);
          setInviteCase(c);
        }}
        onChecklist={(caseId, itemId, status) => {
          updateChecklistItem(caseId, itemId, status);
          void load().then(async () => {
            const d = await loadOnboardingDirectory();
            setDir(d);
            setDetailCase(d.cases.find((x) => x.id === caseId) ?? null);
          });
        }}
        onSaveAssignment={async (caseId, input) => {
          try {
            const next = await updateOnboardingAssignment(caseId, input);
            if (!next) {
              toast("Failed to save assignment", "error");
              return;
            }
            toast("Assignment saved");
            setDetailCase(next);
            setDir((prev) =>
              prev
                ? {
                    ...prev,
                    cases: prev.cases.map((c) => (c.id === next.id ? next : c)),
                  }
                : prev,
            );
            void load();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Failed to save assignment", "error");
            throw e;
          }
        }}
        onVerifyDoc={(caseId, docId, status) => {
          void (async () => {
            const next = await verifyDocument(caseId, docId, status);
            if (!next) {
              toast("Failed to update document status", "error");
              return;
            }
            if (status === "rejected") {
              const copied = await copyInvitationLink(next);
              setInviteCase(next);
              toast(
                copied
                  ? "Document rejected — portal reopened. Link copied — send it from the invitation drawer."
                  : "Document rejected — portal reopened. Use the invitation drawer to share the link.",
              );
            } else {
              toast("Document verified");
            }
            setDetailCase(next);
            setDir((prev) =>
              prev
                ? {
                    ...prev,
                    cases: prev.cases.map((c) => (c.id === next.id ? next : c)),
                  }
                : prev,
            );
            void load().then(async () => {
              const d = await loadOnboardingDirectory();
              setDir(d);
              setDetailCase(d.cases.find((x) => x.id === caseId) ?? next);
            });
          })();
        }}
        onApprove={(caseId) => {
          void (async () => {
            try {
              const next = await approveCandidateReview(caseId);
              if (!next) {
                toast("Approval failed", "error");
                return;
              }
              toast("Candidate submission approved");
              setDetailCase(next);
              setDir((prev) =>
                prev
                  ? {
                      ...prev,
                      cases: prev.cases.map((c) => (c.id === next.id ? next : c)),
                    }
                  : prev,
              );
              void load().then(async () => {
                const d = await loadOnboardingDirectory();
                setDir(d);
                setDetailCase(d.cases.find((x) => x.id === caseId) ?? next);
              });
            } catch (e) {
              toast(e instanceof Error ? e.message : "Approval failed", "error");
            }
          })();
        }}
        onComplete={(caseId, managementGroup) =>
          completeOnboarding(caseId, {
            managementGroupId: managementGroup?.id,
            managementGroupName: managementGroup?.group_name,
          })
            .then(async (completed) => {
              if (!completed) return;
              const pendingJoin = completed.status === "pending_join";
              toast(
                pendingJoin
                  ? "Added to list. Active on joining date."
                  : `Employee ${completed.employeeId} activated`,
              );
              await openEmployeeDetails(completed.employeeId);
              setDetailCase(null);
              void load();
            })
            .catch((e) => {
              toast(e instanceof Error ? e.message : "Completion failed", "error");
              throw e;
            })
        }
        onActivate={async (caseId, managementGroup) => {
          const current =
            detailCase?.id === caseId
              ? detailCase
              : (dir?.cases.find((c) => c.id === caseId) ?? null);
          if (current && !isJoiningDateReached(current.joiningDate)) {
            toast("Added to list. Active on joining date.");
            await openEmployeeDetails(current.employeeId);
            setDetailCase(null);
            return;
          }
          try {
            const activated = await activateOnboardingEmployee(caseId, {
              managementGroupId: managementGroup?.id,
              managementGroupName: managementGroup?.group_name,
            });
            if (activated) {
              toast(`Employee ${activated.employeeId} is now active in Workforce`);
              await openEmployeeDetails(activated.employeeId);
              setDetailCase(null);
              void load();
            }
          } catch (e) {
            toast(e instanceof Error ? e.message : "Activation failed", "error");
            throw e;
          }
        }}
      />
    </div>
  );
}
