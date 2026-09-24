"use client";

import { useMemo, useState, type ReactNode } from "react";

import { HrAuthBanner } from "@/components/hr/hr-primitives";
import { DashboardChrome, ViewAllLink } from "@/components/hr/recruitment/dashboard/dashboard-chrome";
import {
  buildRecruitmentDashboardModel,
  formatPostedOn,
  type KpiKey,
  type TrendRangeKey,
} from "@/components/hr/recruitment/dashboard/dashboard-model";
import { DataTable, VerticalKebab } from "@/components/hr/recruitment/dashboard/data-table";
import { InterviewCard } from "@/components/hr/recruitment/dashboard/interview-card";
import { KpiCard } from "@/components/hr/recruitment/dashboard/kpi-card";
import { PipelineCard } from "@/components/hr/recruitment/dashboard/pipeline-card";
import { InitialsAvatar, JobStatusBadge, StageBadge } from "@/components/hr/recruitment/dashboard/status-badge";
import { TrendChart } from "@/components/hr/recruitment/dashboard/trend-chart";
import type { AtsDirectory } from "@/services/recruitment-ats-service";
import type {
  AtsCandidate,
  AtsInterview,
  JobOpening,
  PipelineStage,
} from "@/types/recruitment-ats";

export type RecruitmentOverviewHandlers = {
  onCreateJob: () => void;
  onAddCandidate: () => void;
  onImport: () => void;
  onExport: () => void;
  onScheduleInterview: () => void;
  onGenerateOffer: () => void;
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
  /** When true, render dashboard home panels (pipeline/trend/tables). */
  showHome?: boolean;
}) {
  const [trendRange, setTrendRange] = useState<TrendRangeKey>("last_6");

  const model = useMemo(
    () => (dir ? buildRecruitmentDashboardModel(dir, { trendRange }) : null),
    [dir, trendRange],
  );

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
        onAddCandidate={handlers.onAddCandidate}
        onScheduleInterview={handlers.onScheduleInterview}
        onGenerateOffer={handlers.onGenerateOffer}
      />

      {authBlocked ? <HrAuthBanner /> : null}

      {loading && !dir ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-[12px] border border-[#EEEFF3] bg-white" />
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
          <>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <PipelineCard
                stages={model?.pipeline ?? []}
                onStageClick={(stage) => handlers.onViewPipeline(stage)}
              />
              <TrendChart data={model?.trend ?? []} range={trendRange} onRangeChange={setTrendRange} />
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_1.05fr_0.9fr]">
              <section className="rounded-[12px] border border-[#EEEFF3] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold tracking-tight text-[#111827]">Recent Job Openings</h2>
                  <ViewAllLink onClick={handlers.onViewJobs} label="View All →" />
                </div>
                <DataTable
                  headers={["Job Title", "Department", "Openings", "Applicants", "Status", "Posted On", ""]}
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

              <section className="rounded-[12px] border border-[#EEEFF3] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold tracking-tight text-[#111827]">Recent Candidates</h2>
                  <ViewAllLink onClick={handlers.onViewCandidates} label="View All →" />
                </div>
                <DataTable
                  headers={["Name", "Position", "Stage", "Applied On", ""]}
                  empty="No candidates yet"
                  rows={(model?.recentCandidates ?? []).map((row, i) => [
                    <span key="n" className="flex items-center gap-2">
                      <InitialsAvatar name={row.candidate.fullName} toneIndex={i} />
                      <span className="font-medium text-[#111827]">{row.candidate.fullName}</span>
                    </span>,
                    row.jobTitle,
                    <StageBadge key="st" stage={row.stage} label={row.stageLabel} />,
                    row.appliedOn,
                    <VerticalKebab
                      key="m"
                      items={[
                        { label: "View", onClick: () => handlers.onOpenCandidate(row.candidate) },
                        { label: "Edit", onClick: () => handlers.onEditCandidate(row.candidate) },
                      ]}
                    />,
                  ])}
                />
              </section>

              <section className="rounded-[12px] border border-[#EEEFF3] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold tracking-tight text-[#111827]">Upcoming Interviews</h2>
                  <ViewAllLink onClick={handlers.onViewInterviews} />
                </div>
                {(model?.upcomingInterviews.length ?? 0) === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No upcoming interviews</p>
                ) : (
                  <div className="space-y-2.5">
                    {(model?.upcomingInterviews ?? []).map((row) => (
                      <InterviewCard
                        key={row.interview.id}
                        row={row}
                        onOpen={() => handlers.onOpenInterview(row.interview)}
                        onMenu={[
                          { label: "View details", onClick: () => handlers.onOpenInterview(row.interview) },
                          { label: "All interviews", onClick: handlers.onViewInterviews },
                        ]}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )
      ) : null}

      {children}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading recruitment dashboard">
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="h-[280px] animate-pulse rounded-[12px] border border-[#EEEFF3] bg-white" />
        <div className="h-[280px] animate-pulse rounded-[12px] border border-[#EEEFF3] bg-white" />
      </div>
    </div>
  );
}
