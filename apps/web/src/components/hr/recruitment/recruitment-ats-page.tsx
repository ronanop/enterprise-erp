"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Briefcase,
  CalendarClock,
  ClipboardList,
  Download,
  FileCheck2,
  LayoutDashboard,
  Plus,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";

import { CandidateDrawer } from "@/components/hr/recruitment/candidate-drawer";
import { InterviewDrawer } from "@/components/hr/recruitment/interview-drawer";
import { JobOpeningDrawer } from "@/components/hr/recruitment/job-opening-drawer";
import { OfferDrawer } from "@/components/hr/recruitment/offer-drawer";
import { PipelineKanban } from "@/components/hr/recruitment/pipeline-kanban";
import {
  HrAuthBanner,
  HrEmptyState,
  HrStatusBadge,
  HrToolbar,
  HrUnderlineTabs,
  type HrTabItem,
} from "@/components/hr/hr-primitives";
import { SetupDrawer, SetupField, SetupTextarea } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsPagination, EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  addDocument,
  applyCandidateToJob,
  computeAtsStats,
  createCandidate,
  createJob,
  departmentHiring,
  downloadTextFile,
  exportCandidatesCsv,
  exportJobsCsv,
  filterApplications,
  filterCandidates,
  filterJobs,
  generateOffer,
  importCandidatesCsv,
  listAtsAudit,
  loadAtsDirectory,
  moveApplicationStage,
  recruiterPerformance,
  scheduleInterview,
  sourcePerformance,
  updateOfferStatus,
  updateJob,
  type AtsDirectory,
} from "@/services/recruitment-ats-service";
import type {
  AtsFilters,
  CreateCandidateInput,
  CreateJobInput,
  JobOpening,
  PipelineStage,
} from "@/types/recruitment-ats";
import {
  emptyAtsFilters,
  JOB_STATUS_LABELS,
  OFFER_STATUS_LABELS,
  PIPELINE_STAGES,
  SOURCE_LABELS,
} from "@/types/recruitment-ats";

const PAGE = 10;

type Tab =
  | "dashboard"
  | "jobs"
  | "candidates"
  | "pipeline"
  | "interviews"
  | "offers"
  | "documents"
  | "reports"
  | "audit";

