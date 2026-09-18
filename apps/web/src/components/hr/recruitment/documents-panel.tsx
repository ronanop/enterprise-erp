"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  LayoutList,
  MoreVertical,
  Search,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";

import { InitialsAvatar } from "@/components/hr/recruitment/dashboard/status-badge";
import { EmsPagination } from "@/components/hr/workforce/ems-primitives";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  AtsCandidate,
  AtsDocument,
  DocKind,
  DocVerificationStatus,
  JobOpening,
  PipelineApplication,
} from "@/types/recruitment-ats";
import { DOC_KIND_LABELS, DOC_STATUS_LABELS } from "@/types/recruitment-ats";

const PAGE = 5;

type ViewMode = "list" | "grid" | "cards";

type Props = {
  documents: AtsDocument[];
  candidates: AtsCandidate[];
  jobs: JobOpening[];
  applications: PipelineApplication[];
  onView?: (doc: AtsDocument) => void;
  onDownload?: (doc: AtsDocument) => void;
  onVerify?: (docId: string) => void;
  onMarkPending?: (docId: string) => void;
};

function resolveStatus(doc: AtsDocument): DocVerificationStatus {
  if (doc.expiryDate) {
    const exp = new Date(doc.expiryDate);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) return "expired";
  }
  return doc.status ?? "pending";
}

function formatUploaded(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatExpiry(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const parts = iso.split("-");
    if (parts.length === 3) return `${parts[2]} ${monthShort(parts[1])} ${parts[0]}`;
    return iso;
  }
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function monthShort(mm: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const i = Math.max(0, Math.min(11, Number(mm) - 1));
  return months[i] ?? mm;
}

function fileExtIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") {
    return {
      Icon: FileText,
      wrap: "bg-[#FFF1F2] text-[#F43F5E]",
      label: "PDF",
    };
  }
  if (ext === "doc" || ext === "docx") {
    return {
      Icon: FileSpreadsheet,
      wrap: "bg-[#F5F3FF] text-[#7C3AED]",
      label: "DOC",
    };
  }
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    return {
      Icon: FileImage,
      wrap: "bg-[#ECFDF5] text-[#00A866]",
      label: "IMG",
    };
  }
  return {
    Icon: FileText,
    wrap: "bg-[#F3F4F6] text-[#6B7280]",
    label: ext.toUpperCase() || "FILE",
  };
}

function StatusBadge({ status }: { status: DocVerificationStatus }) {
  switch (status) {
    case "verified":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-semibold text-[#00A866]">
          <CheckCircle2 className="size-3" />
          {DOC_STATUS_LABELS.verified}
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[10px] font-semibold text-[#EA580C]">
          <Clock3 className="size-3" />
          {DOC_STATUS_LABELS.pending}
        </span>
      );
    case "expired":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1F2] px-2 py-0.5 text-[10px] font-semibold text-[#F43F5E]">
          <XCircle className="size-3" />
          {DOC_STATUS_LABELS.expired}
        </span>
      );
    default: {
      const _exhaustive: never = status;
      return <span>{String(_exhaustive)}</span>;
    }
  }
}

