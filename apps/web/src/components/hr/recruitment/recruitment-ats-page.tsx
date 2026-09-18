"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  CalendarClock,
  FileCheck2,
  FolderOpen,
  LayoutDashboard,
  Search,
  Users,
} from "lucide-react";

import { CandidateDrawer } from "@/components/hr/recruitment/candidate-drawer";
import { CandidateViewDrawer } from "@/components/hr/recruitment/candidate-view-drawer";
import { RecruitmentOverviewDashboard } from "@/components/hr/recruitment/dashboard/recruitment-overview-dashboard";
import { InterviewDrawer } from "@/components/hr/recruitment/interview-drawer";
import { InterviewOutcomeDrawer } from "@/components/hr/recruitment/interview-outcome-drawer";
import { JobOpeningDrawer } from "@/components/hr/recruitment/job-opening-drawer";
import { JobOpeningsPanel } from "@/components/hr/recruitment/job-openings-panel";
import { CandidatesPanel } from "@/components/hr/recruitment/candidates-panel";
import { InterviewsPanel } from "@/components/hr/recruitment/interviews-panel";
import { OfferDrawer } from "@/components/hr/recruitment/offer-drawer";
import { OffersPanel } from "@/components/hr/recruitment/offers-panel";
import { DocumentsPanel } from "@/components/hr/recruitment/documents-panel";
import { PipelineKanban } from "@/components/hr/recruitment/pipeline-kanban";
import {
  HrEmptyState,
  HrStatusBadge,
  HrUnderlineTabs,
  type HrTabItem,
} from "@/components/hr/hr-primitives";
import { SetupDrawer, SetupField, SetupTextarea } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsPagination, EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import {
  addDocument,
  advanceApplication,
  applyCandidateToJob,
  createCandidate,
  createJob,
  downloadTextFile,
  exportCandidatesCsv,
  exportJobsCsv,
  filterApplications,
  filterCandidates,
  filterJobs,
  generateOffer,
  importCandidatesCsv,
  loadAtsDirectory,
  markApplicationBackedOut,
  markApplicationHired,
  moveApplicationStage,
  recordInterviewOutcome,
  rejectApplication,
  scheduleInterview,
  updateApplicationNotes,
  updateCandidate,
  updateDocumentStatus,
  updateOfferStatus,
  updateJob,
  type AtsDirectory,
} from "@/services/recruitment-ats-service";
import {
  loadOnboardingDirectory,
  sendInvitation,
  startOnboarding,
} from "@/services/onboarding-management-service";
import { listEntityOptions } from "@/services/hr-setup-service";
import type {
  AtsCandidate,
  AtsFilters,
  AtsInterview,
  AtsOffer,
  CreateCandidateInput,
  CreateJobInput,
  JobOpening,
  PipelineApplication,
} from "@/types/recruitment-ats";
import {
  emptyAtsFilters,
  PIPELINE_STAGES,
} from "@/types/recruitment-ats";

const PAGE = 10;

type Tab =
  | "dashboard"
  | "jobs"
  | "candidates"
  | "pipeline"
  | "interviews"
  | "offers"
  | "documents";

