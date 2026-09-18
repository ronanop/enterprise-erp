"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Video,
} from "lucide-react";

import {
  formatPostedOn,
  interviewTimeWindow,
} from "@/components/hr/recruitment/dashboard/dashboard-model";
import { VerticalKebab } from "@/components/hr/recruitment/dashboard/data-table";
import { InitialsAvatar } from "@/components/hr/recruitment/dashboard/status-badge";
import { EmsPagination } from "@/components/hr/workforce/ems-primitives";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import type {
  AtsCandidate,
  AtsInterview,
  InterviewRound,
  JobOpening,
} from "@/types/recruitment-ats";
import { INTERVIEW_ROUND_LABELS } from "@/types/recruitment-ats";
import { cn } from "@/lib/utils";

const PAGE = 10;

type StatusTab = "all" | "scheduled" | "completed" | "rescheduled" | "cancelled";

type Filters = {
  query: string;
  status: string;
  round: string;
  recruiter: string;
  dateFrom: string;
  dateTo: string;
};

const EMPTY: Filters = {
  query: "",
  status: "all",
  round: "all",
  recruiter: "all",
  dateFrom: "",
  dateTo: "",
};

const ROUND_OPTIONS = [
  { value: "all", label: "All Interview Types" },
  { value: "round_1", label: "Round 1" },
  { value: "round_2", label: "Round 2" },
  { value: "hr", label: "HR Discussion" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "cancelled", label: "Cancelled" },
];

function roundBadge(round: InterviewRound | string): { label: string; tone: string } {
  switch (round) {
    case "round_1":
      return { label: "Technical", tone: "bg-[#F5F3FF] text-[#7C3AED]" };
    case "round_2":
      return { label: "Manager Round", tone: "bg-[#FFF4E5] text-[#FF8904]" };
    case "hr":
      return { label: "HR Round", tone: "bg-[#F5F3FF] text-[#7C3AED]" };
    default:
      return {
        label: INTERVIEW_ROUND_LABELS[round as InterviewRound] ?? String(round),
        tone: "bg-[#F3F4F6] text-[#6B7280]",
      };
  }
}

