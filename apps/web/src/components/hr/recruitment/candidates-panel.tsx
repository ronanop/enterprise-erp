"use client";

import { useMemo, useState } from "react";
import {
  Briefcase,
  Eye,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Target,
  UserRound,
} from "lucide-react";

import { CandidatePipelineStatusCell } from "@/components/hr/recruitment/candidate-pipeline-status-cell";
import { formatPostedOn } from "@/components/hr/recruitment/dashboard/dashboard-model";
import { InitialsAvatar } from "@/components/hr/recruitment/dashboard/status-badge";
import { SourceCell } from "@/components/hr/recruitment/source-brand-icon";
import { EmsPagination } from "@/components/hr/workforce/ems-primitives";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { PIPELINE_STAGES } from "@/config/pipeline-config";
import type {
  AtsCandidate,
  JobOpening,
  PipelineApplication,
  PipelineStage,
} from "@/types/recruitment-ats";
import { SOURCE_LABELS } from "@/types/recruitment-ats";
import { cn } from "@/lib/utils";

const PAGE = 10;

type CandFilterState = {
  query: string;
  source: string;
  jobId: string;
  stage: string;
  experience: string;
  location: string;
};

const EMPTY: CandFilterState = {
  query: "",
  source: "all",
  jobId: "all",
  stage: "all",
  experience: "all",
  location: "all",
};

const EXPERIENCE_OPTIONS = [
  { value: "all", label: "Experience" },
  { value: "0-2", label: "0–2 years" },
  { value: "2-5", label: "2–5 years" },
  { value: "5-8", label: "5–8 years" },
  { value: "8+", label: "8+ years" },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "Source" },
  ...Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label })),
];

function matchesExperience(years: number, bucket: string): boolean {
  switch (bucket) {
    case "all":
      return true;
    case "0-2":
      return years >= 0 && years < 2;
    case "2-5":
      return years >= 2 && years < 5;
    case "5-8":
      return years >= 5 && years < 8;
    case "8+":
      return years >= 8;
    default:
      return true;
  }
}

function primaryApp(
  candidateId: string,
  apps: PipelineApplication[],
): PipelineApplication | null {
  return (
    apps.find((a) => a.candidateId === candidateId && a.status === "active") ??
    apps.find((a) => a.candidateId === candidateId) ??
    null
  );
}

