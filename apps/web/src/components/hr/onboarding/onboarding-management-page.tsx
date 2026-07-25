"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  Mail,
  Plus,
  Send,
  UserPlus,
} from "lucide-react";

import { CaseDetailDrawer } from "@/components/hr/onboarding/case-detail-drawer";
import { InvitationDrawer } from "@/components/hr/onboarding/invitation-drawer";
import { StartOnboardingDrawer } from "@/components/hr/onboarding/start-onboarding-drawer";
import {
  HrAuthBanner,
  HrEmptyState,
  HrStatusBadge,
  HrToolbar,
} from "@/components/hr/hr-primitives";
import { SetupDrawer, SetupField, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsPagination, EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  activateEmployee,
  computeOnboardingStats,
  downloadTextFile,
  exportOnboardingCsv,
  filterOnboardingCases,
  joiningThisWeek,
  listOnboardingAudit,
  loadOnboardingDirectory,
  markReadyToJoin,
  sendInvitation,
  startOnboarding,
  updateChecklistItem,
  verifyDocument,
  type OnboardingDirectory,
} from "@/services/onboarding-management-service";
import type {
  InvitationChannel,
  OnboardingCase,
  OnboardingFilters,
  StartOnboardingInput,
} from "@/types/onboarding-management";
import {
  emptyOnboardingFilters,
  ONBOARDING_STATUS_LABELS,
} from "@/types/onboarding-management";

const PAGE = 10;

type Tab = "cases" | "checklist" | "documents" | "reports" | "audit";