export function RecruitmentAtsPage() {
  const [dir, setDir] = useState<AtsDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [filters, setFilters] = useState<AtsFilters>(() => emptyAtsFilters());
  const [page, setPage] = useState(1);
  const [jobOpen, setJobOpen] = useState(false);
  const [editJob, setEditJob] = useState<JobOpening | null>(null);
  const [candOpen, setCandOpen] = useState(false);
  const [intOpen, setIntOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDir(await loadAtsDirectory());
    } catch {
      toast("Failed to load recruitment data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => setPage(1), [filters, tab]);

  const stats = useMemo(() => (dir ? computeAtsStats(dir) : null), [dir]);
  const jobs = useMemo(() => filterJobs(dir?.jobs ?? [], filters), [dir, filters]);
  const candidates = useMemo(
    () => filterCandidates(dir?.candidates ?? [], filters),
    [dir, filters],
  );
  const applications = useMemo(
    () =>
      filterApplications(dir?.applications ?? [], filters, dir?.candidates ?? [], dir?.jobs ?? []),
    [dir, filters],
  );
  const audit = useMemo(() => listAtsAudit(), [dir, tab]);
  const authBlocked = !isAuthenticated() && !loading && !(dir?.jobs.length || dir?.candidates.length);

  const pageJobs = useMemo(() => {
    const s = (page - 1) * PAGE;
    return jobs.slice(s, s + PAGE);
  }, [jobs, page]);
  const pageCands = useMemo(() => {
    const s = (page - 1) * PAGE;
    return candidates.slice(s, s + PAGE);
  }, [candidates, page]);

  async function handleCreateJob(input: CreateJobInput) {
    if (editJob) {
      await updateJob(editJob.id, input);
      toast("Job updated");
      setEditJob(null);
    } else {
      await createJob(input);
      toast("Job created");
    }
    void load();
  }

  async function handleCreateCandidate(input: CreateCandidateInput, jobId?: string) {
    try {
      const cand = await createCandidate(input);
      if (jobId) await applyCandidateToJob(cand.id, jobId, "applied");
      if (input.resumeName) addDocument(cand.id, "resume", input.resumeName);
      toast(`Candidate ${cand.candidateCode} added`);
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Recruitment"
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Button size="sm" className="cursor-pointer" onClick={() => { setEditJob(null); setJobOpen(true); }}>
              <Plus className="size-3.5" />
              Create Job Opening
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setCandOpen(true)}>
              <UserPlus className="size-3.5" />
              Add Candidate
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setImportOpen(true)}>
              <Upload className="size-3.5" />
              Import Candidates
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                downloadTextFile(
                  `recruitment-${new Date().toISOString().slice(0, 10)}.csv`,
                  tab === "candidates" ? exportCandidatesCsv(candidates) : exportJobsCsv(jobs),
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {[
          { label: "Open Positions", value: stats?.openPositions ?? 0 },
          { label: "Applications", value: stats?.applications ?? 0 },
          { label: "Shortlisted", value: stats?.shortlisted ?? 0 },
          { label: "Interview Scheduled", value: stats?.interviewScheduled ?? 0 },
          { label: "Offers Sent", value: stats?.offersSent ?? 0 },
          { label: "Offers Accepted", value: stats?.offersAccepted ?? 0 },
          { label: "Positions Filled", value: stats?.positionsFilled ?? 0 },
          { label: "Avg Time to Hire", value: `${stats?.avgTimeToHire ?? 0}d` },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-border/70 bg-card px-3 py-3 shadow-sm transition-shadow duration-200 hover:shadow-md"
          >
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {k.label}
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight">{k.value}</p>
          </div>
        ))}
      </div>

      <HrUnderlineTabs
        size="sm"
        tabs={
          [
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "jobs", label: "Job Openings", icon: Briefcase },
            { id: "candidates", label: "Candidates", icon: Users },
            { id: "pipeline", label: "Pipeline", icon: ClipboardList },
            { id: "interviews", label: "Interviews", icon: CalendarClock },
            { id: "offers", label: "Offers", icon: FileCheck2 },
            { id: "documents", label: "Documents", icon: FileCheck2 },
            { id: "reports", label: "Reports", icon: BarChart3 },
            { id: "audit", label: "Audit", icon: ClipboardList },
          ] satisfies HrTabItem[]
        }
        value={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      {loading && !dir ? <EmsSkeleton /> : null}

      <div className="flex flex-wrap gap-2">
        <Input
          value={filters.query}
          onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          placeholder="Search…"
          className="max-w-xs"
        />
        {tab === "pipeline" ? (
          <select
            className="h-8 cursor-pointer rounded-lg border border-input bg-transparent px-2 text-xs"
            value={filters.stage}
            onChange={(e) => setFilters((f) => ({ ...f, stage: e.target.value }))}
          >
            <option value="all">All stages</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {tab === "dashboard" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pipeline snapshot
            </p>
            <div className="space-y-2">
              {PIPELINE_STAGES.map((s) => {
                const n = (dir?.applications ?? []).filter((a) => a.stage === s.id).length;
                const max = Math.max(1, dir?.applications.length ?? 1);
                return (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <span className="w-36 shrink-0 text-muted-foreground">{s.label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${(n / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right font-medium">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quick actions
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <QuickAction icon={Briefcase} label="Create job" onClick={() => setJobOpen(true)} />
              <QuickAction icon={UserPlus} label="Add candidate" onClick={() => setCandOpen(true)} />
              <QuickAction icon={CalendarClock} label="Schedule interview" onClick={() => setIntOpen(true)} />
              <QuickAction icon={FileCheck2} label="Generate offer" onClick={() => setOfferOpen(true)} />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              After offer acceptance, continue in{" "}
              <Link href="/hr/onboarding" className="cursor-pointer text-primary underline">
                Onboarding
              </Link>
              .
            </p>
          </div>
        </div>
      ) : null}

      {tab === "jobs" ? (
        <EntityTable
          emptyTitle="No job openings"
          emptyAction={
            <Button size="sm" className="cursor-pointer" onClick={() => setJobOpen(true)}>
              Create Job
            </Button>
          }
          headers={["Job ID", "Title", "Department", "Positions", "Status", "Priority", ""]}
          rows={pageJobs.map((j) => [
            j.jobCode,
            j.title,
            j.department,
            `${j.filled}/${j.positions}`,
            <HrStatusBadge key="s" status={JOB_STATUS_LABELS[j.status]} />,
            j.priority,
            <Button
              key="e"
              type="button"
              size="sm"
              variant="outline"
              className="h-7 cursor-pointer"
              onClick={() => {
                setEditJob(j);
                setJobOpen(true);
              }}
            >
              Edit
            </Button>,
          ])}
          page={page}
          total={jobs.length}
          onPageChange={setPage}
        />
      ) : null}

      {tab === "candidates" ? (
        <EntityTable
          emptyTitle="No candidates"
          emptyAction={
            <Button size="sm" className="cursor-pointer" onClick={() => setCandOpen(true)}>
              Add Candidate
            </Button>
          }
          headers={["ID", "Name", "Email", "Source", "Exp", "Expected", ""]}
          rows={pageCands.map((c) => [
            <span key="id" className="flex items-center gap-2">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={selected.has(c.id)}
                onChange={(e) => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(c.id);
                    else next.delete(c.id);
                    return next;
                  });
                }}
              />
              {c.candidateCode}
            </span>,
            c.fullName,
            c.email,
            SOURCE_LABELS[c.source] ?? c.source,
            `${c.experienceYears}y`,
            c.expectedSalary ? `₹${c.expectedSalary.toLocaleString("en-IN")}` : "—",
            c.resumeName || "—",
          ])}
          page={page}
          total={candidates.length}
          onPageChange={setPage}
          bulk={
            selected.size > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                  toast(`${selected.size} candidates selected — use Pipeline to advance`);
                }}
              >
                Bulk ({selected.size})
              </Button>
            ) : null
          }
        />
      ) : null}

      {tab === "pipeline" ? (
        <PipelineKanban
          applications={applications}
          candidates={dir?.candidates ?? []}
          jobs={dir?.jobs ?? []}
          onMove={(id, stage: PipelineStage) => {
            void (async () => {
              await moveApplicationStage(id, stage);
              toast(`Moved to ${PIPELINE_STAGES.find((s) => s.id === stage)?.label ?? stage}`);
              await load();
            })();
          }}
        />
      ) : null}

      {tab === "interviews" ? (
        <div className="space-y-3">
          <Button size="sm" className="cursor-pointer" onClick={() => setIntOpen(true)}>
            <CalendarClock className="size-3.5" />
            Schedule Interview
          </Button>
          <EntityTable
            emptyTitle="No interviews"
            headers={["Code", "Candidate", "Type", "When", "Mode", "Interviewer", "Status"]}
            rows={(dir?.interviews ?? []).map((i) => {
              const c = dir?.candidates.find((x) => x.id === i.candidateId);
              return [
                i.interviewCode,
                c?.fullName ?? "—",
                i.interviewType,
                `${i.date} ${i.time}`,
                i.mode,
                i.interviewer || "—",
                <HrStatusBadge key="st" status={i.status} />,
              ];
            })}
            page={1}
            total={dir?.interviews.length ?? 0}
            onPageChange={() => undefined}
          />
        </div>
      ) : null}

      {tab === "offers" ? (
        <div className="space-y-3">
          <Button size="sm" className="cursor-pointer" onClick={() => setOfferOpen(true)}>
            <FileCheck2 className="size-3.5" />
            Generate Offer
          </Button>
          <EntityTable
            emptyTitle="No offers"
            headers={["Offer", "Candidate", "CTC", "Join", "Status", ""]}
            rows={(dir?.offers ?? []).map((o) => {
              const c = dir?.candidates.find((x) => x.id === o.candidateId);
              return [
                o.offerCode,
                c?.fullName ?? "—",
                o.ctc ? `₹${o.ctc.toLocaleString("en-IN")}` : "—",
                o.joiningDate || "—",
                <HrStatusBadge key="s" status={OFFER_STATUS_LABELS[o.status]} />,
                <div key="a" className="flex gap-1">
                  {o.status === "sent" ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 cursor-pointer"
                        onClick={() => {
                          void (async () => {
                            await updateOfferStatus(o.id, "accepted");
                            toast("Offer accepted — start Onboarding");
                            await load();
                          })();
                        }}
                      >
                        Accept
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 cursor-pointer"
                        onClick={() => {
                          void (async () => {
                            await updateOfferStatus(o.id, "rejected");
                            await load();
                          })();
                        }}
                      >
                        Reject
                      </Button>
                    </>
                  ) : o.status === "accepted" ? (
                    <Link
                      href="/hr/onboarding"
                      className="inline-flex h-7 cursor-pointer items-center rounded-md border px-2 text-[11px] hover:bg-muted"
                    >
                      Onboard
                    </Link>
                  ) : null}
                </div>,
              ];
            })}
            page={1}
            total={dir?.offers.length ?? 0}
            onPageChange={() => undefined}
          />
        </div>
      ) : null}

      {tab === "documents" ? (
        <EntityTable
          emptyTitle="No documents"
          headers={["File", "Candidate", "Type", "Uploaded"]}
          rows={(dir?.documents ?? []).map((d) => {
            const c = dir?.candidates.find((x) => x.id === d.candidateId);
            return [d.fileName, c?.fullName ?? "—", d.kind, new Date(d.uploadedAt).toLocaleString()];
          })}
          page={1}
          total={dir?.documents.length ?? 0}
          onPageChange={() => undefined}
        />
      ) : null}

      {tab === "reports" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <ReportBlock title="Offer Acceptance Rate" value={`${stats?.offerAcceptanceRate ?? 0}%`} />
          <ReportBlock title="Avg Time to Hire" value={`${stats?.avgTimeToHire ?? 0} days`} />
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Source performance</p>
            <ul className="space-y-1 text-xs">
              {sourcePerformance(dir ?? emptyDir()).map((r) => (
                <li key={r.source} className="flex justify-between">
                  <span>{SOURCE_LABELS[r.source as keyof typeof SOURCE_LABELS] ?? r.source}</span>
                  <span className="font-medium">{r.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Recruiter performance</p>
            <ul className="space-y-1 text-xs">
              {recruiterPerformance(dir ?? emptyDir()).map((r) => (
                <li key={r.recruiter} className="flex justify-between">
                  <span>{r.recruiter}</span>
                  <span className="font-medium">{r.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-4 md:col-span-2">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Department hiring</p>
            <ul className="space-y-1 text-xs">
              {departmentHiring(dir ?? emptyDir()).map((r) => (
                <li key={r.department} className="flex justify-between">
                  <span>{r.department}</span>
                  <span className="font-medium">{r.filled} filled</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {tab === "audit" ? (
        <EntityTable
          emptyTitle="No audit entries"
          headers={["When", "Action", "Detail", "Actor"]}
          rows={audit.slice(0, 100).map((a) => [
            new Date(a.at).toLocaleString(),
            a.action,
            a.detail,
            a.actor,
          ])}
          page={1}
          total={audit.length}
          onPageChange={() => undefined}
        />
      ) : null}

      <JobOpeningDrawer
        key={editJob?.id ?? "new-job"}
        open={jobOpen}
        initial={editJob}
        onClose={() => {
          setJobOpen(false);
          setEditJob(null);
        }}
        onSubmit={handleCreateJob}
      />
      <CandidateDrawer
        open={candOpen}
        onClose={() => setCandOpen(false)}
        jobs={dir?.jobs ?? []}
        onSubmit={handleCreateCandidate}
      />
      <InterviewDrawer
        open={intOpen}
        onClose={() => setIntOpen(false)}
        candidates={dir?.candidates ?? []}
        jobs={dir?.jobs ?? []}
        applications={dir?.applications ?? []}
        onSubmit={(input) => {
          void (async () => {
            await scheduleInterview(input);
            toast("Interview scheduled");
            await load();
          })();
        }}
      />
      <OfferDrawer
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        candidates={dir?.candidates ?? []}
        jobs={dir?.jobs ?? []}
        applications={dir?.applications ?? []}
        onSubmit={(input) => {
          void (async () => {
            await generateOffer(input);
            toast("Offer generated");
            await load();
          })();
        }}
      />

      <SetupDrawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Candidates"
        description="CSV: Name, Email, Phone, Source"
        footer={
          <Button
            type="button"
            className="cursor-pointer"
            onClick={() => {
              void importCandidatesCsv(importText).then((res) => {
                toast(`Imported ${res.created}${res.errors.length ? ` · ${res.errors.length} errors` : ""}`);
                setImportOpen(false);
                setImportText("");
                void load();
              });
            }}
          >
            Import
          </Button>
        }
      >
        <SetupField label="CSV content">
          <SetupTextarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={8}
            placeholder={"Name,Email,Phone,Source\nJane Doe,jane@ex.com,9999999999,linkedin"}
          />
        </SetupField>
      </SetupDrawer>
    </div>
  );
}

function emptyDir(): AtsDirectory {
  return {
    jobs: [],
    candidates: [],
    applications: [],
    interviews: [],
    offers: [],
    documents: [],
    departments: [],
    apiPartial: false,
  };
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Briefcase;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-left text-xs font-medium transition-colors duration-200 hover:bg-muted"
    >
      <Icon className="size-3.5 text-primary" />
      {label}
    </button>
  );
}

function ReportBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-4 py-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function EntityTable({
  headers,
  rows,
  emptyTitle,
  emptyAction,
  page,
  total,
  onPageChange,
  bulk,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  emptyTitle: string;
  emptyAction?: React.ReactNode;
  page: number;
  total: number;
  onPageChange: (p: number) => void;
  bulk?: React.ReactNode;
}) {
  if (rows.length === 0) {
    return <HrEmptyState title={emptyTitle} action={emptyAction} />;
  }
  return (
    <div className="space-y-2">
      {bulk}
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border/70 bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              {headers.map((h) => (
                <th key={h || "a"} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border/50 transition-colors duration-150 hover:bg-muted/30"
              >
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2 align-middle">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {total > PAGE ? (
          <EmsPagination page={page} pageSize={PAGE} total={total} onPageChange={onPageChange} />
        ) : null}
      </div>
    </div>
  );
}
