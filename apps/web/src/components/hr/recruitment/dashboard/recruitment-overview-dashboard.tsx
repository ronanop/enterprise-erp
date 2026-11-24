"use client";

import { useMemo, type ReactNode } from "react";

import { HrAuthBanner } from "@/components/hr/hr-primitives";
import { DashboardChrome, ViewAllLink } from "@/components/hr/recruitment/dashboard/dashboard-chrome";
import {
  buildRecruitmentDashboardModel,
  formatPostedOn,
  type KpiKey,
} from "@/components/hr/recruitment/dashboard/dashboard-model";
import { DataTable, VerticalKebab } from "@/components/hr/recruitment/dashboard/data-table";
import { InterviewCard } from "@/components/hr/recruitment/dashboard/interview-card";
import { KpiCard } from "@/components/hr/recruitment/dashboard/kpi-card";
import { PipelineCard } from "@/components/hr/recruitment/dashboard/pipeline-card";
import { JobStatusBadge } from "@/components/hr/recruitment/dashboard/status-badge";
import type { AtsDirectory } from "@/services/recruitment-ats-service";
import type {
  AtsCandidate,
  AtsInterview,
  JobOpening,
  PipelineStage,
} from "@/types/recruitment-ats";

export type RecruitmentOverviewHandlers = {
  onCreateJob: () => void;
  onAddCandidate?: () => void;
  onImport: () => void;
  onExport: () => void;
  onScheduleInterview: () => void;
  onOpenCareers?: () => void;
  onRefresh?: () => void;
  onViewJobs: () => void;
  onViewCandidates: () => void;
  onViewInterviews: () => void;
  onViewOffers: () => void;
  onViewPipeline: (stage?: PipelineStage) => void;
  onOpenJob: (job: JobOpening) => void;
  onEditJob: (job: JobOpening) => void;
  onOpenCandidate: (candidate: AtsCandidate) => void;
  onEditCandidate: (candidate: AtsCandidate) => void;
  onOpenInterview: (interview: AtsInterview) => void;
};