export function OnboardingManagementPage() {
  const [dir, setDir] = useState<OnboardingDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("cases");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<OnboardingFilters>(() => emptyOnboardingFilters());
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [startOpen, setStartOpen] = useState(false);
  const [inviteCase, setInviteCase] = useState<OnboardingCase | null>(null);
  const [detailCase, setDetailCase] = useState<OnboardingCase | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDir(await loadOnboardingDirectory());
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
  const filtered = useMemo(
    () => filterOnboardingCases(dir?.cases ?? [], query, filters),
    [dir, query, filters],
  );
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE;
    return filtered.slice(start, start + PAGE);
  }, [filtered, page]);

  useEffect(() => setPage(1), [query, filters, tab]);

  const audit = useMemo(() => listOnboardingAudit(), [dir, tab]);
  const weekJoiners = useMemo(() => joiningThisWeek(dir?.cases ?? []), [dir]);
  const authBlocked = !isAuthenticated() && !loading && !(dir?.cases.length);

  async function handleStart(input: StartOnboardingInput) {
    const created = await startOnboarding(input);
    toast(`Onboarding ${created.caseCode} created`);
    await load();
    setInviteCase(created);
  }

  function handleSend(caseId: string, channel: InvitationChannel, expiryDays: number) {
    const updated = sendInvitation(caseId, channel, expiryDays);
    if (updated) {
      toast(`Invitation sent via ${channel}`);
      void load();
    }
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Employee Onboarding"
        description="Manage pre-joining activities, document collection, onboarding tasks, and employee activation."
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
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
          </HrToolbar>
        }
      />

      {authBlocked ? <HrAuthBanner /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Invitations Sent", value: stats.invitationsSent },
          { label: "Pending Forms", value: stats.pendingForms },
          { label: "Documents Pending", value: stats.documentsPending },
          { label: "Ready to Join", value: stats.readyToJoin },
          { label: "Joined Today", value: stats.joinedToday },
          { label: "Overdue", value: stats.overdue },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-border/70 bg-card px-3 py-3 shadow-sm transition-shadow duration-200 hover:shadow-md"
          >
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {k.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border/70 pb-px">
        {(
          [
            ["cases", "Cases"],
            ["checklist", "Checklist board"],
            ["documents", "Documents"],
            ["reports", "Reports"],
            ["audit", "Audit"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "cursor-pointer rounded-t-md px-3 py-2 text-xs font-medium transition-colors duration-200",
              tab === id
                ? "border border-b-0 border-border bg-card text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && !dir ? <EmsSkeleton /> : null}

      {tab === "cases" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search candidate, case, offer, EMP id…"
              className="max-w-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setFiltersOpen(true)}
            >
              Filters
            </Button>
            <span className="text-xs text-muted-foreground">{filtered.length} cases</span>
          </div>

          {pageRows.length === 0 ? (
            <HrEmptyState
              title="No onboarding cases"
              description="Start onboarding after an offer is accepted in Recruitment."
              action={
                <Button size="sm" className="cursor-pointer" onClick={() => setStartOpen(true)}>
                  <UserPlus className="size-3.5" />
                  Start Onboarding
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/70 bg-muted/40 text-[10px] tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-3 py-2 font-medium">Case</th>
                    <th className="px-3 py-2 font-medium">Candidate</th>
                    <th className="px-3 py-2 font-medium">Join</th>
                    <th className="px-3 py-2 font-medium">Dept</th>
                    <th className="px-3 py-2 font-medium">Progress</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/50 transition-colors duration-150 hover:bg-muted/30"
                    >
                      <td className="px-3 py-2 font-mono text-[11px]">{row.caseCode}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-foreground">{row.candidateName}</p>
                        <p className="text-[10px] text-muted-foreground">{row.candidateEmail}</p>
                      </td>
                      <td className="px-3 py-2">{row.joiningDate || "—"}</td>
                      <td className="px-3 py-2">{row.department}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${row.progressPct}%` }}
                            />
                          </div>
                          <span>{row.progressPct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <HrStatusBadge status={ONBOARDING_STATUS_LABELS[row.status]} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
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
                            className="h-7 cursor-pointer"
                            onClick={() => setInviteCase(row)}
                          >
                            <Mail className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-border/70 px-3 py-2">
                <EmsPagination
                  page={page}
                  pageSize={PAGE}
                  total={filtered.length}
                  onPageChange={setPage}
                />
              </div>
            </div>
          )}
        </div>
      ) : null}

      {tab === "checklist" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {(dir?.cases ?? [])
            .filter((c) => !["joined", "cancelled"].includes(c.status))
            .slice(0, 8)
            .map((c) => (
              <div key={c.id} className="rounded-xl border border-border/70 bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{c.candidateName}</p>
                    <p className="text-[10px] text-muted-foreground">{c.caseCode}</p>
                  </div>
                  <HrStatusBadge status={ONBOARDING_STATUS_LABELS[c.status]} />
                </div>
                <ul className="space-y-1">
                  {c.checklist.slice(0, 6).map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="cursor-pointer"
                        checked={t.status === "done"}
                        onChange={(e) => {
                          updateChecklistItem(c.id, t.id, e.target.checked ? "done" : "pending");
                          void load();
                        }}
                      />
                      <span className="flex-1">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{t.owner}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 cursor-pointer"
                  onClick={() => setDetailCase(c)}
                >
                  Full checklist
                </Button>
              </div>
            ))}
          {(dir?.cases ?? []).filter((c) => !["joined", "cancelled"].includes(c.status)).length ===
          0 ? (
            <HrEmptyState title="No active checklists" description="Open cases appear here." />
          ) : null}
        </div>
      ) : null}

      {tab === "documents" ? (
        <div className="space-y-2">
          {(dir?.cases ?? []).flatMap((c) =>
            c.portal.documents.map((d) => (
              <div
                key={`${c.id}-${d.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-medium">{d.fileName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.candidateName} · {d.kind}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <HrStatusBadge status={d.verifyStatus} />
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 cursor-pointer"
                    onClick={() => {
                      verifyDocument(c.id, d.id, "verified");
                      toast("Document verified");
                      void load();
                    }}
                  >
                    Verify
                  </Button>
                </div>
              </div>
            )),
          )}
          {(dir?.cases ?? []).every((c) => c.portal.documents.length === 0) ? (
            <HrEmptyState
              title="No documents yet"
              description="Documents appear after candidates upload via the secure portal."
            />
          ) : null}
        </div>
      ) : null}

      {tab === "reports" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <ReportCard title="Completion rate" value={`${stats.completionRate}%`} />
          <ReportCard title="Total cases" value={String(stats.total)} />
          <ReportCard title="Joining this week" value={String(weekJoiners.length)} />
          <ReportCard title="Overdue tasks" value={String(stats.overdue)} />
          <div className="rounded-xl border border-border/70 bg-card p-4 md:col-span-2">
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Joining this week
            </p>
            {weekJoiners.length === 0 ? (
              <p className="text-xs text-muted-foreground">No joiners scheduled this week.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {weekJoiners.map((c) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span>
                      {c.candidateName} · {c.department}
                    </span>
                    <span className="text-muted-foreground">{c.joiningDate}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-4 md:col-span-2">
            <p className="text-xs text-muted-foreground">
              Pipeline: Recruitment (Offer Accepted) → Onboarding portal → HR verification →{" "}
              <Link href="/hr/workforce" className="cursor-pointer text-primary underline">
                Employee Management
              </Link>
            </p>
          </div>
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
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        description="Narrow onboarding cases"
        footer={
          <Button
            type="button"
            className="cursor-pointer"
            onClick={() => setFiltersOpen(false)}
          >
            Apply
          </Button>
        }
      >
        <div className="space-y-3">
          <SetupField label="Status">
            <SetupSelect
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="all">All</option>
              {Object.entries(ONBOARDING_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
          <SetupField label="Department">
            <SetupSelect
              value={filters.department}
              onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
            >
              <option value="all">All</option>
              {(dir?.departments ?? []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="cursor-pointer"
              checked={filters.overdueOnly}
              onChange={(e) => setFilters((f) => ({ ...f, overdueOnly: e.target.checked }))}
            />
            Overdue only
          </label>
        </div>
      </SetupDrawer>

      <StartOnboardingDrawer
        open={startOpen}
        onClose={() => setStartOpen(false)}
        acceptedOffers={dir?.acceptedOffers ?? []}
        onSubmit={handleStart}
      />

      <InvitationDrawer
        open={Boolean(inviteCase)}
        caseRow={inviteCase}
        onClose={() => setInviteCase(null)}
        onSend={handleSend}
      />

      <CaseDetailDrawer
        open={Boolean(detailCase)}
        caseRow={detailCase}
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
        onVerifyDoc={(caseId, docId, status) => {
          verifyDocument(caseId, docId, status);
          toast(status === "verified" ? "Document verified" : "Document rejected");
          void load().then(async () => {
            const d = await loadOnboardingDirectory();
            setDir(d);
            setDetailCase(d.cases.find((x) => x.id === caseId) ?? null);
          });
        }}
        onReady={(caseId) => {
          markReadyToJoin(caseId);
          toast("Marked ready to join");
          void load().then(async () => {
            const d = await loadOnboardingDirectory();
            setDir(d);
            setDetailCase(d.cases.find((x) => x.id === caseId) ?? null);
          });
        }}
        onActivate={(caseId) => {
          const activated = activateEmployee(caseId);
          if (activated) {
            toast(`Employee ${activated.employeeId} activated · welcome email queued`);
            void load().then(async () => {
              const d = await loadOnboardingDirectory();
              setDir(d);
              setDetailCase(d.cases.find((x) => x.id === caseId) ?? null);
            });
          }
        }}
      />
    </div>
  );
}

function ReportCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm">
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
