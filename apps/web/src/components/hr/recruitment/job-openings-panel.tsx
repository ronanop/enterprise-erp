"use client";

import { useMemo, useState } from "react";
import {
  Briefcase,
  Building2,
  Flag,
  MapPin,
  RotateCcw,
  Search,
  Target,
} from "lucide-react";

import { formatPostedOn } from "@/components/hr/recruitment/dashboard/dashboard-model";
import { VerticalKebab } from "@/components/hr/recruitment/dashboard/data-table";
import {
  JobStatusBadge,
  PriorityBadge,
} from "@/components/hr/recruitment/dashboard/status-badge";
import { EmsPagination } from "@/components/hr/workforce/ems-primitives";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { filterJobs } from "@/services/recruitment-ats-service";
import type { AtsFilters, JobOpening } from "@/types/recruitment-ats";
import { emptyAtsFilters } from "@/types/recruitment-ats";
import { cn } from "@/lib/utils";

const PAGE = 10;

const EMPLOYMENT_OPTIONS = [
  { value: "all", label: "Job Type" },
  { value: "full_time", label: "Full Time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
  { value: "part_time", label: "Part Time" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Status" },
  { value: "open", label: "Open" },
  { value: "on_hold", label: "On Hold" },
  { value: "filled", label: "Filled" },
  { value: "closed", label: "Closed" },
  { value: "draft", label: "Draft" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "Priority" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "critical", label: "Critical" },
];

export function JobOpeningsPanel({
  jobs,
  applicationsByJob,
  onCreate,
  onEdit,
  onView,
}: {
  jobs: JobOpening[];
  applicationsByJob: Map<string, number>;
  onCreate: () => void;
  onEdit: (job: JobOpening) => void;
  onView: (job: JobOpening) => void;
}) {
  const [draft, setDraft] = useState<AtsFilters>(() => emptyAtsFilters());
  const [applied, setApplied] = useState<AtsFilters>(() => emptyAtsFilters());
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<"createdAt" | "title" | "jobCode">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const departments = useMemo(() => {
    const set = new Set(jobs.map((j) => j.department).filter(Boolean));
    return [
      { value: "all", label: "Department" },
      ...[...set].sort().map((d) => ({ value: d, label: d })),
    ];
  }, [jobs]);

  const locations = useMemo(() => {
    const set = new Set(jobs.map((j) => j.location).filter(Boolean));
    return [
      { value: "all", label: "Location" },
      ...[...set].sort().map((d) => ({ value: d, label: d })),
    ];
  }, [jobs]);

  const filtered = useMemo(() => {
    const rows = filterJobs(jobs, applied);
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = String(a[sortKey] ?? "");
      const bv = String(b[sortKey] ?? "");
      return av.localeCompare(bv) * dir;
    });
  }, [jobs, applied, sortKey, sortDir]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE;
    return filtered.slice(start, start + PAGE);
  }, [filtered, page]);

  const allPageSelected =
    pageRows.length > 0 && pageRows.every((j) => selected.has(j.id));

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function applyFilters() {
    setApplied({ ...draft });
    setPage(1);
  }

  function resetFilters() {
    const empty = emptyAtsFilters();
    setDraft(empty);
    setApplied(empty);
    setPage(1);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2.5 rounded-[12px] border border-[#EEEFF3] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[#9CA3AF]" />
          <Input
            value={draft.query}
            onChange={(e) => setDraft((f) => ({ ...f, query: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters();
            }}
            placeholder="Search job title, department, or ID..."
            className="h-9 rounded-full border-[#E5E7EB] bg-white pl-9 text-[13px]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IconFilter
            icon={Building2}
            value={draft.department}
            onChange={(v) => setDraft((f) => ({ ...f, department: v }))}
            options={departments}
          />
          <IconFilter
            icon={Target}
            value={draft.status}
            onChange={(v) => setDraft((f) => ({ ...f, status: v }))}
            options={STATUS_OPTIONS}
          />
          <IconFilter
            icon={MapPin}
            value={draft.location}
            onChange={(v) => setDraft((f) => ({ ...f, location: v }))}
            options={locations}
          />
          <IconFilter
            icon={Briefcase}
            value={draft.employmentType}
            onChange={(v) => setDraft((f) => ({ ...f, employmentType: v }))}
            options={EMPLOYMENT_OPTIONS}
          />
          <IconFilter
            icon={Flag}
            value={draft.priority}
            onChange={(v) => setDraft((f) => ({ ...f, priority: v }))}
            options={PRIORITY_OPTIONS}
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
            onClick={applyFilters}
          >
            Apply Filters
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[12px] border border-[#EEEFF3] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">No job openings match these filters</p>
            <Button size="sm" className="cursor-pointer bg-[#7C3AED] text-white hover:bg-[#6D28D9]" onClick={onCreate}>
              Create Job Opening
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="border-b border-[#F3F4F6] text-[11px] font-medium tracking-wide text-[#9CA3AF] uppercase">
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        className="cursor-pointer accent-primary"
                        checked={allPageSelected}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            for (const j of pageRows) {
                              if (e.target.checked) next.add(j.id);
                              else next.delete(j.id);
                            }
                            return next;
                          });
                        }}
                      />
                    </th>
                    <SortTh label="Job ID" active={sortKey === "jobCode"} dir={sortDir} onClick={() => toggleSort("jobCode")} />
                    <SortTh label="Title" active={sortKey === "title"} dir={sortDir} onClick={() => toggleSort("title")} />
                    <th className="px-3 py-3 font-medium">Department</th>
                    <th className="px-3 py-3 font-medium">Location</th>
                    <th className="px-3 py-3 font-medium">Positions</th>
                    <th className="px-3 py-3 font-medium">Applicants</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Priority</th>
                    <SortTh
                      label="Created On"
                      active={sortKey === "createdAt"}
                      dir={sortDir}
                      onClick={() => toggleSort("createdAt")}
                    />
                    <th className="px-3 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((j) => (
                    <tr
                      key={j.id}
                      className="border-b border-[#F8F8FA] text-[12px] text-[#374151] last:border-0 transition-colors duration-150 hover:bg-[#FAFAFC]"
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="cursor-pointer accent-primary"
                          checked={selected.has(j.id)}
                          onChange={(e) => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(j.id);
                              else next.delete(j.id);
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-[#6B7280]">{j.jobCode}</td>
                      <td className="px-3 py-3 font-semibold whitespace-nowrap text-[#111827]">{j.title}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{j.department || "—"}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{j.location || "—"}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {j.filled}/{j.positions}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {applicationsByJob.get(j.id) ?? 0}
                      </td>
                      <td className="px-3 py-3">
                        <JobStatusBadge status={j.status} filled={j.filled} positions={j.positions} />
                      </td>
                      <td className="px-3 py-3">
                        <PriorityBadge priority={j.priority} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-[#6B7280]">
                        {formatPostedOn(j.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <VerticalKebab
                          items={[
                            { label: "View", onClick: () => onView(j) },
                            { label: "Edit", onClick: () => onEdit(j) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
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
}: {
  icon: typeof Building2;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-[#9CA3AF]" />
      <FilterSelect
        value={value}
        onChange={onChange}
        options={options}
        className="w-[140px] [&_button]:h-9 [&_button]:rounded-full [&_button]:border-[#E5E7EB] [&_button]:bg-white [&_button]:pl-8 [&_button]:text-[12px]"
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
    <th className="px-3 py-3 font-medium">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 uppercase transition-colors hover:text-[#111827]",
          active ? "text-[#111827]" : "text-[#9CA3AF]",
        )}
      >
        {label}
        <span className="text-[9px] leading-none opacity-70">{active ? (dir === "asc" ? "▲" : "▼") : "⇅"}</span>
      </button>
    </th>
  );
}