export function DocumentsPanel({
  documents,
  candidates,
  jobs,
  applications,
  onView,
  onDownload,
  onVerify,
  onMarkPending,
}: Props) {
  const [query, setQuery] = useState("");
  const [candidateId, setCandidateId] = useState("all");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);

  const candMap = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const jobByCandidate = useMemo(() => {
    const map = new Map<string, JobOpening>();
    for (const a of applications) {
      if (map.has(a.candidateId)) continue;
      const job = jobs.find((j) => j.id === a.jobId);
      if (job) map.set(a.candidateId, job);
    }
    return map;
  }, [applications, jobs]);

  const candidateOptions = useMemo(
    () => [
      { value: "all", label: "All Candidates" },
      ...candidates
        .slice()
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
        .map((c) => ({ value: c.id, label: c.fullName })),
    ],
    [candidates],
  );

  const kindOptions = useMemo(
    () => [
      { value: "all", label: "All Document Types" },
      ...(Object.entries(DOC_KIND_LABELS) as [DocKind, string][]).map(([value, label]) => ({
        value,
        label,
      })),
    ],
    [],
  );

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "verified", label: "Verified" },
    { value: "pending", label: "Pending" },
    { value: "expired", label: "Expired" },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((d) => {
      if (candidateId !== "all" && d.candidateId !== candidateId) return false;
      if (kind !== "all" && d.kind !== kind) return false;
      const st = resolveStatus(d);
      if (status !== "all" && st !== status) return false;
      if (!q) return true;
      const cand = candMap.get(d.candidateId);
      const hay = [d.fileName, cand?.fullName, DOC_KIND_LABELS[d.kind], d.kind]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [documents, candidateId, kind, status, query, candMap]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE;
    return filtered.slice(start, start + PAGE);
  }, [filtered, page]);

  const allPageSelected =
    pageRows.length > 0 && pageRows.every((d) => selected.has(d.id));

  function toggleAllPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const d of pageRows) next.delete(d.id);
      } else {
        for (const d of pageRows) next.add(d.id);
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * PAGE + 1;
  const rangeEnd = Math.min(page * PAGE, filtered.length);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="relative min-w-[220px] flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#9CA3AF]" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search documents by name, candidate, or type..."
            className="h-9 rounded-full border-[#E5E7EB] bg-white pl-8 text-[12px]"
          />
        </div>
        <FilterSelect
          value={candidateId}
          onChange={(v) => {
            setCandidateId(v);
            setPage(1);
          }}
          options={candidateOptions}
          className="w-[160px] [&_button]:h-9 [&_button]:rounded-full [&_button]:border-[#E5E7EB] [&_button]:bg-white [&_button]:text-[12px]"
        />
        <FilterSelect
          value={kind}
          onChange={(v) => {
            setKind(v);
            setPage(1);
          }}
          options={kindOptions}
          className="w-[170px] [&_button]:h-9 [&_button]:rounded-full [&_button]:border-[#E5E7EB] [&_button]:bg-white [&_button]:text-[12px]"
        />
        <FilterSelect
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={statusOptions}
          className="w-[130px] [&_button]:h-9 [&_button]:rounded-full [&_button]:border-[#E5E7EB] [&_button]:bg-white [&_button]:text-[12px]"
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F9FAFB]"
            aria-label="Filters"
          >
            <SlidersHorizontal className="size-3.5" />
          </button>
          <span className="text-[11px] font-medium text-[#9CA3AF]">View</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-[#E5E7EB]">
            {(
              [
                { id: "list" as const, icon: LayoutList, label: "List view" },
                { id: "grid" as const, icon: LayoutGrid, label: "Grid view" },
                { id: "cards" as const, icon: FileText, label: "Card view" },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                type="button"
                aria-label={v.label}
                className={cn(
                  "inline-flex size-8 cursor-pointer items-center justify-center",
                  view === v.id
                    ? "bg-[#F5F3FF] text-[#7C3AED]"
                    : "bg-white text-[#9CA3AF] hover:bg-[#F9FAFB]",
                )}
                onClick={() => setView(v.id)}
              >
                <v.icon className="size-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#F5F3FF] text-[#7C3AED]">
              <FileText className="size-5" />
            </div>
            <p className="text-sm font-medium text-[#374151]">No documents</p>
            <p className="text-[12px] text-[#9CA3AF]">
              Candidate resumes and offer letters will appear here once uploaded
            </p>
          </div>
        ) : view === "list" ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#F3F4F6] text-[11px] font-medium tracking-wide text-[#9CA3AF] uppercase">
                  <tr>
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        className="cursor-pointer"
                        checked={allPageSelected}
                        onChange={toggleAllPage}
                        aria-label="Select all on page"
                      />
                    </th>
                    <th className="px-3 py-2.5 font-medium">Document Name</th>
                    <th className="px-3 py-2.5 font-medium">Candidate</th>
                    <th className="px-3 py-2.5 font-medium">Type</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Uploaded On</th>
                    <th className="px-3 py-2.5 font-medium">Expiry Date</th>
                    <th className="px-3 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((d, i) => {
                    const cand = candMap.get(d.candidateId);
                    const job = jobByCandidate.get(d.candidateId);
                    const st = resolveStatus(d);
                    const file = fileExtIcon(d.fileName);
                    const FileIcon = file.Icon;
                    return (
                      <tr
                        key={d.id}
                        className="border-b border-[#F9FAFB] last:border-0 hover:bg-[#FAFBFC]"
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            className="cursor-pointer"
                            checked={selected.has(d.id)}
                            onChange={() => toggleOne(d.id)}
                            aria-label={`Select ${d.fileName}`}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
                                file.wrap,
                              )}
                            >
                              <FileIcon className="size-3.5" />
                            </span>
                            <span className="truncate text-[12px] font-medium text-[#111827]">
                              {d.fileName}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-2">
                            <InitialsAvatar
                              name={cand?.fullName ?? "?"}
                              toneIndex={i}
                              size="sm"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-[12px] font-medium text-[#111827]">
                                {cand?.fullName ?? "—"}
                              </span>
                              <span className="block truncate text-[10px] text-[#9CA3AF]">
                                {job?.title ?? "—"}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-[#374151]">
                          {DOC_KIND_LABELS[d.kind] ?? d.kind}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={st} />
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-[#6B7280]">
                          {formatUploaded(d.uploadedAt)}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-[#6B7280]">
                          {formatExpiry(d.expiryDate)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="relative flex items-center gap-0.5">
                            <button
                              type="button"
                              className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151]"
                              aria-label="View"
                              onClick={() => onView?.(d)}
                            >
                              <Eye className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151]"
                              aria-label="Download"
                              onClick={() => onDownload?.(d)}
                            >
                              <Download className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151]"
                              aria-label="More"
                              onClick={() => setMenuId(menuId === d.id ? null : d.id)}
                            >
                              <MoreVertical className="size-3.5" />
                            </button>
                            {menuId === d.id ? (
                              <div className="absolute top-8 right-0 z-20 w-36 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg">
                                <button
                                  type="button"
                                  className="flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] text-[#374151] hover:bg-[#F9FAFB]"
                                  onClick={() => {
                                    onVerify?.(d.id);
                                    setMenuId(null);
                                  }}
                                >
                                  Mark verified
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] text-[#374151] hover:bg-[#F9FAFB]"
                                  onClick={() => {
                                    onMarkPending?.(d.id);
                                    setMenuId(null);
                                  }}
                                >
                                  Mark pending
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F3F4F6] px-3 py-2">
              <p className="text-[11px] text-[#6B7280]">
                {rangeStart}–{rangeEnd} of {filtered.length} documents
              </p>
              <EmsPagination
                page={page}
                pageSize={PAGE}
                total={filtered.length}
                onPageChange={setPage}
              />
            </div>
          </>
        ) : (
          <>
            <div
              className={cn(
                "grid gap-3 p-3",
                view === "grid" ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-1 lg:grid-cols-2",
              )}
            >
              {pageRows.map((d, i) => {
                const cand = candMap.get(d.candidateId);
                const job = jobByCandidate.get(d.candidateId);
                const st = resolveStatus(d);
                const file = fileExtIcon(d.fileName);
                const FileIcon = file.Icon;
                return (
                  <div
                    key={d.id}
                    className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
                          file.wrap,
                        )}
                      >
                        <FileIcon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-[#111827]">
                          {d.fileName}
                        </p>
                        <p className="mt-0.5 text-[10px] text-[#9CA3AF]">
                          {DOC_KIND_LABELS[d.kind]} · {formatUploaded(d.uploadedAt)}
                        </p>
                      </div>
                      <StatusBadge status={st} />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <InitialsAvatar name={cand?.fullName ?? "?"} toneIndex={i} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium text-[#111827]">
                          {cand?.fullName ?? "—"}
                        </p>
                        <p className="truncate text-[10px] text-[#9CA3AF]">{job?.title ?? "—"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F3F4F6]"
                        onClick={() => onView?.(d)}
                      >
                        <Eye className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F3F4F6]"
                        onClick={() => onDownload?.(d)}
                      >
                        <Download className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F3F4F6] px-3 py-2">
              <p className="text-[11px] text-[#6B7280]">
                {rangeStart}–{rangeEnd} of {filtered.length} documents
              </p>
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