export function RecruitmentOverviewDashboard({
  dir,
  loading,
  authBlocked,
  handlers,
  tabsSlot,
  children,
  showHome = true,
}: {
  dir: AtsDirectory | null;
  loading: boolean;
  authBlocked: boolean;
  handlers: RecruitmentOverviewHandlers;
  /** Module tabs rendered under the chrome (Jobs, Candidates, Pipeline, …) */
  tabsSlot?: ReactNode;
  /** Tab body content (jobs table, pipeline, …). When set with showHome=false, replaces home panels. */
  children?: ReactNode;
  /** When true, render dashboard home panels (pipeline / jobs / interviews). */
  showHome?: boolean;
}) {
  const model = useMemo(() => (dir ? buildRecruitmentDashboardModel(dir) : null), [dir]);

  function handleKpi(key: KpiKey) {
    switch (key) {
      case "openPositions":
        handlers.onViewJobs();
        return;
      case "shortlisted":
      case "backedOut":
        handlers.onViewPipeline();
        return;
      case "interviewScheduled":
        handlers.onViewInterviews();
        return;
      case "offersSent":
      case "offersAccepted":
        handlers.onViewOffers();
        return;
      default: {
        const _exhaustive: never = key;
        return _exhaustive;
      }
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <DashboardChrome
        onCreateJob={handlers.onCreateJob}
        onOpenCareers={handlers.onOpenCareers}
        onRefresh={handlers.onRefresh}
        refreshing={loading}
      />

      {authBlocked ? <HrAuthBanner /> : null}

      {loading && !dir ? (
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
          aria-busy="true"
          aria-label="Loading KPIs"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[12px] border border-[#EEEFF3] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div className="h-2.5 w-16 animate-pulse rounded bg-[#E5E7EB]" />
              <div className="mt-2.5 h-5 w-10 animate-pulse rounded bg-[#E5E7EB]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {(model?.kpis ?? []).map((kpi) => (
            <KpiCard key={kpi.key} kpi={kpi} onClick={() => handleKpi(kpi.key)} />
          ))}
        </div>
      )}

      {tabsSlot ? <div className="pt-1">{tabsSlot}</div> : null}

      {showHome ? (
        loading && !dir ? (
          <DashboardSkeleton />
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="flex min-h-0 flex-col gap-3">
              <PipelineCard
                stages={model?.pipeline ?? []}
                onStageClick={(stage) => handlers.onViewPipeline(stage)}
              />

              <section className="rounded-[12px] border border-[#EEEFF3] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-semibold tracking-tight text-[#111827]">
                      Recent Job Openings
                    </h2>
                    <p className="mt-0.5 text-[12px] text-[#9CA3AF]">
                      Latest roles and applicant volume
                    </p>
                  </div>
                  <ViewAllLink onClick={handlers.onViewJobs} label="View All →" />
                </div>
                <DataTable
                  headers={[
                    "Job Title",
                    "Department",
                    "Openings",
                    "Applicants",
                    "Status",
                    "Posted On",
                    "",
                  ]}
                  empty="No job openings yet"
                  rows={(model?.recentJobs ?? []).map((row) => [
                    <span key="t" className="font-medium text-[#111827]">
                      {row.job.title}
                    </span>,
                    row.job.department,
                    String(row.job.positions),
                    String(row.applicants),
                    <JobStatusBadge
                      key="s"
                      status={row.job.status}
                      filled={row.job.filled}
                      positions={row.job.positions}
                    />,
                    formatPostedOn(row.job.createdAt),
                    <VerticalKebab
                      key="m"
                      items={[
                        { label: "View", onClick: () => handlers.onOpenJob(row.job) },
                        { label: "Edit", onClick: () => handlers.onEditJob(row.job) },
                      ]}
                    />,
                  ])}
                />
              </section>
            </div>

            <section className="flex h-full min-h-[280px] flex-col rounded-[12px] border border-[#EEEFF3] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-[#111827]">
                    Upcoming Interviews
                  </h2>
                  <p className="mt-0.5 text-[12px] text-[#9CA3AF]">
                    Next scheduled conversations
                  </p>
                </div>
                <ViewAllLink onClick={handlers.onViewInterviews} />
              </div>
              {(model?.upcomingInterviews.length ?? 0) === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] bg-[#FAFBFC] px-4 py-10 text-center">
                  <p className="text-[13px] font-medium text-[#374151]">No upcoming interviews</p>
                  <p className="mt-1 text-[12px] text-[#9CA3AF]">
                    Schedule from a candidate or the Interviews tab
                  </p>
                  <button
                    type="button"
                    className="mt-4 cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground transition-opacity duration-150 hover:opacity-90"
                    onClick={handlers.onScheduleInterview}
                  >
                    Schedule interview
                  </button>
                </div>
              ) : (
                <div className="erp-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-0.5">
                  {(model?.upcomingInterviews ?? []).map((row) => (
                    <InterviewCard
                      key={row.interview.id}
                      row={row}
                      onOpen={() => handlers.onOpenInterview(row.interview)}
                      onMenu={[
                        {
                          label: "View details",
                          onClick: () => handlers.onOpenInterview(row.interview),
                        },
                        { label: "All interviews", onClick: handlers.onViewInterviews },
                      ]}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )
      ) : null}

      {children}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-3 xl:grid-cols-[1.15fr_0.85fr]"
      aria-busy="true"
      aria-label="Loading recruitment dashboard"
    >
      <div className="flex flex-col gap-3">
        <div className="h-[280px] animate-pulse rounded-[12px] border border-[#EEEFF3] bg-white" />
        <div className="h-[200px] animate-pulse rounded-[12px] border border-[#EEEFF3] bg-white" />
      </div>
      <div className="h-[500px] animate-pulse rounded-[12px] border border-[#EEEFF3] bg-white" />
    </div>
  );
}