function statusBadge(status: AtsInterview["status"]): { label: string; tone: string } {
  switch (status) {
    case "scheduled":
      return { label: "Scheduled", tone: "bg-[#F5F3FF] text-[#7C3AED]" };
    case "completed":
      return { label: "Completed", tone: "bg-[#ECFDF5] text-[#00A866]" };
    case "cancelled":
      return { label: "Cancelled", tone: "bg-[#FFF1F2] text-[#F43F5E]" };
    case "rescheduled":
      return { label: "Rescheduled", tone: "bg-[#FFF4E5] text-[#FF8904]" };
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function feedbackBadge(interview: AtsInterview): { label: string; tone: string } | null {
  if (interview.status !== "completed") return null;
  const rec = interview.recommendation;
  const rating = interview.rating;
  if (rec === "selected" && rating >= 4) {
    return { label: "Excellent", tone: "bg-[#ECFDF5] text-[#00A866]" };
  }
  if (rec === "selected") {
    return { label: "Good", tone: "bg-[#ECFDF5] text-[#059669]" };
  }
  if (rec === "hold") {
    return { label: "Fair", tone: "bg-[#FFF4E5] text-[#FF8904]" };
  }
  if (rec === "rejected") {
    return { label: "Poor", tone: "bg-[#FFF1F2] text-[#F43F5E]" };
  }
  if (interview.feedback?.trim()) {
    return { label: "Recorded", tone: "bg-[#F3F4F6] text-[#6B7280]" };
  }
  return null;
}

function inDateRange(date: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return true;
  if (from) {
    const f = new Date(`${from}T00:00:00`).getTime();
    if (t < f) return false;
  }
  if (to) {
    const end = new Date(`${to}T23:59:59`).getTime();
    if (t > end) return false;
  }
  return true;
}

export function InterviewsPanel({
  interviews,
  candidates,
  jobs,
  onSchedule,
  onOutcome,
}: {
  interviews: AtsInterview[];
  candidates: AtsCandidate[];
  jobs: JobOpening[];
  onSchedule: () => void;
  onOutcome: (interview: AtsInterview) => void;
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const candById = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const recruiterOptions = useMemo(() => {
    const names = new Set<string>();
    for (const i of interviews) {
      if (i.interviewer?.trim()) names.add(i.interviewer.trim());
      for (const n of i.participantNames ?? []) {
        if (n.trim()) names.add(n.trim());
      }
    }
    return [
      { value: "all", label: "All Recruiters" },
      ...[...names].sort().map((n) => ({ value: n, label: n })),
    ];
  }, [interviews]);

  const counts = useMemo(() => {
    const base = interviews.filter((i) => matchesFilters(i, filters, candById, jobById, "all"));
    return {
      all: base.length,
      scheduled: base.filter((i) => i.status === "scheduled").length,
      completed: base.filter((i) => i.status === "completed").length,
      rescheduled: base.filter((i) => i.status === "rescheduled").length,
      cancelled: base.filter((i) => i.status === "cancelled").length,
    };
  }, [interviews, filters, candById, jobById]);

  const filtered = useMemo(
    () => interviews.filter((i) => matchesFilters(i, filters, candById, jobById, statusTab)),
    [interviews, filters, candById, jobById, statusTab],
  );

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE;
    return filtered.slice(start, start + PAGE);
  }, [filtered, page]);

  const allPageSelected =
    pageRows.length > 0 && pageRows.every((i) => selected.has(i.id));

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function resetFilters() {
    setFilters(EMPTY);
    setStatusTab("all");
    setPage(1);
  }

  const statusTabs: { id: StatusTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "scheduled", label: "Scheduled", count: counts.scheduled },
    { id: "completed", label: "Completed", count: counts.completed },
    { id: "rescheduled", label: "Rescheduled", count: counts.rescheduled },
    { id: "cancelled", label: "Cancelled", count: counts.cancelled },
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[22px] font-semibold tracking-tight text-[#111827]">Interviews</h2>
        <Button
          type="button"
          size="sm"
          className="h-9 cursor-pointer rounded-full bg-[#7C3AED] px-3.5 text-[13px] text-white hover:bg-[#6D28D9]"
          onClick={onSchedule}
        >
          <Plus className="size-3.5" strokeWidth={2} />
          Schedule Interview
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-[12px] border border-[#EEEFF3] bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[#9CA3AF]" />
          <Input
            value={filters.query}
            onChange={(e) => updateFilter("query", e.target.value)}
            placeholder="Search by candidate, job, interviewer..."
            className="h-9 rounded-full border-[#E5E7EB] bg-white pl-9 text-[13px]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={filters.status}
            onChange={(v) => updateFilter("status", v)}
            options={STATUS_OPTIONS}
            className="w-[140px] [&_button]:h-9 [&_button]:rounded-full [&_button]:border-[#E5E7EB] [&_button]:bg-white [&_button]:text-[12px]"
          />
          <FilterSelect
            value={filters.round}
            onChange={(v) => updateFilter("round", v)}
            options={ROUND_OPTIONS}
            className="w-[160px] [&_button]:h-9 [&_button]:rounded-full [&_button]:border-[#E5E7EB] [&_button]:bg-white [&_button]:text-[12px]"
          />
          <FilterSelect
            value={filters.recruiter}
            onChange={(v) => updateFilter("recruiter", v)}
            options={recruiterOptions}
            className="w-[150px] [&_button]:h-9 [&_button]:rounded-full [&_button]:border-[#E5E7EB] [&_button]:bg-white [&_button]:text-[12px]"
          />
          <label className="relative inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 text-[12px] text-[#374151]">
            <Calendar className="size-3.5 text-[#9CA3AF]" />
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
              className="w-[110px] cursor-pointer bg-transparent text-[12px] outline-none"
            />
            <span className="text-[#9CA3AF]">–</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
              className="w-[110px] cursor-pointer bg-transparent text-[12px] outline-none"
            />
          </label>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-[#7C3AED] hover:bg-[#F4EDFB]"
          >
            <RotateCcw className="size-3.5" strokeWidth={1.75} />
            Reset
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[#EEEFF3]">
        {statusTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setStatusTab(t.id);
              setPage(1);
            }}
            className={cn(
              "cursor-pointer border-b-2 px-3 py-1.5 text-[13px] font-medium transition-colors",
              statusTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-[#6B7280] hover:text-[#111827]",
            )}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[12px] border border-[#EEEFF3] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">No interviews match these filters</p>
            <Button size="sm" className="cursor-pointer bg-[#7C3AED] text-white hover:bg-[#6D28D9]" onClick={onSchedule}>
              Schedule Interview
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left">
                <thead>
                  <tr className="border-b border-[#F3F4F6] text-[11px] font-medium tracking-wide text-[#9CA3AF] uppercase">
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        className="cursor-pointer accent-primary"
                        checked={allPageSelected}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            for (const row of pageRows) {
                              if (e.target.checked) next.add(row.id);
                              else next.delete(row.id);
                            }
                            return next;
                          });
                        }}
                      />
                    </th>
                    <th className="px-3 py-2 font-medium">Candidate</th>
                    <th className="px-3 py-2 font-medium">Job Title</th>
                    <th className="px-3 py-2 font-medium">Interview Type</th>
                    <th className="px-3 py-2 font-medium">Interviewers</th>
                    <th className="px-3 py-2 font-medium">Date & Time</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Feedback</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((interview, idx) => {
                    const cand = candById.get(interview.candidateId);
                    const job = jobById.get(interview.jobId);
                    const type = roundBadge(interview.round || interview.interviewType);
                    const st = statusBadge(interview.status);
                    const fb = feedbackBadge(interview);
                    const names =
                      interview.participantNames?.length > 0
                        ? interview.participantNames
                        : interview.interviewer
                          ? [interview.interviewer]
                          : [];
                    return (
                      <tr
                        key={interview.id}
                        className="border-b border-[#F8F8FA] text-[12px] text-[#374151] last:border-0 transition-colors duration-150 hover:bg-[#FAFAFC]"
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="cursor-pointer accent-primary"
                            checked={selected.has(interview.id)}
                            onChange={(e) => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(interview.id);
                                else next.delete(interview.id);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2.5">
                            <InitialsAvatar name={cand?.fullName ?? "?"} toneIndex={idx} />
                            <span className="min-w-0">
                              <span className="block font-semibold text-[#111827]">
                                {cand?.fullName ?? "—"}
                              </span>
                              <span className="block truncate text-[11px] text-[#9CA3AF]">
                                {cand?.email || interview.interviewCode}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{job?.title ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
                              type.tone,
                            )}
                          >
                            {type.label}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <InterviewerStack names={names} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="block font-medium text-[#111827]">
                            {formatPostedOn(interview.date)}
                          </span>
                          <span className="block text-[11px] text-[#9CA3AF]">
                            {interviewTimeWindow(interview.time)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              st.tone,
                            )}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {fb ? (
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                fb.tone,
                              )}
                            >
                              {fb.label}
                            </span>
                          ) : (
                            <span className="text-[#9CA3AF]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            {interview.meetingLink ? (
                              <a
                                href={interview.meetingLink}
                                target="_blank"
                                rel="noreferrer"
                                title="Join meeting"
                                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-[#EEEFF3] text-[#6B7280] transition-colors hover:bg-[#F8F8FC] hover:text-[#111827]"
                              >
                                <Video className="size-3.5" />
                              </a>
                            ) : (
                              <span
                                title="No meeting link"
                                className="inline-flex size-7 items-center justify-center rounded-md border border-[#EEEFF3] text-[#D1D5DB]"
                              >
                                <Video className="size-3.5" />
                              </span>
                            )}
                            <button
                              type="button"
                              title="Record outcome"
                              className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-[#EEEFF3] text-[#6B7280] transition-colors hover:bg-[#F8F8FC] hover:text-[#111827]"
                              onClick={() => onOutcome(interview)}
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <VerticalKebab
                              items={[
                                { label: "Record outcome", onClick: () => onOutcome(interview) },
                                ...(interview.meetingLink
                                  ? [
                                      {
                                        label: "Open meeting link",
                                        onClick: () =>
                                          window.open(interview.meetingLink, "_blank", "noopener"),
                                      },
                                    ]
                                  : []),
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2">
              <EmsPagination
                page={page}
                pageSize={PAGE}
                total={filtered.length}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InterviewerStack({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-[#9CA3AF]">—</span>;
  const shown = names.slice(0, 2);
  const extra = names.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((name, i) => (
        <span
          key={`${name}-${i}`}
          className={cn("relative inline-flex", i > 0 && "-ml-1.5")}
          style={{ zIndex: shown.length - i }}
        >
          <InitialsAvatar name={name} toneIndex={i + 2} />
        </span>
      ))}
      {extra > 0 ? (
        <span className="-ml-1.5 inline-flex size-7 items-center justify-center rounded-full border-2 border-white bg-[#F3F4F6] text-[10px] font-semibold text-[#6B7280]">
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

function matchesFilters(
  interview: AtsInterview,
  filters: Filters,
  candById: Map<string, AtsCandidate>,
  jobById: Map<string, JobOpening>,
  statusTab: StatusTab,
): boolean {
  if (statusTab !== "all" && interview.status !== statusTab) return false;
  if (filters.status !== "all" && interview.status !== filters.status) return false;
  if (filters.round !== "all" && (interview.round || interview.interviewType) !== filters.round) {
    return false;
  }
  if (filters.recruiter !== "all") {
    const names = [
      interview.interviewer,
      ...(interview.participantNames ?? []),
    ]
      .map((n) => n.trim())
      .filter(Boolean);
    if (!names.includes(filters.recruiter)) return false;
  }
  if (!inDateRange(interview.date, filters.dateFrom, filters.dateTo)) return false;
  const q = filters.query.trim().toLowerCase();
  if (!q) return true;
  const cand = candById.get(interview.candidateId);
  const job = jobById.get(interview.jobId);
  return [
    cand?.fullName,
    cand?.email,
    job?.title,
    interview.interviewer,
    ...(interview.participantNames ?? []),
    interview.interviewCode,
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}
