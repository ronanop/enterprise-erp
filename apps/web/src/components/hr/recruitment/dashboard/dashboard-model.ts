import { PIPELINE_STAGES } from "@/config/pipeline-config";
import { computeAtsStats, type AtsDirectory } from "@/services/recruitment-ats-service";
import type {
  AtsCandidate,
  AtsInterview,
  JobOpening,
  JobStatus,
  PipelineApplication,
  PipelineStage,
} from "@/types/recruitment-ats";

export type TrendRangeKey = "last_3" | "last_6" | "last_12";

export type KpiKey =
  | "openPositions"
  | "shortlisted"
  | "interviewScheduled"
  | "offersSent"
  | "offersAccepted"
  | "backedOut";

export type DashboardKpi = {
  key: KpiKey;
  title: string;
  value: string;
};

export type PipelineRow = {
  id: PipelineStage;
  label: string;
  count: number;
  pct: number;
};

export type TrendPoint = {
  month: string;
  fullLabel: string;
  value: number;
};

export type RecentJobRow = {
  job: JobOpening;
  applicants: number;
};

export type RecentCandidateRow = {
  candidate: AtsCandidate;
  jobTitle: string;
  stage: PipelineStage;
  stageLabel: string;
  appliedOn: string;
};

export type UpcomingInterviewRow = {
  interview: AtsInterview;
  candidateName: string;
  title: string;
  timeLabel: string;
  day: string;
  month: string;
};

export type SearchHit = {
  kind: "job" | "candidate" | "interview";
  id: string;
  title: string;
  subtitle: string;
};

export type RecruitmentDashboardModel = {
  kpis: DashboardKpi[];
  pipeline: PipelineRow[];
  trend: TrendPoint[];
  recentJobs: RecentJobRow[];
  recentCandidates: RecentCandidateRow[];
  upcomingInterviews: UpcomingInterviewRow[];
  searchHits: SearchHit[];
};

export const TREND_RANGE_OPTIONS: { value: TrendRangeKey; label: string }[] = [
  { value: "last_3", label: "Last 3 Months" },
  { value: "last_6", label: "Last 6 Months" },
  { value: "last_12", label: "Last 12 Months" },
];

export function formatHeaderDate(d: Date): string {
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const mon = d.toLocaleDateString("en-GB", { month: "short" });
  return `${weekday}, ${d.getDate()} ${mon} ${d.getFullYear()}`;
}

