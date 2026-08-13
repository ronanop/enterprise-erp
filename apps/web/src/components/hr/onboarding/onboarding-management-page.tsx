"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  Eye,
  FolderOpen,
  Mail,
  Plus,
  Send,
  UserPlus,
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
  HrToolbar,
} from "@/components/hr/hr-primitives";
import { SetupDrawer } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsPagination, EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  activateOnboardingEmployee,
  approveCandidateReview,
  completeOnboarding,
  computeOnboardingStats,
  downloadTextFile,
  exportOnboardingCsv,
  filterOnboardingCases,
  joiningThisWeek,
  listOnboardingAudit,
  loadOnboardingDirectory,
  sendInvitation,
  startOnboarding,
  updateChecklistItem,
  verifyDocument,
  type OnboardingDirectory,
} from "@/services/onboarding-management-service";
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
import { resolveOnboardingDisplayStatus } from "@/lib/onboarding-display-status";

const PAGE = 10;

type Tab = "cases" | "checklist" | "documents" | "reports" | "audit";

export function OnboardingManagementPage() {
  const [dir, setDir] = useState<OnboardingDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("cases");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<OnboardingFilters>(() => emptyOnboardingFilters());
  const [page, setPage] = useState(1);
  const [startOpen, setStartOpen] = useState(false);
  const [inviteCase, setInviteCase] = useState<OnboardingCase | null>(null);
  const [detailCase, setDetailCase] = useState<OnboardingCase | null>(null);
  const [docsCase, setDocsCase] = useState<OnboardingCase | null>(null);
  const [previewDoc, setPreviewDoc] = useState<OnboardingDocument | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadOnboardingDirectory();
      setDir(next);
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
          { label: "Pending Join", value: stats.pendingJoin },
          { label: "Joined Today", value: stats.joinedToday },
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
            ["checklist", "Checklist Board"],
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
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1 space-y-1 sm:max-w-sm">
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Search
              </span>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search candidate, case, offer, EMP id…"
                className="h-8"
              />
            </div>
            <div className="w-[9.5rem] space-y-1">
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Status
              </span>
              <FilterSelect
                value={filters.status}
                onChange={(status) => setFilters((f) => ({ ...f, status }))}
                options={[
                  { value: "all", label: "All" },
                  ...Object.entries(ONBOARDING_STATUS_LABELS)
                    .filter(([k]) => k !== "overdue")
                    .map(([k, v]) => ({
                      value: k,
                      label: v,
                    })),
                ]}
              />
            </div>
            <div className="w-[9.5rem] space-y-1">
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Department
              </span>
              <FilterSelect
                value={filters.department}
                onChange={(department) => setFilters((f) => ({ ...f, department }))}
                options={[
                  { value: "all", label: "All" },
                  ...(dir?.departments ?? []).map((d) => ({ value: d, label: d })),
                ]}
              />
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
                        <HrStatusBadge status={resolveOnboardingDisplayStatus(row.status, row.joiningDate)} />
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
            .filter((c) => c.status === "joined" && c.checklist.length > 0)
            .slice(0, 8)
            .map((c) => (
              <div key={c.id} className="rounded-xl border border-border/70 bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{c.candidateName}</p>
                    <p className="text-[10px] text-muted-foreground">{c.caseCode}</p>
                  </div>
                  <HrStatusBadge status={resolveOnboardingDisplayStatus(c.status, c.joiningDate)} />
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
            <HrEmptyState title="No Post-Join Checklists" description="Checklists appear after onboarding is completed and the employee is created." />
          ) : null}
        </div>
      ) : null}

      {tab === "documents" ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            One folder per candidate. Open{" "}
            <span className="font-medium text-foreground">View</span> to see every uploaded file,
            then preview, verify, or reject inside the directory.
          </p>
          {(dir?.cases ?? [])
            .filter((c) => c.portal.documents.length > 0)
            .map((c) => {
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
                    className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded-md text-left transition-colors duration-200 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 px-1 py-0.5 -mx-1"
                    onClick={() => setDocsCase(c)}
                  >
                    <FolderOpen className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {c.candidateName} documents
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {docs.length} file{docs.length === 1 ? "" : "s"}
                        {verified ? ` · ${verified} verified` : ""}
                        {pending ? ` · ${pending} pending` : ""}
                        {rejected ? ` · ${rejected} rejected` : ""}
                        {c.department ? ` · ${c.department}` : ""}
                      </p>
                    </div>
                  </button>
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
              );
            })}
          {(dir?.cases ?? []).every((c) => c.portal.documents.length === 0) ? (
            <HrEmptyState
              title="No Documents Yet"
              description="Documents appear after candidates upload via the secure portal."
            />
          ) : null}
        </div>
      ) : null}

      {tab === "reports" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <ReportCard title="Completion Rate" value={`${stats.completionRate}%`} />
          <ReportCard title="Total Cases" value={String(stats.total)} />
          <ReportCard title="Joining This Week" value={String(weekJoiners.length)} />
          <ReportCard title="Overdue Tasks" value={String(stats.overdue)} />
          <div className="rounded-xl border border-border/70 bg-card p-4 md:col-span-2">
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Joining This Week
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
              Pipeline: Start onboarding → Candidate portal → HR verification → Employee created →
              Workforce assignment in{" "}
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
        open={Boolean(docsCase)}
        onClose={() => setDocsCase(null)}
        title={docsCase ? `${docsCase.candidateName} documents` : "Documents"}
        description={
          docsCase
            ? `${docsCase.portal.documents.length} file(s) · preview, verify, or reject each upload`
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
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Click a file name or View to preview. Files uploaded before this update may need to be
              re-uploaded from the candidate portal.
            </p>
            {docsCase.portal.documents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No documents in this directory.</p>
            ) : (
              docsCase.portal.documents.map((d) => (
                <OnboardingDocumentRow
                  key={d.id}
                  doc={d}
                  subtitle={d.kind.replace(/_/g, " ")}
                  onView={setPreviewDoc}
                  onVerify={() => {
                    verifyDocument(docsCase.id, d.id, "verified");
                    toast("Document verified");
                    void load();
                  }}
                  onReject={() => {
                    verifyDocument(docsCase.id, d.id, "rejected");
                    toast("Document rejected");
                    void load();
                  }}
                />
              ))
            )}
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
        onApprove={(caseId) => {
          try {
            approveCandidateReview(caseId);
            toast("Candidate submission approved");
            void load().then(async () => {
              const d = await loadOnboardingDirectory();
              setDir(d);
              setDetailCase(d.cases.find((x) => x.id === caseId) ?? null);
            });
          } catch (e) {
            toast(e instanceof Error ? e.message : "Approval failed", "error");
          }
        }}
        onComplete={(caseId) => {
          void completeOnboarding(caseId)
            .then((completed) => {
              if (completed) {
                const msg =
                  completed.status === "pending_join"
                    ? `Profile created (${completed.employeeId}) — activates on ${completed.joiningDate}`
                    : `Employee ${completed.employeeId} activated — complete assignments in Workforce`;
                toast(msg);
                void load().then(async () => {
                  const d = await loadOnboardingDirectory();
                  setDir(d);
                  setDetailCase(d.cases.find((x) => x.id === caseId) ?? null);
                });
              }
            })
            .catch((e) => {
              toast(e instanceof Error ? e.message : "Completion failed", "error");
            });
        }}
        onActivate={(caseId) => {
          void activateOnboardingEmployee(caseId)
            .then((activated) => {
              if (activated) {
                toast(`Employee ${activated.employeeId} is now active in Workforce`);
                void load().then(async () => {
                  const d = await loadOnboardingDirectory();
                  setDir(d);
                  setDetailCase(d.cases.find((x) => x.id === caseId) ?? null);
                });
              }
            })
            .catch((e) => {
              toast(e instanceof Error ? e.message : "Activation failed", "error");
            });
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
