"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  CalendarClock,
  FilePlus2,
  FolderOpen,
  LayoutDashboard,
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
import { OffersPanel } from "@/components/hr/recruitment/offers-panel";
import { DocumentsPanel } from "@/components/hr/recruitment/documents-panel";
import { JobOpeningDetail } from "@/components/hr/recruitment/job-opening-detail";
import { PipelineStageBoard } from "@/components/hr/recruitment/pipeline-stage-board";
import { BgCheckSendDrawer } from "@/components/hr/recruitment/bg-check-send-drawer";
import { BgPortalCredentialsDrawer } from "@/components/hr/recruitment/bg-portal-credentials-drawer";
import { NegotiationSalaryDrawer } from "@/components/hr/recruitment/negotiation-salary-drawer";
import {
  fetchBgPortalStatus,
  reviewBgPortal,
  sendBgDocumentPortal,
  type BgPortalStatus,
} from "@/services/bg-check-portal-service";
import { formatInrGrouping } from "@/services/recruitment-ats-lookups";
import {
  OfferDrawer,
  type OfferDrawerPrefill,
} from "@/components/hr/recruitment/offer-drawer";
import {
  StartOnboardingDrawer,
  type StartOnboardingPrefill,
} from "@/components/hr/onboarding/start-onboarding-drawer";
import {
  HrEmptyState,
  HrUnderlineTabs,
  type HrTabItem,
} from "@/components/hr/hr-primitives";
import { SetupDrawer, SetupField, SetupTextarea } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsPagination, EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { Button } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  ensureAtsDocumentContent,
  resolveCandidateResumeDocument,
} from "@/lib/recruitment/candidate-resume";
import { buildOfferLetterFileName } from "@/lib/recruitment/offer-letter-file-name";
import { resolveOfferLetterPdfDataUrl } from "@/lib/recruitment/resolve-offer-letter-pdf";
import {
  isPdfHref,
  resolvePreviewSrc,
} from "@/lib/recruitment/document-preview";
import {
  addDocument,
  advanceApplication,
  applyCandidateToJob,
  createCandidate,
  createJob,
  deleteCandidates,
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
  parseNegotiatedCtcFromNotes,
  patchDocumentContent,
  recordInterviewOutcome,
  rejectApplication,
  scheduleInterview,
  updateApplicationNegotiatedCtc,
  updateApplicationNotes,
  updateCandidate,
  updateDocumentStatus,
  downloadAtsDocument,
  getDocumentHref,
  sendOfferLetterEmail,
  toDateInputValue,
  updateOfferStatusWithEmail,
  updateJob,
  type AtsDirectory,
} from "@/services/recruitment-ats-service";
import { formatApiError } from "@/services/api-client";
import {
  buildBgVendorEmailBlock,
  createBgVendorPack,
  getBgVendorUrl,
} from "@/services/bg-vendor-portal-service";
import { sendEmailCompose } from "@/services/email-notification-service";
import {
  loadOnboardingDirectory,
  sendInvitation,
  startOnboarding,
} from "@/services/onboarding-management-service";
import { listEntityOptions } from "@/services/hr-setup-service";
import {
  ensureOfferLetterTemplatesLoaded,
  listOfferLetterTemplates,
} from "@/services/offer-letter-templates-service";
import type { StartOnboardingInput } from "@/types/onboarding-management";
import type {
  AtsCandidate,
  AtsDocument,
  AtsFilters,
  AtsInterview,
  AtsOffer,
  CreateCandidateInput,
  CreateJobInput,
  InterviewRound,
  JobOpening,
  PipelineApplication,
  PipelineStage,
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
  const [detailJob, setDetailJob] = useState<JobOpening | null>(null);
  const [candOpen, setCandOpen] = useState(false);
  const [schedulePrefill, setSchedulePrefill] = useState<{
    candidateId?: string;
    jobId?: string;
    applicationId?: string;
    round?: InterviewRound;
  } | null>(null);
  const [intOpen, setIntOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerPrefill, setOfferPrefill] = useState<OfferDrawerPrefill | null>(null);
  const [bgCheckApp, setBgCheckApp] = useState<PipelineApplication | null>(null);
  const [salaryApp, setSalaryApp] = useState<PipelineApplication | null>(null);
  const [bgPortalApp, setBgPortalApp] = useState<PipelineApplication | null>(null);
  const [bgPortalInitial, setBgPortalInitial] = useState<Partial<BgPortalStatus> | null>(
    null,
  );
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [outcomeInterview, setOutcomeInterview] = useState<AtsInterview | null>(null);
  const [viewCandidate, setViewCandidate] = useState<AtsCandidate | null>(null);
  const [editCandidate, setEditCandidate] = useState<AtsCandidate | null>(null);
  const [candJobPrefill, setCandJobPrefill] = useState<string | null>(null);
  const [onboardingOfferId, setOnboardingOfferId] = useState<string | null>(null);
  const [onboardingPrefill, setOnboardingPrefill] = useState<StartOnboardingPrefill | null>(
    null,
  );
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<AtsDocument | null>(null);
  const [bgPortalStatusByAppId, setBgPortalStatusByAppId] = useState<
    Record<string, string>
  >({});

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

  const resolveOfferLetterDoc = useCallback(
    async (
      app: PipelineApplication,
      cand: AtsCandidate,
    ): Promise<AtsDocument | null> => {
      const offers = dir?.offers ?? [];
      const offer =
        offers.find((o) => o.applicationId === app.id) ||
        offers.find((o) => o.candidateId === cand.id && o.jobId === app.jobId);
      if (!offer) {
        toast("No offer letter yet — create one first", "error");
        return null;
      }
      const job = dir?.jobs.find((j) => j.id === app.jobId || j.id === offer.jobId);
      const fileName = buildOfferLetterFileName({
        candidateName: cand.fullName,
        role: job?.title,
        offerCode: offer.offerCode,
      });
      const docs = dir?.documents ?? [];
      let doc =
        docs.find((d) => d.kind === "offer_letter" && d.offerId === offer.id) ||
        docs.find((d) => d.kind === "offer_letter" && d.candidateId === cand.id) ||
        null;

      const href = await resolveOfferLetterPdfDataUrl(offer, doc);
      if (!href) {
        toast("Offer letter PDF not found — recreate from a template", "error");
        return null;
      }

      if (!doc) {
        // Metadata only in localStorage — PDF bytes stay in IndexedDB via offer id.
        try {
          doc = addDocument(cand.id, "offer_letter", fileName, {
            status: "verified",
            offerId: offer.id,
            mimeType: "application/pdf",
          });
        } catch {
          doc = {
            id: `tmp-offer-${offer.id}`,
            candidateId: cand.id,
            kind: "offer_letter",
            fileName,
            mimeType: "application/pdf",
            status: "verified",
            offerId: offer.id,
            uploadedAt: new Date().toISOString(),
          };
        }
      } else if (doc.fileName !== fileName || doc.offerId !== offer.id) {
        try {
          const patched = patchDocumentContent(doc.id, {
            mimeType: "application/pdf",
            fileName,
          });
          if (patched) doc = patched;
        } catch {
          /* preview still works from in-memory href */
        }
      }

      // Keep PDF in memory / IndexedDB only — never rewrite erp_ats_docs_v1 with the blob.
      return {
        ...doc,
        fileName,
        contentDataUrl: href,
        url: href,
        mimeType: "application/pdf",
        offerId: offer.id,
      };
    },
    [dir],
  );

  useEffect(() => {
    void load();
    void ensureOfferLetterTemplatesLoaded();
  }, [load]);

  // Load BG portal statuses for Background Check / Offer Sent candidates
  useEffect(() => {
    if (tab !== "pipeline" || !dir?.applications?.length) return;
    const apps = dir.applications.filter(
      (a) =>
        a.status === "active" &&
        (a.stage === "background_check" || a.stage === "offer_sent"),
    );
    if (!apps.length) {
      setBgPortalStatusByAppId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        apps.map(async (a) => {
          try {
            const st = await fetchBgPortalStatus(a.id);
            return st?.status ? ([a.id, st.status] as const) : null;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const e of entries) {
        if (e) next[e[0]] = e[1];
      }
      setBgPortalStatusByAppId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, dir?.applications]);

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
    try {
      if (editJob) {
        await updateJob(editJob.id, input);
        toast("Job updated");
        setEditJob(null);
      } else {
        const created = await createJob(input);
        const careersHint =
          created.status === "open"
            ? ` · Careers: ${typeof window !== "undefined" ? `${window.location.origin}/careers` : "/careers"}`
            : "";
        toast(
          created.status === "open"
            ? `Job ${created.jobCode} created${careersHint}`
            : `Job ${created.jobCode} saved as ${created.status}`,
        );
      }
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save job", "error");
      throw e;
    }
  }

  async function handleDeleteCandidates(ids: string[]) {
    try {
      const n = await deleteCandidates(ids);
      toast(n === 1 ? "Candidate deleted" : `${n} candidates deleted`);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete candidates", "error");
    }
  }

  async function handleCreateCandidate(input: CreateCandidateInput, jobId?: string) {
    try {
      // HRMS add from a job detail page goes straight into Screening (not careers await).
      const fromJobDetail = Boolean(jobId && detailJob && jobId === detailJob.id);
      const applyStage = fromJobDetail ? "screening" : "sourced";
      if (editCandidate) {
        await updateCandidate(editCandidate.id, input);
        if (jobId) {
          await applyCandidateToJob(editCandidate.id, jobId, applyStage);
          toast(
            fromJobDetail
              ? `Candidate ${editCandidate.candidateCode} added to job (Screening)`
              : `Candidate ${editCandidate.candidateCode} updated and applied to job`,
          );
        } else {
          toast(`Candidate ${editCandidate.candidateCode} updated`);
        }
        setEditCandidate(null);
        setCandJobPrefill(null);
        await load();
        return;
      }
      const cand = await createCandidate(input);
      if (jobId) {
        await applyCandidateToJob(cand.id, jobId, applyStage);
        toast(
          fromJobDetail
            ? `Candidate ${cand.candidateCode} added to job — Screening`
            : `Candidate ${cand.candidateCode} saved and applied to job`,
        );
      } else {
        toast(`Candidate ${cand.candidateCode} saved to pool`);
      }
      setCandJobPrefill(null);
      if (input.resumeName) {
        const resumeData = (input.resumeUrl || "").startsWith("data:") ? input.resumeUrl : undefined;
        addDocument(cand.id, "resume", input.resumeName, {
          contentDataUrl: resumeData,
          mimeType: resumeData?.startsWith("data:application/pdf")
            ? "application/pdf"
            : resumeData
              ? resumeData.slice(5, resumeData.indexOf(";")) || undefined
              : undefined,
          url: resumeData,
          status: "pending",
        });
      }
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
      throw e;
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

  function openAddCandidate(jobId?: string) {
    setEditCandidate(null);
    setCandJobPrefill(jobId ?? null);
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
          label: "Templates",
          icon: FilePlus2,
          badge: listOfferLetterTemplates().length,
        },
        { id: "documents", label: "Documents", icon: FolderOpen },
      ] satisfies HrTabItem[],
    [dir, tab],
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
          onScheduleInterview: () => {
            setSchedulePrefill(null);
            setIntOpen(true);
          },
          onOpenCareers: () => window.open("/careers", "_blank"),
          onRefresh: () => {
            void (async () => {
              await load();
              toast("Recruitment data refreshed");
            })();
          },
          onViewJobs: () => {
            setDetailJob(null);
            setTab("jobs");
          },
          onViewCandidates: () => setTab("candidates"),
          onViewInterviews: () => setTab("interviews"),
          onViewOffers: () => setTab("offers"),
          onViewPipeline: (stage) => {
            if (stage) setFilters((f) => ({ ...f, stage }));
            setTab("pipeline");
          },
          onOpenJob: (job) => {
            setDetailJob(job);
            setTab("jobs");
          },
          onEditJob: (job) => {
            setEditJob(job);
            setJobOpen(true);
          },
          onOpenCandidate: (candidate) => setViewCandidate(candidate),
          onEditCandidate: (candidate) => {
            setEditCandidate(candidate);
            setCandJobPrefill(null);
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
        {tab !== "dashboard" && loading && !dir ? (
          tab === "pipeline" ? (
            <PipelineBoardSkeleton />
          ) : tab === "offers" ? (
            <OffersTabSkeleton />
          ) : (
            <EmsSkeleton cards={4} rows={6} />
          )
        ) : null}

        {!(loading && !dir) && tab === "jobs" ? (
          detailJob ? (
            <JobOpeningDetail
              job={detailJob}
              applications={dir?.applications ?? []}
              candidates={dir?.candidates ?? []}
              onBack={() => setDetailJob(null)}
              onEdit={() => {
                setEditJob(detailJob);
                setJobOpen(true);
              }}
              onAddCandidate={() => openAddCandidate(detailJob.id)}
              onViewCandidate={(c) => setViewCandidate(c)}
              onPreviewResume={(c) => {
                void (async () => {
                  try {
                    const doc = await resolveCandidateResumeDocument(
                      c,
                      dir?.documents ?? [],
                    );
                    setPreviewDoc(doc);
                  } catch (e) {
                    toast(
                      e instanceof Error ? e.message : "Could not open resume",
                      "error",
                    );
                  }
                })();
              }}
              onAccept={(applicationId) => {
                void (async () => {
                  try {
                    await moveApplicationStage(applicationId, "screening");
                    toast("Accepted — moved to Screening");
                    await load();
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Accept failed", "error");
                  }
                })();
              }}
              onReject={(applicationId, reason) => {
                void (async () => {
                  try {
                    await rejectApplication(applicationId, reason);
                    toast("Applicant rejected");
                    await load();
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Reject failed", "error");
                  }
                })();
              }}
            />
          ) : (
            <JobOpeningsPanel
              jobs={dir?.jobs ?? []}
              applicationsByJob={applicationsByJob}
              onCreate={openCreateJob}
              onView={(job) => setDetailJob(job)}
              onEdit={(job) => {
                setEditJob(job);
                setJobOpen(true);
              }}
            />
          )
        ) : null}

        {!(loading && !dir) && tab === "candidates" ? (
          <CandidatesPanel
            candidates={dir?.candidates ?? []}
            jobs={dir?.jobs ?? []}
            applications={dir?.applications ?? []}
            onAdd={openAddCandidate}
            onDelete={handleDeleteCandidates}
            onView={(c) => setViewCandidate(c)}
            onEdit={(c) => {
              setEditCandidate(c);
              setCandJobPrefill(null);
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

        {!(loading && !dir) && tab === "interviews" ? (
          <InterviewsPanel
            interviews={dir?.interviews ?? []}
            candidates={dir?.candidates ?? []}
            jobs={dir?.jobs ?? []}
            onSchedule={() => setIntOpen(true)}
            onOutcome={(interview) => setOutcomeInterview(interview)}
          />
        ) : null}

        {!(loading && !dir) && tab === "pipeline" ? (
          <PipelineStageBoard
            applications={(dir?.applications ?? []).filter((a) => a.stage !== "sourced")}
            candidates={dir?.candidates ?? []}
            jobs={dir?.jobs ?? []}
            interviews={dir?.interviews ?? []}
            offers={dir?.offers ?? []}
            bgPortalStatusByAppId={bgPortalStatusByAppId}
            initialStage={
              filters.stage === "offer_sent"
                ? "background_check"
                : filters.stage !== "all" && filters.stage !== "sourced"
                  ? (filters.stage as PipelineStage)
                  : "screening"
            }
            onViewProfile={(c) => setViewCandidate(c)}
            onAdvanceOutcome={(input) => {
              void (async () => {
                try {
                  const app = dir?.applications.find((a) => a.id === input.applicationId);
                  if (!app) throw new Error("Application not found");
                  const cand = dir?.candidates.find((c) => c.id === app.candidateId);

                  if (input.recommendation === "rejected") {
                    await rejectApplication(input.applicationId, input.feedback);
                    toast("Candidate rejected with feedback");
                    await load();
                    return;
                  }

                  if (input.recommendation === "hold") {
                    const prior = (app.notes || "").trim();
                    const stamp = `[${app.stage} hold] ${input.feedback}`;
                    updateApplicationNotes(
                      input.applicationId,
                      prior ? `${prior}\n\n${stamp}` : stamp,
                    );
                    toast("Hold recorded — candidate stays on this stage");
                    await load();
                    return;
                  }

                  // selected
                  if (app.stage === "background_check") {
                    const job = dir?.jobs.find((j) => j.id === app.jobId);
                    const negotiated =
                      app.negotiatedCtc ||
                      parseNegotiatedCtcFromNotes(app.notes) ||
                      job?.salaryMax;
                    setOfferPrefill({
                      candidateId: app.candidateId,
                      jobId: app.jobId,
                      applicationId: app.id,
                      department: job?.department,
                      location: job?.location,
                      reportingManager: job?.hiringManager,
                      employmentType: job?.employmentType,
                      ctc: negotiated,
                      notes: input.feedback,
                    });
                    setOfferOpen(true);
                    toast("Review saved — create the offer letter to continue");
                    await load();
                    return;
                  }

                  await advanceApplication(input.applicationId, input.feedback);

                  const nextRound: InterviewRound | null =
                    app.stage === "interview_round_1"
                      ? "round_2"
                      : app.stage === "interview_round_2"
                        ? "hr"
                        : null;

                  if (nextRound && cand) {
                    setSchedulePrefill({
                      candidateId: cand.id,
                      jobId: app.jobId,
                      applicationId: app.id,
                      round: nextRound,
                    });
                    setIntOpen(true);
                    toast(
                      nextRound === "round_2"
                        ? "Round 1 selected — schedule Round 2"
                        : "Round 2 selected — schedule Negotiation Round",
                    );
                  } else {
                    toast("Review saved — advanced to next stage");
                  }
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
            onScheduleInterview={(app, cand, round) => {
              setSchedulePrefill({
                candidateId: cand.id,
                jobId: app.jobId,
                applicationId: app.id,
                round,
              });
              setIntOpen(true);
            }}
            onViewBgDocs={(app) => {
              setBgPortalInitial(null);
              setBgPortalApp({ ...app, stage: "background_check" });
            }}
            onRequestBgDocs={(app, cand) => {
              void (async () => {
                try {
                  const invite = await sendBgDocumentPortal(app.id);
                  const prior = (app.notes || "").trim();
                  const stamp = invite.emailSent
                    ? `[bg_docs_portal] invite emailed to ${invite.candidate_email}`
                    : `[bg_docs_portal] invite created (email not sent)`;
                  updateApplicationNotes(app.id, prior ? `${prior}\n\n${stamp}` : stamp);
                  if (invite.emailSent) {
                    toast(
                      `Document portal invite emailed to ${cand.fullName} (link not shown in UI).`,
                    );
                  } else {
                    toast(
                      `Portal invite created for ${cand.fullName}, but email was not sent${invite.emailError ? `: ${invite.emailError}` : ""}.`,
                      "error",
                    );
                  }
                  await load();
                } catch (e) {
                  toast(
                    e instanceof Error ? e.message : "Could not create BG document portal",
                    "error",
                  );
                }
              })();
            }}
            onReviewBgPortal={(app, _cand, decision) => {
              void (async () => {
                try {
                  const st = await reviewBgPortal(app.id, decision);
                  setBgPortalStatusByAppId((prev) => ({
                    ...prev,
                    [app.id]: st.status,
                  }));
                  if (decision === "verified") {
                    toast("BG verified");
                  } else {
                    toast("BG rejected");
                  }
                  await load();
                } catch (e) {
                  toast(
                    e instanceof Error ? e.message : "Could not save BG review",
                    "error",
                  );
                }
              })();
            }}
            onSetNegotiatedSalary={(app) => setSalaryApp(app)}
            onSendBgCheck={(app) => setBgCheckApp(app)}
            onGenerateOffer={(app, cand) => {
              const job = dir?.jobs.find((j) => j.id === app.jobId);
              const negotiated =
                app.negotiatedCtc ||
                parseNegotiatedCtcFromNotes(app.notes) ||
                job?.salaryMax;
              setOfferPrefill({
                candidateId: cand.id,
                jobId: app.jobId,
                applicationId: app.id,
                department: job?.department,
                location: job?.location,
                reportingManager: job?.hiringManager,
                employmentType: job?.employmentType,
                ctc: negotiated,
                notes: negotiated
                  ? `Salary discussed: ₹${formatInrGrouping(negotiated)}`
                  : undefined,
              });
              setOfferOpen(true);
            }}
            onViewOfferLetter={(app, cand) => {
              void (async () => {
                try {
                  const doc = await resolveOfferLetterDoc(app, cand);
                  if (!doc) return;
                  setPreviewDoc(doc);
                } catch (e) {
                  toast(
                    e instanceof Error ? e.message : "Could not open offer letter",
                    "error",
                  );
                }
              })();
            }}
            onBackOut={(app, cand) => {
              void (async () => {
                try {
                  const reason =
                    window.prompt(
                      `Backed out reason for ${cand.fullName}?`,
                      "Candidate backed out after offer",
                    ) || "";
                  if (!reason.trim()) {
                    toast("Backed out reason is required", "error");
                    return;
                  }
                  const updated = await markApplicationBackedOut(app.id, reason.trim());
                  if (!updated) {
                    toast("Could not mark backed out", "error");
                    return;
                  }
                  toast(`${cand.fullName} marked backed out`);
                  await load();
                } catch (e) {
                  toast(
                    e instanceof Error ? e.message : "Failed to mark backed out",
                    "error",
                  );
                }
              })();
            }}
            onAcceptOffer={(app, cand) => {
              void (async () => {
                try {
                  const offers = dir?.offers ?? [];
                  const offer =
                    offers.find(
                      (o) =>
                        o.applicationId === app.id &&
                        (o.status === "sent" || o.status === "draft"),
                    ) ||
                    offers.find(
                      (o) =>
                        o.candidateId === cand.id &&
                        o.jobId === app.jobId &&
                        (o.status === "sent" || o.status === "draft"),
                    );
                  if (offer) {
                    const result = await updateOfferStatusWithEmail(offer.id, "accepted");
                    if (!result.offer) {
                      toast("Could not accept offer", "error");
                      return;
                    }
                  } else {
                    await moveApplicationStage(app.id, "offer_accepted");
                  }
                  toast("Offer accepted — moved to Offer Accepted");
                  await load();
                } catch (e) {
                  toast(
                    e instanceof Error ? e.message : "Failed to accept offer",
                    "error",
                  );
                }
              })();
            }}
            onCompleteOnboarding={(app, cand) => {
              void (async () => {
                try {
                  const existing = await loadOnboardingDirectory();
                  const already = existing.cases.find(
                    (c) =>
                      c.candidateId === cand.id &&
                      c.status !== "cancelled" &&
                      c.status !== "completed",
                  );
                  if (already) {
                    toast(`Onboarding already started (${already.caseCode})`);
                    router.push("/hr/onboarding");
                    return;
                  }

                  const offers = dir?.offers ?? [];
                  const offer =
                    offers.find(
                      (o) =>
                        o.applicationId === app.id &&
                        (o.status === "accepted" || o.status === "sent"),
                    ) ||
                    offers.find(
                      (o) =>
                        (o.candidateId === cand.id || o.candidateId === cand.apiId) &&
                        o.jobId === app.jobId &&
                        (o.status === "accepted" || o.status === "sent"),
                    ) ||
                    offers.find((o) => o.applicationId === app.id) ||
                    offers.find(
                      (o) =>
                        o.candidateId === cand.id || o.candidateId === cand.apiId,
                    );
                  const job = dir?.jobs.find((j) => j.id === app.jobId);
                  const joiningDate =
                    toDateInputValue(offer?.joiningDate) || offer?.joiningDate || "";

                  setOnboardingPrefill({
                    candidateId: cand.id,
                    candidateName: cand.fullName,
                    candidateEmail: cand.email,
                    candidatePhone: cand.phone,
                    joiningDate,
                    department: offer?.department || job?.department || "",
                    designation: job?.designation || job?.title || "",
                    reportingManager:
                      offer?.reportingManager || job?.hiringManager || "",
                    branch: job?.branch || "",
                    employmentType:
                      offer?.employmentType || job?.employmentType || "permanent",
                    offerId: offer?.id,
                    offerCode: offer?.offerCode,
                    invitationExpiryDays: 14,
                    applicationId: app.id,
                  });
                  setOnboardingOpen(true);
                } catch (e) {
                  toast(
                    e instanceof Error ? e.message : "Could not open onboarding",
                    "error",
                  );
                }
              })();
            }}
          />
        ) : null}

      {!(loading && !dir) && tab === "offers" ? (
        <OffersPanel
          offers={dir?.offers ?? []}
          candidates={dir?.candidates ?? []}
          jobs={dir?.jobs ?? []}
          onToast={(message, tone) => toast(message, tone === "error" ? "error" : undefined)}
          onSend={(id) => {
            void (async () => {
              try {
                const result = await updateOfferStatusWithEmail(id, "sent");
                if (result.email?.sent) {
                  toast(
                    result.email.portalIncluded
                      ? `Offer + document portal emailed to ${result.email.to}`
                      : `Offer letter emailed to ${result.email.to} (letter attached)`,
                  );
                } else if (result.email?.error) {
                  toast(
                    `Offer marked sent, but email failed: ${result.email.error}`,
                    "error",
                  );
                } else {
                  toast("Offer sent");
                }
                await load();
              } catch (e) {
                toast(e instanceof Error ? e.message : "Failed to send offer", "error");
              }
            })();
          }}
          onResendLetter={(id) => {
            void (async () => {
              try {
                const email = await sendOfferLetterEmail(id);
                if (email.sent) {
                  toast(`Offer letter resent to ${email.to}`);
                } else {
                  toast(email.error || "Could not resend offer letter", "error");
                }
              } catch (e) {
                toast(e instanceof Error ? e.message : "Resend failed", "error");
              }
            })();
          }}
          onAccept={(id) => {
            void (async () => {
              const result = await updateOfferStatusWithEmail(id, "accepted");
              if (result.offer) toast("Offer accepted — ready to onboard");
              await load();
            })();
          }}
          onDecline={(id) => {
            void (async () => {
              await updateOfferStatusWithEmail(id, "rejected");
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

                const joinDate =
                  toDateInputValue(offer.joiningDate) || offer.joiningDate || "";
                if (!joinDate) {
                  toast(
                    "Offer has no joining date — edit the offer or use Complete onboarding from the pipeline",
                    "error",
                  );
                  return;
                }
                const created = await startOnboarding({
                  candidateId: cand.id,
                  candidateName: cand.fullName,
                  candidateEmail: cand.email,
                  candidatePhone: cand.phone,
                  joiningDate: joinDate,
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

      {!(loading && !dir) && tab === "documents" ? (
        <DocumentsPanel
          documents={dir?.documents ?? []}
          candidates={dir?.candidates ?? []}
          jobs={dir?.jobs ?? []}
          applications={dir?.applications ?? []}
          onView={(doc) => {
            void (async () => {
              try {
                if (doc.kind === "offer_letter") {
                  const offer =
                    (doc.offerId
                      ? dir?.offers.find((o) => o.id === doc.offerId)
                      : null) ||
                    dir?.offers.find(
                      (o) =>
                        o.candidateId === doc.candidateId &&
                        (o.offerLetterName === doc.fileName ||
                          o.templateFileName === doc.fileName),
                    );
                  if (offer) {
                    const href = await resolveOfferLetterPdfDataUrl(offer, doc);
                    if (!href) {
                      toast("Offer letter PDF not available", "error");
                      return;
                    }
                    const cand = dir?.candidates.find(
                      (c) => c.id === doc.candidateId || c.id === offer.candidateId,
                    );
                    const job = dir?.jobs.find((j) => j.id === offer.jobId);
                    const fileName = buildOfferLetterFileName({
                      candidateName: cand?.fullName,
                      role: job?.title,
                      offerCode: offer.offerCode,
                    });
                    setPreviewDoc({
                      ...doc,
                      fileName,
                      contentDataUrl: href,
                      url: href,
                      mimeType: "application/pdf",
                      offerId: offer.id,
                    });
                    return;
                  }
                }
                const ready = await ensureAtsDocumentContent(
                  doc,
                  dir?.candidates ?? [],
                  dir?.documents ?? [],
                );
                if (!getDocumentHref(ready)) {
                  toast("No file content available to view", "error");
                  return;
                }
                setPreviewDoc(ready);
                void load();
              } catch (e) {
                toast(
                  e instanceof Error ? e.message : "No file content available to view",
                  "error",
                );
              }
            })();
          }}
          onDownload={(doc) => {
            void (async () => {
              try {
                if (doc.kind === "offer_letter") {
                  const offer =
                    (doc.offerId
                      ? dir?.offers.find((o) => o.id === doc.offerId)
                      : null) ||
                    dir?.offers.find(
                      (o) =>
                        o.candidateId === doc.candidateId &&
                        (o.offerLetterName === doc.fileName ||
                          o.templateFileName === doc.fileName),
                    );
                  if (offer) {
                    const href = await resolveOfferLetterPdfDataUrl(offer, doc);
                    if (!href) {
                      toast("Offer letter PDF not available", "error");
                      return;
                    }
                    const cand = dir?.candidates.find(
                      (c) => c.id === doc.candidateId || c.id === offer.candidateId,
                    );
                    const job = dir?.jobs.find((j) => j.id === offer.jobId);
                    const fileName = buildOfferLetterFileName({
                      candidateName: cand?.fullName,
                      role: job?.title,
                      offerCode: offer.offerCode,
                    });
                    if (
                      !downloadAtsDocument({
                        ...doc,
                        fileName,
                        contentDataUrl: href,
                        url: href,
                        mimeType: "application/pdf",
                      })
                    ) {
                      toast("No file content available to download", "error");
                      return;
                    }
                    toast(`Download started: ${fileName}`);
                    return;
                  }
                }
                const ready = await ensureAtsDocumentContent(
                  doc,
                  dir?.candidates ?? [],
                  dir?.documents ?? [],
                );
                if (!downloadAtsDocument(ready)) {
                  toast("No file content available to download", "error");
                  return;
                }
                toast(`Download started: ${ready.fileName}`);
                void load();
              } catch (e) {
                toast(
                  e instanceof Error
                    ? e.message
                    : "No file content available to download",
                  "error",
                );
              }
            })();
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
        key={`${editCandidate?.id ?? "new-cand"}-${candJobPrefill ?? "pool"}`}
        open={candOpen}
        initial={editCandidate}
        initialJobId={candJobPrefill}
        onClose={() => {
          setCandOpen(false);
          setEditCandidate(null);
          setCandJobPrefill(null);
        }}
        jobs={dir?.jobs ?? []}
        applications={dir?.applications ?? []}
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
        onClose={() => {
          setIntOpen(false);
          setSchedulePrefill(null);
        }}
        candidates={dir?.candidates ?? []}
        jobs={dir?.jobs ?? []}
        applications={dir?.applications ?? []}
        initial={schedulePrefill}
        onSubmit={async (input) => {
          try {
            const result = await scheduleInterview(input);
            if (result.emailsSent > 0 && result.emailErrors.length === 0) {
              toast(
                `Interview scheduled — invite emailed to ${result.emailsSent} recipient${result.emailsSent === 1 ? "" : "s"}`,
              );
            } else if (result.emailsSent > 0) {
              toast(
                `Interview scheduled — ${result.emailsSent} invite(s) sent; some failed`,
                "error",
              );
            } else if (result.emailErrors.length > 0) {
              toast(
                `Interview scheduled, but invite email failed: ${result.emailErrors[0]}`,
                "error",
              );
            } else {
              toast(
                "Interview scheduled — no recipient emails found (candidate/participants)",
                "error",
              );
            }
            setIntOpen(false);
            setSchedulePrefill(null);
            await load();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Failed to schedule interview", "error");
            throw e;
          }
        }}
      />
      <OfferDrawer
        open={offerOpen}
        initial={offerPrefill}
        onClose={() => {
          setOfferOpen(false);
          setOfferPrefill(null);
        }}
        candidates={dir?.candidates ?? []}
        jobs={dir?.jobs ?? []}
        applications={dir?.applications ?? []}
        onSubmit={(input) => {
          void (async () => {
            try {
              const { offer, email, portal } = await generateOffer(input);
              if (input.status === "sent") {
                if (email?.sent) {
                  toast(
                    email.portalIncluded
                      ? `Offer + document portal emailed to ${email.to}${offer.offerCode ? ` (${offer.offerCode})` : ""}`
                      : `Offer letter emailed to ${email.to}${offer.offerCode ? ` (${offer.offerCode})` : ""}`,
                  );
                } else if (email?.error) {
                  toast(
                    `Offer saved, but email failed: ${email.error}`,
                    "error",
                  );
                } else {
                  toast(
                    portal
                      ? `Offer sent${offer.offerCode ? ` (${offer.offerCode})` : ""} — in Background Check for verify`
                      : `Offer sent${offer.offerCode ? ` (${offer.offerCode})` : ""} — moved to Offer Sent`,
                  );
                }
              } else {
                toast("Offer draft saved — PDF in candidate Documents");
              }
              setOfferOpen(false);
              setOfferPrefill(null);
              await load();
            } catch (e) {
              toast(e instanceof Error ? e.message : "Failed to save offer", "error");
            }
          })();
        }}
      />

      <NegotiationSalaryDrawer
        open={Boolean(salaryApp)}
        application={salaryApp}
        candidate={
          salaryApp
            ? (dir?.candidates.find((c) => c.id === salaryApp.candidateId) ?? null)
            : null
        }
        job={
          salaryApp ? (dir?.jobs.find((j) => j.id === salaryApp.jobId) ?? null) : null
        }
        onClose={() => setSalaryApp(null)}
        onSave={async (applicationId, ctc) => {
          const updated = updateApplicationNegotiatedCtc(applicationId, ctc);
          if (!updated) throw new Error("Could not save salary discussed");
          toast(`Salary discussed saved — ₹${formatInrGrouping(ctc)} (will prefill offer)`);
          setSalaryApp(null);
          await load();
        }}
      />

      <BgPortalCredentialsDrawer
        open={Boolean(bgPortalApp)}
        application={bgPortalApp}
        candidate={
          bgPortalApp
            ? (dir?.candidates.find((c) => c.id === bgPortalApp.candidateId) ?? null)
            : null
        }
        initial={bgPortalInitial}
        onClose={() => {
          setBgPortalApp(null);
          setBgPortalInitial(null);
        }}
        onResent={() => void load()}
        onToast={(message, tone) => toast(message, tone === "error" ? "error" : undefined)}
      />

      <BgCheckSendDrawer
        open={Boolean(bgCheckApp)}
        application={bgCheckApp}
        candidate={
          bgCheckApp
            ? (dir?.candidates.find((c) => c.id === bgCheckApp.candidateId) ?? null)
            : null
        }
        job={
          bgCheckApp ? (dir?.jobs.find((j) => j.id === bgCheckApp.jobId) ?? null) : null
        }
        onClose={() => setBgCheckApp(null)}
        onSend={async (payload) => {
          try {
            const pack = await createBgVendorPack(
              payload.applicationId,
              payload.toAddress,
            );
            const credBlock = buildBgVendorEmailBlock({
              ...pack,
              portal_url: getBgVendorUrl(pack.token),
            });
            const fullText = payload.bodyText.includes("Access code:")
              ? payload.bodyText
              : `${payload.bodyText.trim()}\n${credBlock}`;
            const bodyHtml = `
<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#111827;line-height:1.5">
  ${fullText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br/>")}
  <p style="margin-top:20px;color:#6b7280">Sent via iConnect Plus connected mail.</p>
</div>`.trim();
            await sendEmailCompose({
              to_address: payload.toAddress,
              subject: payload.subject,
              body_html: bodyHtml,
              event_type: "recruitment.bg_check.request",
              payload_json: {
                application_id: payload.applicationId,
                candidate_name: payload.candidateName,
                candidate_email: payload.candidateEmail,
                candidate_phone: payload.candidatePhone,
                vendor_token: pack.token,
                portal_url: getBgVendorUrl(pack.token),
                document_count: pack.document_count,
              },
            });
            const priorApp = dir?.applications.find((a) => a.id === payload.applicationId);
            const prior = (priorApp?.notes || "").trim();
            const stamp = `[bg_check emailed] to ${payload.toAddress} · download link ${getBgVendorUrl(pack.token)} · ${pack.document_count} doc(s)`;
            updateApplicationNotes(
              payload.applicationId,
              prior ? `${prior}\n\n${stamp}` : stamp,
            );
            toast(
              `Background check emailed to ${payload.toAddress} with download link`,
            );
            setBgCheckApp(null);
            await load();
          } catch (e) {
            toast(formatApiError(e, "Background check email failed"), "error");
            throw e;
          }
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
              if (input.recommendation === "selected") {
                toast("Review saved — candidate advanced to next phase");
              } else if (input.recommendation === "rejected") {
                toast("Candidate rejected with feedback");
              } else {
                toast("Interview on hold — feedback saved");
              }
              setOutcomeInterview(null);
              await load();
            } catch (e) {
              toast(e instanceof Error ? e.message : "Failed to save outcome", "error");
            }
          })();
        }}
      />

      <StartOnboardingDrawer
        open={onboardingOpen}
        initial={onboardingPrefill}
        onClose={() => {
          setOnboardingOpen(false);
          setOnboardingPrefill(null);
        }}
        onSubmit={async (input: StartOnboardingInput) => {
          const existing = await loadOnboardingDirectory();
          const already = existing.cases.find(
            (c) =>
              (input.offerId && c.offerId === input.offerId) ||
              (c.candidateId === input.candidateId &&
                c.status !== "cancelled" &&
                c.status !== "completed"),
          );
          if (already) {
            toast(`Onboarding already started (${already.caseCode})`);
            router.push("/hr/onboarding");
            return;
          }

          const created = await startOnboarding(input);
          try {
            await sendInvitation(created.id, "email", input.invitationExpiryDays || 14);
            toast(
              `Onboarding invite emailed to ${input.candidateEmail} with portal link + login · case ${created.caseCode}`,
            );
          } catch (e) {
            toast(
              e instanceof Error
                ? `Case ${created.caseCode} created, but invite email failed: ${e.message}`
                : `Case ${created.caseCode} created — invite email failed`,
              "error",
            );
          }

          const applicationId = onboardingPrefill?.applicationId;
          if (applicationId) {
            try {
              await markApplicationHired(applicationId);
            } catch {
              /* best-effort */
            }
          }

          setOnboardingOpen(false);
          setOnboardingPrefill(null);
          await load();
          router.push("/hr/onboarding");
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

      {previewDoc ? (
        <DocumentPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      ) : null}
    </div>
  );
}

function SkeletonBone({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md bg-[#E5E7EB] motion-safe:animate-pulse",
        className,
      )}
    />
  );
}

/** Matches PipelineStageBoard: left stage nav + right candidate list. */
function PipelineBoardSkeleton() {
  return (
    <div
      className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]"
      aria-busy="true"
      aria-label="Loading pipeline"
    >
      <aside className="rounded-xl border border-border/70 bg-card p-2 shadow-sm">
        <SkeletonBone className="mx-2 mb-2 h-3 w-24" />
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2"
            >
              <SkeletonBone className="size-3.5 shrink-0 rounded" />
              <SkeletonBone className="h-3 flex-1" />
              <SkeletonBone className="h-4 w-6 rounded-full" />
            </div>
          ))}
        </div>
      </aside>
      <section className="min-w-0 rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/60 px-4 py-3">
          <SkeletonBone className="h-4 w-28" />
          <SkeletonBone className="mt-2 h-3 w-36" />
        </div>
        <div className="divide-y divide-border/50 px-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <SkeletonBone className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <SkeletonBone className="h-3.5 w-40" />
                <SkeletonBone className="h-3 w-56 max-w-full" />
              </div>
              <SkeletonBone className="size-8 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function OffersTabSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading offers">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1.5">
            <SkeletonBone className="h-4 w-44" />
            <SkeletonBone className="h-3 w-64 max-w-full" />
          </div>
          <SkeletonBone className="h-9 w-36 rounded-full" />
        </div>
        <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-3">
              <SkeletonBone className="size-9 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <SkeletonBone className="h-3.5 w-40" />
                <SkeletonBone className="h-3 w-52 max-w-full" />
              </div>
              <SkeletonBone className="h-7 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBone key={i} className="mb-2 h-11 w-full last:mb-0" />
        ))}
      </div>
    </div>
  );
}

function DocumentPreviewModal({
  doc,
  onClose,
}: {
  doc: AtsDocument;
  onClose: () => void;
}) {
  const href = getDocumentHref(doc);
  const isPdf = isPdfHref({
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    href,
  });
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  useEffect(() => {
    const resolved = resolvePreviewSrc(href);
    setPreviewSrc(resolved.src);
    return () => {
      resolved.revoke?.();
    };
  }, [href]);

  // Hide Chrome/Edge built-in PDF toolbar (download / print / etc.)
  const pdfEmbedSrc =
    previewSrc && isPdf
      ? `${previewSrc}${previewSrc.includes("#") ? "&" : "#"}toolbar=0&navpanes=0`
      : previewSrc;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-3 sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={doc.fileName}
        className="flex h-[min(900px,92vh)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#F3F4F6] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[#111827]">{doc.fileName}</p>
            <p className="text-[11px] text-[#6B7280]">
              {doc.kind.replace(/_/g, " ")} · PDF preview
            </p>
          </div>
          <button
            type="button"
            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B7280] transition-colors duration-150 hover:bg-[#F9FAFB]"
            aria-label="Close preview"
            onClick={onClose}
          >
            <span className="text-[16px] leading-none">×</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-[#E5E7EB] p-2">
          {pdfEmbedSrc && isPdf ? (
            <embed
              title={doc.fileName}
              src={pdfEmbedSrc}
              type="application/pdf"
              className="h-full w-full rounded-lg bg-white"
            />
          ) : previewSrc ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg bg-white p-6 text-center">
              <p className="text-[13px] text-[#374151]">Preview not available for this file type.</p>
              <Button
                type="button"
                className="cursor-pointer"
                onClick={() => window.open(previewSrc, "_blank")}
              >
                Open in new tab
              </Button>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg bg-white p-6 text-center">
              <p className="text-[13px] text-[#6B7280]">
                No file content stored for this document.
              </p>
            </div>
          )}
        </div>
      </div>
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
