"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  Search,
  XCircle,
} from "lucide-react";

import { InitialsAvatar } from "@/components/hr/recruitment/dashboard/status-badge";
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
import { getDocumentHref } from "@/services/recruitment-ats-service";
import { DOC_KIND_LABELS, DOC_STATUS_LABELS } from "@/types/recruitment-ats";

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

type CandidateFolder = {
  candidate: AtsCandidate;
  jobTitle: string;
  documents: AtsDocument[];
  kinds: DocKind[];
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

function fileExtIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") {
    return { Icon: FileText, wrap: "bg-[#FFF1F2] text-[#F43F5E]", label: "PDF" };
  }
  if (ext === "doc" || ext === "docx") {
    return { Icon: FileSpreadsheet, wrap: "bg-primary/10 text-primary", label: "DOC" };
  }
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    return { Icon: FileImage, wrap: "bg-[#ECFDF5] text-[#00A866]", label: "IMG" };
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

function kindSummary(kinds: DocKind[]): string {
  const unique = Array.from(new Set(kinds));
  if (!unique.length) return "Empty folder";
  return unique.map((k) => DOC_KIND_LABELS[k] ?? k).join(" · ");
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
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);

  const jobByCandidate = useMemo(() => {
    const map = new Map<string, JobOpening>();
    for (const a of applications) {
      if (map.has(a.candidateId)) continue;
      const job = jobs.find((j) => j.id === a.jobId);
      if (job) map.set(a.candidateId, job);
    }
    return map;
  }, [applications, jobs]);

  const folders = useMemo((): CandidateFolder[] => {
    const byId = new Map<string, CandidateFolder>();

    for (const c of candidates) {
      byId.set(c.id, {
        candidate: c,
        jobTitle: jobByCandidate.get(c.id)?.title || c.currentDesignation || "Candidate",
        documents: [],
        kinds: [],
      });
    }

    for (const d of documents) {
      let folder = byId.get(d.candidateId);
      if (!folder) {
        const cand =
          candidates.find(
            (c) =>
              c.id === d.candidateId ||
              c.apiId === d.candidateId ||
              (c.email &&
                d.candidateId &&
                c.id.toLowerCase() === d.candidateId.toLowerCase()),
          ) ?? null;
        if (!cand) continue;
        folder = byId.get(cand.id);
        if (!folder) {
          folder = {
            candidate: cand,
            jobTitle: jobByCandidate.get(cand.id)?.title || cand.currentDesignation || "Candidate",
            documents: [],
            kinds: [],
          };
          byId.set(cand.id, folder);
        }
      }
      folder.documents.push(d);
      folder.kinds.push(d.kind);
    }

    // One folder per candidate (including empty) so every person in Candidates appears here
    return Array.from(byId.values())
      .map((f) => ({
        ...f,
        documents: f.documents
          .slice()
          .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
      }))
      .sort((a, b) => a.candidate.fullName.localeCompare(b.candidate.fullName));
  }, [candidates, documents, jobByCandidate]);

  const filteredFolders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => {
      const hay = [
        f.candidate.fullName,
        f.candidate.candidateCode,
        f.jobTitle,
        ...f.documents.map((d) => d.fileName),
        ...f.kinds.map((k) => DOC_KIND_LABELS[k]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [folders, query]);

  const openFolder = useMemo(
    () => (openFolderId ? filteredFolders.find((f) => f.candidate.id === openFolderId) ?? null : null),
    [filteredFolders, openFolderId],
  );

  const openDocs = useMemo(() => {
    if (!openFolder) return [];
    const q = query.trim().toLowerCase();
    if (!q) return openFolder.documents;
    return openFolder.documents.filter(
      (d) =>
        d.fileName.toLowerCase().includes(q) ||
        (DOC_KIND_LABELS[d.kind] ?? d.kind).toLowerCase().includes(q),
    );
  }, [openFolder, query]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="relative min-w-[220px] flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#9CA3AF]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              openFolder
                ? "Search files in this folder…"
                : "Search candidate folders or documents…"
            }
            className="h-9 rounded-full border-[#E5E7EB] bg-white pl-8 text-[12px]"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#F3F4F6] px-3 py-2.5">
          {openFolder ? (
            <>
              <button
                type="button"
                className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2 text-[11px] font-medium text-[#374151] transition-colors duration-150 hover:bg-[#F9FAFB]"
                onClick={() => setOpenFolderId(null)}
              >
                <ArrowLeft className="size-3.5" />
                All folders
              </button>
              <ChevronRight className="size-3.5 text-[#D1D5DB]" />
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#111827]">
                <FolderOpen className="size-3.5 text-primary" />
                {openFolder.candidate.fullName}
              </span>
              <span className="text-[11px] text-[#9CA3AF]">
                {openDocs.length} file{openDocs.length === 1 ? "" : "s"}
              </span>
            </>
          ) : (
            <>
              <Folder className="size-3.5 text-primary" />
              <span className="text-[12px] font-medium text-[#111827]">Candidate folders</span>
              <span className="text-[11px] text-[#9CA3AF]">
                {filteredFolders.length} folder{filteredFolders.length === 1 ? "" : "s"}
              </span>
            </>
          )}
        </div>

        {!openFolder ? (
          filteredFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Folder className="size-5" />
              </div>
              <p className="text-sm font-medium text-[#374151]">No candidate folders</p>
              <p className="max-w-sm text-[12px] text-[#9CA3AF]">
                Each candidate gets a folder. Resumes, offer letters, and other files appear inside
                once uploaded or generated.
              </p>
            </div>
          ) : (
            <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredFolders.map((folder, i) => {
                const count = folder.documents.length;
                return (
                  <button
                    key={folder.candidate.id}
                    type="button"
                    onClick={() => setOpenFolderId(folder.candidate.id)}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-3 text-left transition-colors duration-150 hover:border-primary/30 hover:bg-primary/5"
                  >
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF7ED] text-[#EA580C]">
                      <Folder className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <InitialsAvatar
                          name={folder.candidate.fullName}
                          toneIndex={i}
                          size="sm"
                        />
                        <span className="truncate text-[12px] font-semibold text-[#111827]">
                          {folder.candidate.fullName}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-[#9CA3AF]">
                        {folder.candidate.candidateCode} · {folder.jobTitle}
                      </span>
                      <span className="mt-1.5 block text-[11px] text-[#374151]">
                        {count} document{count === 1 ? "" : "s"}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-[#6B7280]">
                        {kindSummary(folder.kinds)}
                      </span>
                    </span>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-[#D1D5DB]" />
                  </button>
                );
              })}
            </div>
          )
        ) : openDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileText className="size-5" />
            </div>
            <p className="text-sm font-medium text-[#374151]">Folder is empty</p>
            <p className="text-[12px] text-[#9CA3AF]">
              Upload a resume or generate an offer letter to populate this folder.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#F3F4F6] text-[11px] font-medium tracking-wide text-[#9CA3AF] uppercase">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Document</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Uploaded</th>
                  <th className="px-3 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {openDocs.map((d) => {
                  const st = resolveStatus(d);
                  const file = fileExtIcon(d.fileName);
                  const FileIcon = file.Icon;
                  const canOpen =
                    Boolean(getDocumentHref(d)) ||
                    d.kind === "offer_letter";
                  const canFetch =
                    !canOpen &&
                    (d.kind === "resume" ||
                      (d.url || "").startsWith("recruitment-resume:"));
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-[#F9FAFB] last:border-0 hover:bg-[#FAFBFC]"
                    >
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
                          <span className="min-w-0">
                            <span className="block truncate text-[12px] font-medium text-[#111827]">
                              {d.fileName}
                            </span>
                            <span className="block text-[10px] text-[#9CA3AF]">
                              {canOpen
                                ? "Ready to view"
                                : canFetch
                                  ? "Stored on server — open to load"
                                  : "Metadata only"}
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
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-[#9CA3AF] transition-colors duration-150 hover:bg-[#F3F4F6] hover:text-[#374151]"
                            aria-label="View"
                            onClick={() => onView?.(d)}
                          >
                            <Eye className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-[#9CA3AF] transition-colors duration-150 hover:bg-[#F3F4F6] hover:text-[#374151]"
                            aria-label="Download"
                            onClick={() => onDownload?.(d)}
                          >
                            <Download className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-7 cursor-pointer items-center rounded-md px-2 text-[10px] font-medium text-[#6B7280] transition-colors duration-150 hover:bg-[#F3F4F6] hover:text-[#374151]"
                            onClick={() =>
                              st === "verified" ? onMarkPending?.(d.id) : onVerify?.(d.id)
                            }
                          >
                            {st === "verified" ? "Pending" : "Verify"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