export function RecruitmentAtsPage() {
  const router = useRouter();
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
  const [outcomeInterview, setOutcomeInterview] = useState<AtsInterview | null>(null);
  const [viewCandidate, setViewCandidate] = useState<AtsCandidate | null>(null);
  const [editCandidate, setEditCandidate] = useState<AtsCandidate | null>(null);
  const [onboardingOfferId, setOnboardingOfferId] = useState<string | null>(null);

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
  const authBlocked = !isAuthenticated() && !loading && !(dir?.jobs.length || dir?.candidates.length);

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
      if (editCandidate) {
        await updateCandidate(editCandidate.id, input);
        toast(`Candidate ${editCandidate.candidateCode} updated`);
        setEditCandidate(null);
        void load();
        return;
      }
      const cand = await createCandidate(input);
      if (jobId) await applyCandidateToJob(cand.id, jobId, "sourced");
      if (input.resumeName) addDocument(cand.id, "resume", input.resumeName);
      toast(`Candidate ${cand.candidateCode} added`);
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }

  function primaryAppFor(candidateId: string): PipelineApplication | null {
    const apps = dir?.applications ?? [];
    const active = apps.find((a) => a.candidateId === candidateId && a.status === "active");
    if (active) return active;
    return apps.find((a) => a.candidateId === candidateId) ?? null;
  }

  function exportCurrent() {
    downloadTextFile(
      `recruitment-${new Date().toISOString().slice(0, 10)}.csv`,
      tab === "candidates" ? exportCandidatesCsv(candidates) : exportJobsCsv(jobs),
    );
    toast("Export downloaded");
  }

  function openCreateJob() {
    setEditJob(null);
    setJobOpen(true);
  }

  function openAddCandidate() {
    setEditCandidate(null);
    setCandOpen(true);
  }

  const applicationsByJob = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of dir?.applications ?? []) {
      map.set(a.jobId, (map.get(a.jobId) ?? 0) + 1);
    }
    return map;
  }, [dir?.applications]);

  const moduleTabs = useMemo(
    () =>
      [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        {
          id: "jobs",
          label: "Job Openings",
          icon: Briefcase,
          badge: (dir?.jobs ?? []).filter((j) => j.status === "open").length,
        },
        {
          id: "candidates",
          label: "Candidates",
          icon: Users,
          badge: dir?.candidates.length ?? 0,
        },
        { id: "pipeline", label: "Pipeline", icon: BarChart3 },
        {
          id: "interviews",
          label: "Interviews",
          icon: CalendarClock,
          badge: (dir?.interviews ?? []).filter((i) => i.status === "scheduled").length,
        },
        {
          id: "offers",
          label: "Offers",
          icon: FileCheck2,
          badge: dir?.offers.length ?? 0,
        },
        { id: "documents", label: "Documents", icon: FolderOpen },
      ] satisfies HrTabItem[],
    [dir],
  );

  return (
    <div className="space-y-5">
      <SetupToastHost />

      <RecruitmentOverviewDashboard
        dir={dir}
        loading={loading}
        authBlocked={authBlocked}
        showHome={tab === "dashboard"}
        handlers={{
          onCreateJob: openCreateJob,
          onAddCandidate: openAddCandidate,
          onImport: () => setImportOpen(true),
          onExport: exportCurrent,
          onScheduleInterview: () => setIntOpen(true),
          onGenerateOffer: () => setOfferOpen(true),
          onViewJobs: () => setTab("jobs"),
          onViewCandidates: () => setTab("candidates"),
          onViewInterviews: () => setTab("interviews"),
          onViewOffers: () => setTab("offers"),
          onViewPipeline: (stage) => {
            if (stage) setFilters((f) => ({ ...f, stage }));
            setTab("pipeline");
          },
          onOpenJob: (job) => {
            setEditJob(job);
            setJobOpen(true);
          },
          onEditJob: (job) => {
            setEditJob(job);
            setJobOpen(true);
          },
          onOpenCandidate: (candidate) => setViewCandidate(candidate),
          onEditCandidate: (candidate) => {
            setEditCandidate(candidate);
            setCandOpen(true);
          },
          onOpenInterview: (interview) => setOutcomeInterview(interview),
        }}
        tabsSlot={
          <HrUnderlineTabs
            size="sm"
            variant="pills"
            tabs={moduleTabs}
            value={tab}
            onChange={(id) => setTab(id as Tab)}
          />
        }
      >
        {tab !== "dashboard" && loading && !dir ? <EmsSkeleton /> : null}

        {tab === "jobs" ? (
          <JobOpeningsPanel
            jobs={dir?.jobs ?? []}
            applicationsByJob={applicationsByJob}
            onCreate={openCreateJob}
            onView={(job) => {
              setEditJob(job);
              setJobOpen(true);
            }}
            onEdit={(job) => {
              setEditJob(job);
              setJobOpen(true);
            }}
          />
        ) : null}

        {tab === "candidates" ? (
          <CandidatesPanel
            candidates={dir?.candidates ?? []}
            jobs={dir?.jobs ?? []}
            applications={dir?.applications ?? []}
            onAdd={openAddCandidate}
            onView={(c) => setViewCandidate(c)}
            onEdit={(c) => {
              setEditCandidate(c);
              setCandOpen(true);
            }}
            onChangeStage={(applicationId, stage) => {
              void (async () => {
                try {
                  await moveApplicationStage(applicationId, stage);
                  toast(
                    `Moved to ${PIPELINE_STAGES.find((s) => s.id === stage)?.label ?? stage}`,
                  );
                  await load();
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Stage update failed", "error");
                }
              })();
            }}
          />
        ) : null}

        {tab === "interviews" ? (
          <InterviewsPanel
            interviews={dir?.interviews ?? []}
            candidates={dir?.candidates ?? []}
            jobs={dir?.jobs ?? []}
            onSchedule={() => setIntOpen(true)}
            onOutcome={(interview) => setOutcomeInterview(interview)}
          />
        ) : null}

        {tab === "pipeline" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[#EEEFF3] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[#9CA3AF]" />
                <Input
                  value={filters.query}
                  onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                  placeholder="Search…"
                  className="h-9 max-w-md rounded-full border-[#E5E7EB] bg-white pl-9 text-[13px]"
                />
              </div>
              <select
                className="h-9 cursor-pointer rounded-full border border-[#E5E7EB] bg-white px-3 text-xs"
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
            </div>
            <PipelineKanban
              applications={applications}
              candidates={dir?.candidates ?? []}
              jobs={dir?.jobs ?? []}
              interviews={dir?.interviews ?? []}
              onAddCandidate={openAddCandidate}
              onViewProfile={(c) => setViewCandidate(c)}
              onMoveStage={(applicationId, stage) => {
                void (async () => {
                  try {
                    await moveApplicationStage(applicationId, stage);
                    toast(
                      `Moved to ${PIPELINE_STAGES.find((s) => s.id === stage)?.label ?? stage}`,
                    );
                    await load();
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Stage update failed", "error");
                  }
                })();
              }}
              onAdvance={(id) => {
                void (async () => {
                  try {
                    await advanceApplication(id);
                    toast("Advanced to next stage");
                    await load();
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Advance failed", "error");
                  }
                })();
              }}
              onReject={(id, reason) => {
                void (async () => {
                  try {
                    await rejectApplication(id, reason);
                    toast("Candidate rejected");
                    await load();
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Reject failed", "error");
                  }
                })();
              }}
              onMarkHired={(id) => {
                void (async () => {
                  try {
                    await markApplicationHired(id);
                    toast("Marked hired");
                    await load();
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Mark hired failed", "error");
                  }
                })();
              }}
              onMarkBackedOut={(id, reason) => {
                void (async () => {
                  try {
                    await markApplicationBackedOut(id, reason);
                    toast("Marked backed out");
                    await load();
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Back out failed", "error");
                  }
                })();
              }}
            />
          </div>
        ) : null}

      {tab === "offers" ? (
        <OffersPanel
          offers={dir?.offers ?? []}
          candidates={dir?.candidates ?? []}
          jobs={dir?.jobs ?? []}
          onGenerate={() => setOfferOpen(true)}
          onSend={(id) => {
            void (async () => {
              await updateOfferStatus(id, "sent");
              toast("Offer sent");
              await load();
            })();
          }}
          onAccept={(id) => {
            void (async () => {
              await updateOfferStatus(id, "accepted");
              toast("Offer accepted — ready to onboard");
              await load();
            })();
          }}
          onDecline={(id) => {
            void (async () => {
              await updateOfferStatus(id, "rejected");
              await load();
            })();
          }}
          onboardingOfferId={onboardingOfferId}
          onOnboard={(offer: AtsOffer) => {
            void (async () => {
              setOnboardingOfferId(offer.id);
              try {
                const cand = dir?.candidates.find((c) => c.id === offer.candidateId);
                const job = dir?.jobs.find((j) => j.id === offer.jobId);
                if (!cand) {
                  toast("Candidate not found for this offer", "error");
                  return;
                }

                const existing = await loadOnboardingDirectory();
                const already = existing.cases.find(
                  (c) =>
                    c.offerId === offer.id ||
                    (c.candidateId === offer.candidateId &&
                      c.status !== "cancelled" &&
                      c.status !== "completed"),
                );
                if (already) {
                  toast(`Onboarding already started (${already.caseCode})`);
                  router.push("/hr/onboarding");
                  return;
                }

                const entities = await listEntityOptions();
                const entity = entities[0];
                const employmentRaw = String(
                  offer.employmentType || job?.employmentType || "full_time",
                );
                const employmentType =
                  employmentRaw === "full_time"
                    ? "permanent"
                    : employmentRaw === "intern"
                      ? "intern"
                      : employmentRaw === "contract"
                        ? "contract"
                        : employmentRaw === "part_time"
                          ? "part_time"
                          : employmentRaw || "permanent";

                const created = await startOnboarding({
                  candidateId: cand.id,
                  candidateName: cand.fullName,
                  candidateEmail: cand.email,
                  candidatePhone: cand.phone,
                  joiningDate: offer.joiningDate,
                  entityId: entity?.value || "",
                  entityName: entity?.label || "",
                  department: offer.department || job?.department || "",
                  designation: job?.designation || job?.title || "",
                  reportingManager:
                    offer.reportingManager || job?.hiringManager || "",
                  branch: job?.branch || "",
                  employmentType,
                  invitationExpiryDays: 14,
                  employeeIdMode: "auto",
                  offerId: offer.id,
                  offerCode: offer.offerCode,
                });

                try {
                  await sendInvitation(created.id, "email", 14);
                } catch {
                  /* invitation optional if email channel fails */
                }

                if (offer.applicationId) {
                  try {
                    await markApplicationHired(offer.applicationId);
                  } catch {
                    /* pipeline hire is best-effort */
                  }
                }

                toast(`Onboarding ${created.caseCode} started for ${cand.fullName}`);
                router.push("/hr/onboarding");
              } catch (e) {
                toast(
                  e instanceof Error ? e.message : "Could not start onboarding",
                  "error",
                );
              } finally {
                setOnboardingOfferId(null);
              }
            })();
          }}
        />
      ) : null}

      {tab === "documents" ? (
        <DocumentsPanel
          documents={dir?.documents ?? []}
          candidates={dir?.candidates ?? []}
          jobs={dir?.jobs ?? []}
          applications={dir?.applications ?? []}
          onView={(doc) => {
            toast(`Viewing ${doc.fileName}`);
          }}
          onDownload={(doc) => {
            toast(`Download started: ${doc.fileName}`);
          }}
          onVerify={(id) => {
            updateDocumentStatus(id, "verified");
            toast("Document marked verified");
            void load();
          }}
          onMarkPending={(id) => {
            updateDocumentStatus(id, "pending");
            toast("Document marked pending");
            void load();
          }}
        />
      ) : null}
      </RecruitmentOverviewDashboard>

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
        key={editCandidate?.id ?? "new-cand"}
        open={candOpen}
        initial={editCandidate}
        onClose={() => {
          setCandOpen(false);
          setEditCandidate(null);
        }}
        jobs={dir?.jobs ?? []}
        onSubmit={handleCreateCandidate}
      />
      <CandidateViewDrawer
        open={Boolean(viewCandidate)}
        onClose={() => setViewCandidate(null)}
        candidate={viewCandidate}
        application={viewCandidate ? primaryAppFor(viewCandidate.id) : null}
        job={
          viewCandidate
            ? (() => {
                const app = primaryAppFor(viewCandidate.id);
                return app ? (dir?.jobs.find((j) => j.id === app.jobId) ?? null) : null;
              })()
            : null
        }
        documents={dir?.documents ?? []}
        interviews={dir?.interviews ?? []}
        offers={dir?.offers ?? []}
        candidates={dir?.candidates ?? []}
        onNavigate={(c) => setViewCandidate(c)}
        onSave={async ({ candidateId, patch, notes }) => {
          try {
            if (patch) {
              const updated = await updateCandidate(candidateId, patch);
              if (updated) setViewCandidate(updated);
            }
            const app = primaryAppFor(candidateId);
            if (app) updateApplicationNotes(app.id, notes);
            toast(patch ? "Candidate updated" : "Candidate notes saved");
            await load();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Failed to save candidate", "error");
            throw e;
          }
        }}
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
            toast(
              input.status === "sent"
                ? "Offer sent — pipeline at Offer Sent"
                : "Offer draft saved",
            );
            await load();
          })();
        }}
      />
      <InterviewOutcomeDrawer
        key={outcomeInterview?.id ?? "outcome"}
        open={Boolean(outcomeInterview)}
        onClose={() => setOutcomeInterview(null)}
        interview={outcomeInterview}
        candidate={
          outcomeInterview
            ? (dir?.candidates.find((c) => c.id === outcomeInterview.candidateId) ?? null)
            : null
        }
        job={
          outcomeInterview
            ? (dir?.jobs.find((j) => j.id === outcomeInterview.jobId) ?? null)
            : null
        }
        onSave={(input) => {
          void (async () => {
            try {
              await recordInterviewOutcome(input);
              toast(`Interview marked ${input.recommendation}`);
              setOutcomeInterview(null);
              await load();
            } catch (e) {
              toast(e instanceof Error ? e.message : "Failed to save outcome", "error");
            }
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
      <div className="overflow-x-auto rounded-[12px] border border-[#EEEFF3] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#F3F4F6] text-[11px] font-medium tracking-wide text-[#9CA3AF] uppercase">
            <tr>
              {headers.map((h) => (
                <th key={h || "a"} className="px-3 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-[#F8F8FA] transition-colors duration-150 hover:bg-[#FAFAFC]"
              >
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-3 align-middle text-[12px] text-[#374151]">
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