export function formatPostedOn(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mon = d.toLocaleDateString("en-GB", { month: "short" });
  return `${dd} ${mon} ${d.getFullYear()}`;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

export function jobStatusLabel(status: JobStatus): string {
  switch (status) {
    case "open":
      return "Active";
    case "draft":
      return "Draft";
    case "on_hold":
      return "On Hold";
    case "closed":
      return "Closed";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function dashboardStageLabel(stage: PipelineStage): string {
  switch (stage) {
    case "sourced":
      return "Applied";
    case "screening":
      return "Screening";
    case "interview_round_1":
      return "Interview Round 1";
    case "interview_round_2":
      return "Interview Round 2";
    case "hr_discussion":
      return "HR Discussion";
    case "background_check":
      return "Background Check";
    case "offer_sent":
      return "Offer Sent";
    case "offer_accepted":
      return "Offer Accepted";
    default: {
      const _exhaustive: never = stage;
      return _exhaustive;
    }
  }
}

export function interviewTitle(interview: AtsInterview): string {
  switch (interview.round) {
    case "round_1":
      return interview.interviewType === "hr" ? "HR Discussion" : "Technical Interview";
    case "round_2":
      return "Manager Interview";
    case "hr":
      return "HR Discussion";
    default: {
      const _exhaustive: never = interview.round;
      return _exhaustive;
    }
  }
}

function parseTimeParts(time: string): { hours: number; minutes: number } | null {
  const raw = time.trim();
  if (!raw) return null;
  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!ampm) return null;
  let hours = Number(ampm[1]);
  const minutes = Number(ampm[2]);
  const mer = ampm[3]?.toLowerCase();
  if (mer === "pm" && hours < 12) hours += 12;
  if (mer === "am" && hours === 12) hours = 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return { hours, minutes };
}

function formatClock(hours: number, minutes: number): string {
  const mer = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${String(h).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${mer}`;
}

export function interviewTimeWindow(time: string): string {
  const parsed = parseTimeParts(time);
  if (!parsed) return time || "—";
  const endHours = (parsed.hours + 1) % 24;
  return `${formatClock(parsed.hours, parsed.minutes)} – ${formatClock(endHours, parsed.minutes)}`;
}

function trendMonths(key: TrendRangeKey): number {
  switch (key) {
    case "last_3":
      return 3;
    case "last_6":
      return 6;
    case "last_12":
      return 12;
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

export function monthlyTrend(dates: string[], range: TrendRangeKey, now = new Date()): TrendPoint[] {
  const months = trendMonths(range);
  const points: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.toLocaleDateString("en-GB", { month: "short" });
    const value = dates.filter((iso) => {
      const t = new Date(iso);
      return Number.isFinite(t.getTime()) && t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth();
    }).length;
    points.push({ month, fullLabel: `${month} ${d.getFullYear()}`, value });
  }
  return points;
}

function primaryApp(
  candidateId: string,
  apps: PipelineApplication[],
): PipelineApplication | undefined {
  return (
    apps.find((a) => a.candidateId === candidateId && a.status === "active") ??
    apps.find((a) => a.candidateId === candidateId)
  );
}

function countBy<T>(rows: T[], pred: (row: T) => boolean): number {
  return rows.filter(pred).length;
}

export function searchDirectory(dir: AtsDirectory, query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const jobs: SearchHit[] = dir.jobs
    .filter((j) => [j.title, j.department, j.jobCode].join(" ").toLowerCase().includes(q))
    .slice(0, 5)
    .map((j) => ({
      kind: "job" as const,
      id: j.id,
      title: j.title,
      subtitle: `${j.department} · ${jobStatusLabel(j.status)}`,
    }));
  const candidates: SearchHit[] = dir.candidates
    .filter((c) => [c.fullName, c.email, c.candidateCode].join(" ").toLowerCase().includes(q))
    .slice(0, 5)
    .map((c) => ({
      kind: "candidate" as const,
      id: c.id,
      title: c.fullName,
      subtitle: c.email || c.candidateCode,
    }));
  const interviews: SearchHit[] = dir.interviews
    .filter((i) => {
      const cand = dir.candidates.find((c) => c.id === i.candidateId);
      return [cand?.fullName, i.interviewCode, interviewTitle(i)].join(" ").toLowerCase().includes(q);
    })
    .slice(0, 4)
    .map((i) => {
      const cand = dir.candidates.find((c) => c.id === i.candidateId);
      return {
        kind: "interview" as const,
        id: i.id,
        title: interviewTitle(i),
        subtitle: cand?.fullName ?? i.interviewCode,
      };
    });
  return [...jobs, ...candidates, ...interviews].slice(0, 10);
}

export function buildRecruitmentDashboardModel(
  dir: AtsDirectory,
  opts: { trendRange: TrendRangeKey; query: string; now?: Date },
): RecruitmentDashboardModel {
  const now = opts.now ?? new Date();
  const stats = computeAtsStats(dir);

  const kpis: DashboardKpi[] = [
    {
      key: "openPositions",
      title: "Open Positions",
      value: String(stats.openPositions),
    },
    {
      key: "shortlisted",
      title: "Shortlisted",
      value: String(stats.shortlisted),
    },
    {
      key: "interviewScheduled",
      title: "Interview Scheduled",
      value: String(stats.interviewScheduled),
    },
    {
      key: "offersSent",
      title: "Offers Sent",
      value: String(stats.offersSent),
    },
    {
      key: "offersAccepted",
      title: "Offers Accepted",
      value: String(stats.offersAccepted),
    },
    {
      key: "backedOut",
      title: "Backed Out",
      value: String(stats.backedOut),
    },
  ];

  const maxPipeline = Math.max(
    2,
    ...PIPELINE_STAGES.map((s) => countBy(dir.applications, (a) => a.stage === s.id)),
  );
  const pipeline: PipelineRow[] = PIPELINE_STAGES.map((s) => {
    const count = countBy(dir.applications, (a) => a.stage === s.id);
    return {
      id: s.id,
      label: s.label,
      count,
      pct: Math.round((count / maxPipeline) * 100),
    };
  });

  const jobById = new Map(dir.jobs.map((j) => [j.id, j]));
  const candById = new Map(dir.candidates.map((c) => [c.id, c]));

  const recentJobs: RecentJobRow[] = [...dir.jobs]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 5)
    .map((job) => ({
      job,
      applicants: countBy(dir.applications, (a) => a.jobId === job.id),
    }));

  const recentCandidates: RecentCandidateRow[] = [...dir.candidates]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 5)
    .map((candidate) => {
      const app = primaryApp(candidate.id, dir.applications);
      const stage = app?.stage ?? "sourced";
      return {
        candidate,
        jobTitle: (app ? jobById.get(app.jobId)?.title : undefined) ?? "—",
        stage,
        stageLabel: dashboardStageLabel(stage),
        appliedOn: formatPostedOn(app?.appliedAt ?? candidate.createdAt),
      };
    });

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const upcomingInterviews: UpcomingInterviewRow[] = [...dir.interviews]
    .filter((i) => i.status === "scheduled")
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .filter((i) => {
      const d = new Date(i.date);
      if (!Number.isFinite(d.getTime())) return true;
      d.setHours(0, 0, 0, 0);
      return d.getTime() >= today.getTime();
    })
    .slice(0, 3)
    .map((interview) => {
      const d = new Date(interview.date);
      const valid = Number.isFinite(d.getTime());
      return {
        interview,
        candidateName: candById.get(interview.candidateId)?.fullName ?? "—",
        title: interviewTitle(interview),
        timeLabel: interviewTimeWindow(interview.time),
        day: valid ? String(d.getDate()).padStart(2, "0") : "—",
        month: valid ? d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase() : "",
      };
    });

  return {
    kpis,
    pipeline,
    trend: monthlyTrend(
      dir.applications.map((a) => a.appliedAt),
      opts.trendRange,
      now,
    ),
    recentJobs,
    recentCandidates,
    upcomingInterviews,
    searchHits: searchDirectory(dir, opts.query),
  };
}