export function CandidatesPanel({
  candidates,
  jobs,
  applications,
  onAdd,
  onView,
  onEdit,
  onChangeStage,
}: {
  candidates: AtsCandidate[];
  jobs: JobOpening[];
  applications: PipelineApplication[];
  onAdd: () => void;
  onView: (c: AtsCandidate) => void;
  onEdit: (c: AtsCandidate) => void;
  onChangeStage: (applicationId: string, stage: PipelineStage) => void;
}) {
  const [filters, setFilters] = useState<CandFilterState>(EMPTY);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<"fullName" | "candidateCode" | "createdAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const positionOptions = useMemo(
    () => [
      { value: "all", label: "Position" },
      ...jobs.map((j) => ({ value: j.id, label: j.title })),
    ],
    [jobs],
  );

  const locationOptions = useMemo(() => {
    const set = new Set(candidates.map((c) => c.state || c.location).filter(Boolean));
    return [
      { value: "all", label: "Location" },
      ...[...set].sort().map((v) => ({ value: v, label: v })),
    ];
  }, [candidates]);

  const stageOptions = useMemo(
    () => [
      { value: "all", label: "Status" },
      ...PIPELINE_STAGES.map((s) => ({ value: s.id, label: s.label })),
      { value: "hired", label: "Hired" },
      { value: "rejected", label: "Rejected" },
      { value: "backed_out", label: "Backed Out" },
      { value: "offer_declined", label: "Offer Declined" },
      { value: "none", label: "Not applied" },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const rows = candidates.filter((c) => {
      const app = primaryApp(c.id, applications);
      if (filters.source !== "all" && c.source !== filters.source) return false;
      if (filters.jobId !== "all" && app?.jobId !== filters.jobId) return false;
      if (filters.location !== "all") {
        const loc = c.state || c.location;
        if (loc !== filters.location) return false;
      }
      if (!matchesExperience(c.experienceYears, filters.experience)) return false;
      if (filters.stage !== "all") {
        if (filters.stage === "none") {
          if (app) return false;
        } else if (["hired", "rejected", "backed_out", "offer_declined"].includes(filters.stage)) {
          if (app?.status !== filters.stage) return false;
        } else if (!app || app.stage !== filters.stage || app.status !== "active") {
          return false;
        }
      }
      if (!q) return true;
      return [c.candidateCode, c.fullName, c.email, c.phone, c.alternatePhone]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    const dirMul = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? "")) * dirMul);
  }, [candidates, applications, filters, sortKey, sortDir]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE;
    return filtered.slice(start, start + PAGE);
  }, [filtered, page]);

  const allPageSelected =
    pageRows.length > 0 && pageRows.every((c) => selected.has(c.id));

  function updateFilter<K extends keyof CandFilterState>(key: K, value: CandFilterState[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function resetFilters() {
    setFilters(EMPTY);
    setPage(1);
  }

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2.5 rounded-[12px] border border-[#EEEFF3] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[#9CA3AF]" />
          <Input
            value={filters.query}
            onChange={(e) => updateFilter("query", e.target.value)}
            placeholder="Search by name, email, phone, or ID..."
            className="h-9 rounded-full border-[#E5E7EB] bg-white pl-9 text-[13px]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IconFilter
            icon={UserRound}
            value={filters.source}
            onChange={(v) => updateFilter("source", v)}
            options={SOURCE_OPTIONS}
          />
          <IconFilter
            icon={Briefcase}
            value={filters.jobId}
            onChange={(v) => updateFilter("jobId", v)}
            options={positionOptions}
            widthClass="w-[150px]"
          />
          <IconFilter
            icon={Target}
            value={filters.stage}
            onChange={(v) => updateFilter("stage", v)}
            options={stageOptions}
            widthClass="w-[150px]"
          />
          <IconFilter
            icon={Briefcase}
            value={filters.experience}
            onChange={(v) => updateFilter("experience", v)}
            options={EXPERIENCE_OPTIONS}
          />
          <IconFilter
            icon={MapPin}
            value={filters.location}
            onChange={(v) => updateFilter("location", v)}
            options={locationOptions}
          />
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-[#7C3AED] hover:bg-[#F4EDFB]"
          >
            <RotateCcw className="size-3.5" strokeWidth={1.75} />
            Reset
          </button>
          <Button
            type="button"
            size="sm"
            className="h-9 cursor-pointer rounded-full bg-[#7C3AED] px-3.5 text-[12px] text-white hover:bg-[#6D28D9]"
            onClick={onAdd}
          >
            <Plus className="size-3.5" strokeWidth={2} />
            Add Candidate
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[12px] border border-[#EEEFF3] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">No candidates match these filters</p>
            <Button size="sm" className="cursor-pointer bg-[#7C3AED] text-white hover:bg-[#6D28D9]" onClick={onAdd}>
              Add Candidate
            </Button>
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-hidden">
              <table className="w-full table-auto text-left">
                <thead>
                  <tr className="border-b border-[#F3F4F6] text-[10px] font-medium tracking-wide text-[#9CA3AF] uppercase">
                    <th className="w-8 px-1.5 py-2.5">
                      <input
                        type="checkbox"
                        className="cursor-pointer accent-primary"
                        checked={allPageSelected}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            for (const c of pageRows) {
                              if (e.target.checked) next.add(c.id);
                              else next.delete(c.id);
                            }
                            return next;
                          });
                        }}
                      />
                    </th>
                    <SortTh
                      label="ID"
                      active={sortKey === "candidateCode"}
                      dir={sortDir}
                      onClick={() => toggleSort("candidateCode")}
                    />
                    <SortTh
                      label="Name"
                      active={sortKey === "fullName"}
                      dir={sortDir}
                      onClick={() => toggleSort("fullName")}
                    />
                    <th className="px-1.5 py-2.5 font-medium">Email</th>
                    <th className="px-1.5 py-2.5 font-medium">Phone</th>
                    <th className="px-1.5 py-2.5 font-medium">Source</th>
                    <th className="px-1.5 py-2.5 font-medium">Exp</th>
                    <th className="px-1.5 py-2.5 font-medium">Expected Salary</th>
                    <th className="px-1.5 py-2.5 font-medium">Applied For</th>
                    <th className="px-1.5 py-2.5 font-medium">Status</th>
                    <SortTh
                      label="Applied On"
                      active={sortKey === "createdAt"}
                      dir={sortDir}
                      onClick={() => toggleSort("createdAt")}
                    />
                    <th className="px-1.5 py-2.5 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((c, i) => {
                    const app = primaryApp(c.id, applications);
                    const job = app ? jobById.get(app.jobId) : undefined;
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-[#F8F8FA] text-[11px] text-[#374151] last:border-0 transition-colors duration-150 hover:bg-[#FAFAFC]"
                      >
                        <td className="px-1.5 py-2">
                          <input
                            type="checkbox"
                            className="cursor-pointer accent-primary"
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
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-2 text-[#6B7280]">{c.candidateCode}</td>
                        <td className="px-1.5 py-2">
                          <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <InitialsAvatar name={c.fullName} toneIndex={i} size="sm" />
                            <span className="font-semibold text-[#111827]">{c.fullName}</span>
                          </span>
                        </td>
                        <td className="max-w-[140px] truncate px-1.5 py-2" title={c.email}>
                          {c.email || "—"}
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-2">{c.phone || "—"}</td>
                        <td className="whitespace-nowrap px-1.5 py-2">
                          <SourceCell source={c.source} />
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-2">{c.experienceYears}y</td>
                        <td className="whitespace-nowrap px-1.5 py-2">
                          {c.expectedSalary ? `₹${c.expectedSalary.toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="max-w-[130px] truncate px-1.5 py-2" title={job?.title}>
                          {job?.title ?? "—"}
                        </td>
                        <td className="px-1.5 py-2">
                          <CandidatePipelineStatusCell
                            application={app}
                            onChangeStage={onChangeStage}
                          />
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-2 text-[#6B7280]">
                          {formatPostedOn(app?.appliedAt ?? c.createdAt)}
                        </td>
                        <td className="px-1.5 py-2">
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              title="View"
                              className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md border border-[#EEEFF3] text-[#6B7280] transition-colors hover:bg-[#F8F8FC] hover:text-[#111827]"
                              onClick={() => onView(c)}
                            >
                              <Eye className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Edit"
                              className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md border border-[#EEEFF3] text-[#6B7280] transition-colors hover:bg-[#F8F8FC] hover:text-[#111827]"
                              onClick={() => onEdit(c)}
                            >
                              <Pencil className="size-3.5" />
                            </button>
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

function IconFilter({
  icon: Icon,
  value,
  onChange,
  options,
  widthClass = "w-[140px]",
}: {
  icon: typeof Briefcase;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  widthClass?: string;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-[#9CA3AF]" />
      <FilterSelect
        value={value}
        onChange={onChange}
        options={options}
        className={cn(
          widthClass,
          "[&_button]:h-9 [&_button]:rounded-full [&_button]:border-[#E5E7EB] [&_button]:bg-white [&_button]:pl-8 [&_button]:text-[12px]",
        )}
      />
    </div>
  );
}

function SortTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className="px-1.5 py-2.5 font-medium">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex cursor-pointer items-center gap-0.5 uppercase transition-colors hover:text-[#111827]",
          active ? "text-[#111827]" : "text-[#9CA3AF]",
        )}
      >
        <span>{label}</span>
        <span className="shrink-0 text-[9px] leading-none opacity-70">{active ? (dir === "asc" ? "▲" : "▼") : "⇅"}</span>
      </button>
    </th>
  );
}
