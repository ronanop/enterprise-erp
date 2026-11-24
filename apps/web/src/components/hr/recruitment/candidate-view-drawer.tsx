"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Briefcase,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Link,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  StickyNote,
  User,
  Video,
  X,
} from "lucide-react";

import { formatPostedOn, interviewTimeWindow } from "@/components/hr/recruitment/dashboard/dashboard-model";
import { InitialsAvatar } from "@/components/hr/recruitment/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { PIPELINE_STAGES, STATUS_LABELS } from "@/config/pipeline-config";
import { cn } from "@/lib/utils";
import { getAccessToken } from "@/lib/auth";
import {
  isPdfHref,
  resolvePreviewSrc,
} from "@/lib/recruitment/document-preview";
import {
  formatInr,
  formatInrGrouping,
  INDIAN_STATES,
  isValidEmail,
  isValidIndianMobile,
  parseInrInput,
} from "@/services/recruitment-ats-lookups";
import { getDocumentHref } from "@/services/recruitment-ats-service";
import { env } from "@/utils/env";
import type {
  AtsCandidate,
  AtsDocument,
  AtsInterview,
  AtsOffer,
  CandidatePipelineStatus,
  CreateCandidateInput,
  JobOpening,
  PipelineApplication,
} from "@/types/recruitment-ats";
import {
  DOC_KIND_LABELS,
  DOC_STATUS_LABELS,
  INTERVIEW_ROUND_LABELS,
  OFFER_STATUS_LABELS,
  SOURCE_LABELS,
} from "@/types/recruitment-ats";

type ProfileTab =
  | "overview"
  | "documents"
  | "interviews"
  | "offers"
  | "activity"
  | "notes";

type CandidateDraft = {
  fullName: string;
  email: string;
  phone: string;
  alternatePhone: string;
  gender: string;
  dob: string;
  address: string;
  state: string;
  pincode: string;
  currentCompany: string;
  currentDesignation: string;
  experienceYears: string;
  expectedSalaryDisplay: string;
  noticePeriodDays: string;
  linkedinUrl: string;
  recruiter: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  candidate: AtsCandidate | null;
  application: PipelineApplication | null;
  job: JobOpening | null;
  documents?: AtsDocument[];
  interviews?: AtsInterview[];
  offers?: AtsOffer[];
  candidates?: AtsCandidate[];
  onNavigate?: (candidate: AtsCandidate) => void;
  onSave?: (payload: {
    candidateId: string;
    patch?: Partial<CreateCandidateInput>;
    notes: string;
  }) => void | Promise<void>;
};

const TABS: { id: ProfileTab; label: string; icon: typeof User }[] = [
  { id: "overview", label: "Overview", icon: User },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "interviews", label: "Interviews", icon: Calendar },
  { id: "offers", label: "Offers", icon: FileCheck2 },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "notes", label: "Notes", icon: StickyNote },
];

const TAG_TONES = [
  "bg-primary/10 text-primary",
  "bg-[#FFF4E5] text-[#C2410C]",
  "bg-[#ECFDF5] text-[#00A866]",
  "bg-primary/10 text-primary",
  "bg-[#FCE7F3] text-[#DB2777]",
] as const;

const FIELD_INPUT =
  "h-7 w-full rounded-md border border-[#E5E7EB] bg-white px-2 text-[12px] text-[#111827] outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20";

function statusChip(status: CandidatePipelineStatus | null): {
  label: string;
  className: string;
} {
  if (!status) return { label: "No application", className: "bg-[#F3F4F6] text-[#6B7280]" };
  switch (status) {
    case "active":
      return { label: "Active", className: "bg-primary/10 text-primary" };
    case "hired":
      return { label: "Hired", className: "bg-[#ECFDF5] text-[#00A866]" };
    case "rejected":
      return { label: "Rejected", className: "bg-[#FFF1F2] text-[#F43F5E]" };
    case "backed_out":
      return { label: "Backed Out", className: "bg-[#FFF1F2] text-[#BE123C]" };
    case "offer_declined":
      return { label: "Offer Declined", className: "bg-[#FFF1F2] text-[#F43F5E]" };
    default: {
      const _exhaustive: never = status;
      return { label: String(_exhaustive), className: "bg-[#F3F4F6] text-[#6B7280]" };
    }
  }
}

function notesKey(candidateId: string) {
  return `erp_ats_candidate_notes_${candidateId}`;
}

function tagsKey(candidateId: string) {
  return `erp_ats_candidate_tags_${candidateId}`;
}

async function openCandidateResume(candidate: AtsCandidate, download = false) {
  const url = candidate.resumeUrl || "";
  if (url.startsWith("data:")) {
    if (download) {
      const a = document.createElement("a");
      a.href = url;
      a.download = candidate.resumeName || "resume.pdf";
      a.click();
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const candidateId =
    url.startsWith("recruitment-resume:")
      ? url.slice("recruitment-resume:".length)
      : candidate.id;
  const base = env.apiUrl.replace(/\/$/, "");
  const token = getAccessToken();
  const res = await fetch(`${base}/recruitment/candidates/${candidateId}/resume-file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Could not open resume file");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  if (download) {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = candidate.resumeName || "resume.pdf";
    a.click();
  } else {
    window.open(objectUrl, "_blank", "noopener,noreferrer");
  }
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function draftFromCandidate(c: AtsCandidate): CandidateDraft {
  return {
    fullName: c.fullName,
    email: c.email,
    phone: c.phone,
    alternatePhone: c.alternatePhone ?? "",
    gender: c.gender ?? "",
    dob: c.dob ?? "",
    address: c.address ?? "",
    state: c.state ?? "",
    pincode: c.pincode ?? "",
    currentCompany: c.currentCompany ?? "",
    currentDesignation: c.currentDesignation ?? "",
    experienceYears: String(c.experienceYears ?? 0),
    expectedSalaryDisplay: c.expectedSalary ? formatInrGrouping(c.expectedSalary) : "",
    noticePeriodDays: String(c.noticePeriodDays ?? 0),
    linkedinUrl: c.linkedinUrl ?? "",
    recruiter: c.recruiter ?? "",
  };
}

function formatDobWithAge(dob: string): string {
  if (!dob) return "—";
  const d = new Date(dob);
  if (!Number.isFinite(d.getTime())) return dob;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const monthDelta = today.getMonth() - d.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < d.getDate())) age -= 1;
  const label = formatPostedOn(dob);
  if (age < 0 || age > 120) return label;
  return `${label} (${age} yrs)`;
}

function formatExperience(years: number | null | undefined): string {
  if (years == null) return "—";
  return years === 1 ? "1 year" : `${years} years`;
}

function capitalize(value: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

export function CandidateViewDrawer({
  open,
  onClose,
  candidate,
  application,
  job,
  documents = [],
  interviews = [],
  offers = [],
  candidates = [],
  onNavigate,
  onSave,
}: Props) {
  const [tab, setTab] = useState<ProfileTab>("overview");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CandidateDraft | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const skillInputRef = useRef<HTMLInputElement>(null);

  // Reset pane state only when opening or switching candidate.
  useEffect(() => {
    if (!open || !candidate) return;
    setTab("overview");
    setMoreOpen(false);
    setEditing(false);
    setError("");
    setDraft(draftFromCandidate(candidate));
    try {
      setNotes(localStorage.getItem(notesKey(candidate.id)) ?? application?.notes ?? "");
      const raw = localStorage.getItem(tagsKey(candidate.id));
      const stored = raw ? (JSON.parse(raw) as string[]) : [];
      const fromCandidate = (candidate.skills ?? []).map((s) => s.trim()).filter(Boolean);
      const fromJob = job?.skills ?? [];
      // Prefer candidate skills from LLM parse, then saved tags, then job skills.
      setTags(
        fromCandidate.length ? fromCandidate : stored.length ? stored : fromJob,
      );
      if (fromCandidate.length) {
        localStorage.setItem(tagsKey(candidate.id), JSON.stringify(fromCandidate));
      }
    } catch {
      setNotes(application?.notes ?? "");
      setTags((candidate.skills ?? []).length ? (candidate.skills ?? []) : (job?.skills ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- candidate.id is the switch key
  }, [open, candidate?.id, candidate?.skills?.join("|")]);

  useEffect(() => {
    if (!open || !candidate || editing) return;
    setDraft(draftFromCandidate(candidate));
  }, [open, candidate, editing]);

  const candDocs = useMemo(
    () => (candidate ? documents.filter((d) => d.candidateId === candidate.id) : []),
    [documents, candidate],
  );
  const candInterviews = useMemo(
    () => (candidate ? interviews.filter((i) => i.candidateId === candidate.id) : []),
    [interviews, candidate],
  );
  const candOffers = useMemo(
    () => (candidate ? offers.filter((o) => o.candidateId === candidate.id) : []),
    [offers, candidate],
  );

  const navIndex = useMemo(() => {
    if (!candidate || !candidates.length) return -1;
    return candidates.findIndex((c) => c.id === candidate.id);
  }, [candidates, candidate]);

  if (!open || !candidate) return null;

  const chip = statusChip(application?.status ?? null);
  const stageLabel = application
    ? PIPELINE_STAGES.find((s) => s.id === application.stage)?.label ?? application.stage
    : "Not applied";
  const interviewStatus = candInterviews.some((i) => i.status === "completed")
    ? "Completed"
    : candInterviews.some((i) => i.status === "scheduled")
      ? "Scheduled"
      : "None";

  const history =
    application?.stageHistory?.length
      ? application.stageHistory
      : application
        ? [
            {
              stage: application.stage,
              label: stageLabel,
              enteredAt: application.stageEnteredAt || application.appliedAt,
            },
          ]
        : [];

  const live = draft ?? draftFromCandidate(candidate);
  const addressValue =
    [candidate.address, candidate.state, candidate.pincode].filter(Boolean).join(", ") ||
    candidate.location;

  function startEdit() {
    setDraft(draftFromCandidate(candidate!));
    setEditing(true);
    setError("");
    setMoreOpen(false);
    setTab("overview");
  }

  function cancelEdit() {
    setDraft(draftFromCandidate(candidate!));
    setEditing(false);
    setError("");
  }

  function addTag() {
    const t = tagDraft.trim();
    if (!t || tags.includes(t)) return;
    setTags((prev) => [...prev, t]);
    setTagDraft("");
  }

  function persistLocal() {
    try {
      localStorage.setItem(notesKey(candidate!.id), notes);
      localStorage.setItem(tagsKey(candidate!.id), JSON.stringify(tags));
    } catch {
      /* ignore */
    }
  }

  async function handleSave() {
    setError("");
    if (editing) {
      if (!live.fullName.trim()) {
        setError("Full name is required");
        return;
      }
      if (!isValidEmail(live.email)) {
        setError("Enter a valid email address");
        return;
      }
      if (!isValidIndianMobile(live.phone)) {
        setError("Phone must be a 10-digit Indian mobile number");
        return;
      }
      if (live.alternatePhone && !isValidIndianMobile(live.alternatePhone)) {
        setError("Alternate phone must be a 10-digit Indian mobile number");
        return;
      }
    }

    persistLocal();
    const location = [live.address, live.state, live.pincode].filter(Boolean).join(", ");
    const patch: Partial<CreateCandidateInput> | undefined = editing
      ? {
          fullName: live.fullName.trim(),
          email: live.email.trim(),
          phone: live.phone.replace(/\s+/g, ""),
          alternatePhone: live.alternatePhone.replace(/\s+/g, ""),
          gender: live.gender,
          dob: live.dob,
          currentCompany: live.currentCompany,
          currentDesignation: live.currentDesignation,
          experienceYears: Number(live.experienceYears) || 0,
          expectedSalary: parseInrInput(live.expectedSalaryDisplay),
          noticePeriodDays: Number(live.noticePeriodDays) || 0,
          location,
          address: live.address,
          state: live.state,
          pincode: live.pincode,
          linkedinUrl: live.linkedinUrl,
          recruiter: live.recruiter,
        }
      : undefined;

    setSaving(true);
    try {
      await onSave?.({ candidateId: candidate!.id, patch, notes });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const body = (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-slate-950/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-full w-full max-w-3xl flex-col border-l border-[#E5E7EB] bg-white shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="border-b border-[#F3F4F6] px-5 py-4">
          <div className="flex items-start gap-3">
            <InitialsAvatar name={candidate.fullName} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[#111827]">
                    {candidate.fullName}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-[#6B7280]">
                    {job?.title || candidate.currentDesignation || "Candidate"} ·{" "}
                    {candidate.candidateCode}
                  </p>
                  {(candidate.currentCompany ||
                    candidate.currentDesignation ||
                    candidate.experienceYears > 0) && (
                    <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-[#4B5563]">
                      <Briefcase className="size-3 shrink-0 text-[#9CA3AF]" />
                      <span className="truncate">
                        {[candidate.currentDesignation, candidate.currentCompany]
                          .filter(Boolean)
                          .join(" · ") || "Experience"}
                        {candidate.experienceYears > 0
                          ? ` · ${candidate.experienceYears} yrs`
                          : ""}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                      chip.className,
                    )}
                  >
                    {chip.label}
                  </span>
                  <button
                    type="button"
                    className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-[#9CA3AF] transition-colors duration-150 hover:bg-[#F3F4F6]"
                    aria-label="Close"
                    onClick={onClose}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <ActionChip
                  icon={Mail}
                  label="Email"
                  href={candidate.email ? `mailto:${candidate.email}` : undefined}
                />
                <ActionChip
                  icon={Link}
                  label="LinkedIn"
                  href={candidate.linkedinUrl || undefined}
                  external
                />
                <button
                  type="button"
                  disabled={!candidate.resumeUrl && !candidate.resumeName}
                  className={cn(
                    "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-2.5 text-[11px] font-medium text-[#374151] transition-colors duration-150 hover:bg-[#F9FAFB]",
                    !candidate.resumeUrl && !candidate.resumeName && "cursor-not-allowed opacity-50",
                  )}
                  onClick={() => void openCandidateResume(candidate, true)}
                >
                  <Download className="size-3.5" />
                  Download Resume
                </button>
                <div className="relative">
                  <button
                    type="button"
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-2.5 text-[11px] font-medium text-[#374151] transition-colors duration-150 hover:bg-[#F9FAFB]"
                    onClick={() => setMoreOpen((v) => !v)}
                  >
                    <MoreHorizontal className="size-3.5" />
                    More
                  </button>
                  {moreOpen ? (
                    <div className="absolute top-9 left-0 z-20 w-40 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        className="flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] hover:bg-[#F9FAFB]"
                        onClick={startEdit}
                      >
                        Edit profile
                      </button>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] hover:bg-[#F9FAFB]"
                        onClick={() => {
                          setMoreOpen(false);
                          setTab("notes");
                        }}
                      >
                        Add note
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[12px] font-medium transition-colors duration-150",
                    active
                      ? "border-b-2 border-primary text-primary"
                      : "border-b-2 border-transparent text-[#6B7280] hover:text-[#374151]",
                  )}
                  onClick={() => setTab(t.id)}
                >
                  <Icon className="size-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="erp-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tab === "overview" ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
                <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-[#111827]">Candidate Information</p>
                    {editing ? (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-[#6B7280] transition-colors duration-150 hover:text-[#111827]"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-primary transition-colors duration-150 hover:underline"
                        onClick={startEdit}
                      >
                        <Pencil className="size-3" />
                        Edit
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoCell label="Full Name" value={candidate.fullName} editing={editing}>
                      <EditInput
                        value={live.fullName}
                        onChange={(e) => setDraft({ ...live, fullName: e.target.value })}
                      />
                    </InfoCell>
                    <InfoCell label="Email" value={candidate.email} editing={editing}>
                      <EditInput
                        type="email"
                        value={live.email}
                        onChange={(e) => setDraft({ ...live, email: e.target.value })}
                      />
                    </InfoCell>
                    <InfoCell label="Phone" value={candidate.phone} editing={editing}>
                      <EditInput
                        inputMode="numeric"
                        maxLength={10}
                        value={live.phone}
                        onChange={(e) =>
                          setDraft({ ...live, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })
                        }
                      />
                    </InfoCell>
                    <InfoCell
                      label="Alternate Phone"
                      value={candidate.alternatePhone}
                      editing={editing}
                    >
                      <EditInput
                        inputMode="numeric"
                        maxLength={10}
                        value={live.alternatePhone}
                        onChange={(e) =>
                          setDraft({
                            ...live,
                            alternatePhone: e.target.value.replace(/\D/g, "").slice(0, 10),
                          })
                        }
                      />
                    </InfoCell>
                    <InfoCell
                      label="Gender"
                      value={capitalize(candidate.gender)}
                      editing={editing}
                    >
                      <EditSelect
                        value={live.gender}
                        onChange={(e) => setDraft({ ...live, gender: e.target.value })}
                      >
                        <option value="">Select</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="other">Other</option>
                      </EditSelect>
                    </InfoCell>
                    <InfoCell
                      label="Date of Birth"
                      value={formatDobWithAge(candidate.dob)}
                      editing={editing}
                    >
                      <EditInput
                        type="date"
                        value={live.dob}
                        onChange={(e) => setDraft({ ...live, dob: e.target.value })}
                      />
                    </InfoCell>
                    <div className="sm:col-span-2">
                      <InfoCell label="Address" value={addressValue} editing={editing}>
                        <div className="grid gap-2 sm:grid-cols-[1fr_8rem_6rem]">
                          <EditInput
                            value={live.address}
                            placeholder="Street / locality"
                            onChange={(e) => setDraft({ ...live, address: e.target.value })}
                          />
                          <EditSelect
                            value={live.state}
                            onChange={(e) => setDraft({ ...live, state: e.target.value })}
                          >
                            <option value="">State</option>
                            {INDIAN_STATES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </EditSelect>
                          <EditInput
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="Pincode"
                            value={live.pincode}
                            onChange={(e) =>
                              setDraft({
                                ...live,
                                pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                              })
                            }
                          />
                        </div>
                      </InfoCell>
                    </div>
                    <InfoCell
                      label="Current Company"
                      value={candidate.currentCompany}
                      editing={editing}
                    >
                      <EditInput
                        value={live.currentCompany}
                        onChange={(e) => setDraft({ ...live, currentCompany: e.target.value })}
                      />
                    </InfoCell>
                    <InfoCell
                      label="Current Designation"
                      value={candidate.currentDesignation}
                      editing={editing}
                    >
                      <EditInput
                        value={live.currentDesignation}
                        onChange={(e) => setDraft({ ...live, currentDesignation: e.target.value })}
                      />
                    </InfoCell>
                    <InfoCell
                      label="Total Experience"
                      value={formatExperience(candidate.experienceYears)}
                      editing={editing}
                    >
                      <EditInput
                        type="number"
                        min={0}
                        value={live.experienceYears}
                        onChange={(e) => setDraft({ ...live, experienceYears: e.target.value })}
                      />
                    </InfoCell>
                    <InfoCell
                      label="Expected CTC"
                      value={candidate.expectedSalary ? formatInr(candidate.expectedSalary) : "—"}
                      editing={editing}
                    >
                      <EditInput
                        inputMode="numeric"
                        value={live.expectedSalaryDisplay}
                        onChange={(e) => {
                          const n = parseInrInput(e.target.value);
                          setDraft({
                            ...live,
                            expectedSalaryDisplay: n
                              ? formatInrGrouping(n)
                              : e.target.value.replace(/[^\d]/g, ""),
                          });
                        }}
                      />
                    </InfoCell>
                    <InfoCell
                      label="Notice Period"
                      value={
                        candidate.noticePeriodDays != null
                          ? `${candidate.noticePeriodDays} days`
                          : "—"
                      }
                      editing={editing}
                    >
                      <EditInput
                        type="number"
                        min={0}
                        value={live.noticePeriodDays}
                        onChange={(e) => setDraft({ ...live, noticePeriodDays: e.target.value })}
                      />
                    </InfoCell>
                    <InfoCell
                      label="Source"
                      value={SOURCE_LABELS[candidate.source] ?? candidate.source}
                    />
                    <InfoCell
                      label="Recruited By"
                      value={candidate.recruiter}
                      editing={editing}
                    >
                      <EditInput
                        value={live.recruiter}
                        onChange={(e) => setDraft({ ...live, recruiter: e.target.value })}
                      />
                    </InfoCell>
                  </div>
                </section>

                <div className="space-y-4">
                  <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <p className="mb-3 text-[12px] font-semibold text-[#111827]">Quick Info</p>
                    <div className="space-y-2.5 text-[11px]">
                      <QuickRow
                        icon={Calendar}
                        label="Applied On"
                        value={application?.appliedAt ? formatPostedOn(application.appliedAt) : "—"}
                      />
                      <QuickRow icon={MapPin} label="Pipeline Stage" value={stageLabel} />
                      <QuickRow icon={Video} label="Interview Status" value={interviewStatus} />
                      <QuickRow
                        icon={CircleAlert}
                        label="Current Status"
                        value={application ? STATUS_LABELS[application.status] : "—"}
                        valueClassName={chip.className}
                        valueAsChip={Boolean(application)}
                      />
                      <QuickRow
                        icon={Clock}
                        label="Last Updated"
                        value={formatPostedOn(candidate.updatedAt)}
                      />
                    </div>
                  </section>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                  <p className="mb-2 text-[12px] font-semibold text-[#111827]">Resume</p>
                  {candidate.resumeName || candidate.resumeUrl ? (
                    <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#FFF1F2] text-[#F43F5E]">
                          <FileText className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-medium text-[#111827]">
                            {candidate.resumeName || "Resume"}
                          </p>
                          <p className="text-[10px] text-[#9CA3AF]">
                            Uploaded {formatPostedOn(candidate.createdAt)}
                          </p>
                        </div>
                      </div>
                      {candidate.resumeUrl ? (
                        <div className="mt-2 flex gap-1.5">
                          <button
                            type="button"
                            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2 text-[10px] font-medium text-[#374151] transition-colors duration-150 hover:bg-[#F9FAFB]"
                            onClick={() => void openCandidateResume(candidate)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2 text-[10px] font-medium text-[#374151] transition-colors duration-150 hover:bg-[#F9FAFB]"
                            onClick={() => void openCandidateResume(candidate, true)}
                          >
                            <Download className="size-3" />
                            Download
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#9CA3AF]">No resume uploaded</p>
                  )}
                </section>

                <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                  <p className="mb-2 text-[12px] font-semibold text-[#111827]">LinkedIn Profile</p>
                  {editing ? (
                    <EditInput
                      value={live.linkedinUrl}
                      placeholder="https://linkedin.com/in/…"
                      onChange={(e) => setDraft({ ...live, linkedinUrl: e.target.value })}
                    />
                  ) : candidate.linkedinUrl ? (
                    <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] px-3 py-2.5">
                      <p className="truncate text-[11px] font-medium text-primary">
                        {displayUrl(candidate.linkedinUrl)}
                      </p>
                      <a
                        href={candidate.linkedinUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2 text-[10px] font-medium text-[#374151] transition-colors duration-150 hover:bg-[#F9FAFB]"
                      >
                        Open Profile
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#9CA3AF]">No LinkedIn URL</p>
                  )}
                </section>

                <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold text-[#111827]">Skills</p>
                    <button
                      type="button"
                      className="cursor-pointer text-[10px] font-medium text-primary transition-colors duration-150 hover:underline"
                      onClick={() => skillInputRef.current?.focus()}
                    >
                      + Add Skill
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag, i) => (
                      <span
                        key={tag}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          TAG_TONES[i % TAG_TONES.length],
                        )}
                      >
                        {tag}
                        <button
                          type="button"
                          className="cursor-pointer opacity-70 hover:opacity-100"
                          aria-label={`Remove ${tag}`}
                          onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                        >
                          <X className="size-2.5" />
                        </button>
                      </span>
                    ))}
                    <form
                      className="inline-flex items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        addTag();
                      }}
                    >
                      <input
                        ref={skillInputRef}
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        placeholder="+ Add Skill"
                        className="h-6 w-24 rounded-full border border-dashed border-[#D1D5DB] bg-transparent px-2 text-[10px] outline-none focus:border-primary"
                      />
                      <button
                        type="submit"
                        className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full text-primary transition-colors duration-150 hover:bg-primary/10"
                        aria-label="Add skill"
                      >
                        <Plus className="size-3" />
                      </button>
                    </form>
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {tab === "documents" ? <DocumentsTab docs={candDocs} /> : null}
          {tab === "interviews" ? <InterviewsTab interviews={candInterviews} job={job} /> : null}
          {tab === "offers" ? <OffersTab offers={candOffers} job={job} /> : null}

          {tab === "activity" ? (
            history.length === 0 ? (
              <EmptyBlock text="No pipeline activity yet" />
            ) : (
              <ol className="space-y-3">
                {history.map((h, i) => (
                  <li key={`${h.stage}-${i}`} className="flex gap-3 text-[12px]">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    <div>
                      <p className="font-medium text-[#111827]">{h.label}</p>
                      <p className="text-[10px] text-[#9CA3AF]">
                        Entered {formatPostedOn(h.enteredAt)}
                        {h.exitedAt ? ` · Left ${formatPostedOn(h.exitedAt)}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )
          ) : null}

          {tab === "notes" ? (
            <div className="space-y-2">
              <p className="text-[12px] font-semibold text-[#111827]">Internal Notes</p>
              <textarea
                className="min-h-[180px] w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[12px] text-[#111827] outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this candidate…"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F3F4F6] bg-[#FAFBFC] px-5 py-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] transition-colors duration-150 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              disabled={navIndex <= 0}
              aria-label="Previous candidate"
              onClick={() => {
                if (navIndex > 0) onNavigate?.(candidates[navIndex - 1]!);
              }}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] transition-colors duration-150 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              disabled={navIndex < 0 || navIndex >= candidates.length - 1}
              aria-label="Next candidate"
              onClick={() => {
                if (navIndex >= 0 && navIndex < candidates.length - 1) {
                  onNavigate?.(candidates[navIndex + 1]!);
                }
              }}
            >
              <ChevronRight className="size-4" />
            </button>
            {error ? <p className="ml-2 text-[11px] text-[#F43F5E]">{error}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="h-9 cursor-pointer" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              className="h-9 cursor-pointer !bg-primary !text-primary-foreground hover:!bg-primary/90"
             
              disabled={saving}
              onClick={() => {
                void handleSave();
              }}
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}

function ActionChip({
  icon: Icon,
  label,
  href,
  external,
  disabled,
}: {
  icon: typeof Mail;
  label: string;
  href?: string;
  external?: boolean;
  disabled?: boolean;
}) {
  const className =
    "inline-flex h-8 items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-2.5 text-[11px] font-medium text-[#374151] transition-colors duration-150 hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40";
  if (!href || disabled) {
    return (
      <button type="button" className={cn(className, "cursor-not-allowed opacity-40")} disabled>
        <Icon className="size-3.5" />
        {label}
      </button>
    );
  }
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={cn(className, "cursor-pointer")}
    >
      <Icon className="size-3.5" />
      {label}
    </a>
  );
}

function InfoCell({
  label,
  value,
  editing,
  children,
}: {
  label: string;
  value: ReactNode;
  editing?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium tracking-wide text-[#9CA3AF] uppercase">{label}</p>
      {editing && children ? (
        <div className="mt-0.5">{children}</div>
      ) : (
        <p className="mt-0.5 break-words text-[12px] font-medium text-[#111827]">{value || "—"}</p>
      )}
    </div>
  );
}

function EditInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(FIELD_INPUT, props.className)} />;
}

function EditSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(FIELD_INPUT, props.className)} />;
}

function QuickRow({
  icon: Icon,
  label,
  value,
  valueAsChip,
  valueClassName,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  valueAsChip?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-[#9CA3AF]">
        <Icon className="size-3.5 text-primary" />
        {label}
      </span>
      {valueAsChip ? (
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
            valueClassName,
          )}
        >
          {value}
        </span>
      ) : (
        <span className="font-medium text-[#111827]">{value}</span>
      )}
    </div>
  );
}

function docStatusTone(status: AtsDocument["status"]): string {
  switch (status) {
    case "verified":
      return "bg-[#ECFDF5] text-[#00A866]";
    case "expired":
      return "bg-[#FFF1F2] text-[#F43F5E]";
    case "pending":
    case undefined:
      return "bg-[#FFF4E5] text-[#C2410C]";
    default: {
      const _exhaustive: never = status;
      return String(_exhaustive);
    }
  }
}

function interviewStatusTone(status: AtsInterview["status"]): string {
  switch (status) {
    case "scheduled":
      return "bg-primary/10 text-primary";
    case "completed":
      return "bg-[#ECFDF5] text-[#00A866]";
    case "cancelled":
      return "bg-[#FFF1F2] text-[#F43F5E]";
    case "rescheduled":
      return "bg-[#FFF4E5] text-[#FF8904]";
    default: {
      const _exhaustive: never = status;
      return String(_exhaustive);
    }
  }
}

function offerStatusTone(status: AtsOffer["status"]): string {
  switch (status) {
    case "draft":
      return "bg-[#F3F4F6] text-[#6B7280]";
    case "sent":
      return "bg-primary/10 text-primary";
    case "accepted":
      return "bg-[#ECFDF5] text-[#00A866]";
    case "rejected":
      return "bg-[#FFF1F2] text-[#F43F5E]";
    case "expired":
      return "bg-[#FFF7ED] text-[#C2410C]";
    default: {
      const _exhaustive: never = status;
      return String(_exhaustive);
    }
  }
}

function DocumentsTab({ docs }: { docs: AtsDocument[] }) {
  const [preview, setPreview] = useState<AtsDocument | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!preview) {
      setPreviewSrc(null);
      return;
    }
    const href = getDocumentHref(preview);
    const resolved = resolvePreviewSrc(href);
    setPreviewSrc(resolved.src);
    return () => {
      resolved.revoke?.();
    };
  }, [preview]);

  if (!docs.length) return <EmptyBlock text="No documents for this candidate" />;

  return (
    <>
      <ul className="space-y-2">
        {docs.map((d) => {
          const status = d.status ?? "pending";
          const href = getDocumentHref(d);
          return (
            <li
              key={d.id}
              className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] px-3 py-2.5"
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#FFF1F2] text-[#F43F5E]">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[12px] font-medium text-[#111827]">{d.fileName}</p>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      docStatusTone(status),
                    )}
                  >
                    {DOC_STATUS_LABELS[status]}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-[#6B7280]">
                  {DOC_KIND_LABELS[d.kind] ?? d.kind} · Uploaded {formatPostedOn(d.uploadedAt)}
                  {d.expiryDate ? ` · Expires ${formatPostedOn(d.expiryDate)}` : ""}
                </p>
              </div>
              {href ? (
                <button
                  type="button"
                  onClick={() => setPreview(d)}
                  className="inline-flex h-7 shrink-0 cursor-pointer items-center rounded-md border border-[#E5E7EB] bg-white px-2 text-[10px] font-medium text-[#374151] transition-colors duration-150 hover:bg-[#F9FAFB]"
                >
                  View
                </button>
              ) : (
                <span className="shrink-0 text-[10px] text-[#9CA3AF]">No file</span>
              )}
            </li>
          );
        })}
      </ul>
      {preview && previewSrc ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-3"
          onClick={() => setPreview(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="flex h-[min(820px,90vh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#F3F4F6] px-4 py-3">
              <p className="truncate text-[13px] font-semibold text-[#111827]">{preview.fileName}</p>
              <button
                type="button"
                className="inline-flex h-8 cursor-pointer items-center rounded-md border border-[#E5E7EB] px-2 text-[11px] text-[#374151] transition-colors duration-150 hover:bg-[#F9FAFB]"
                onClick={() => setPreview(null)}
              >
                Close
              </button>
            </div>
            {isPdfHref({
              fileName: preview.fileName,
              mimeType: preview.mimeType,
              href: previewSrc,
            }) ? (
              <embed
                title={preview.fileName}
                src={previewSrc}
                type="application/pdf"
                className="min-h-0 flex-1 bg-white"
              />
            ) : (
              <iframe title={preview.fileName} src={previewSrc} className="min-h-0 flex-1 bg-[#F3F4F6]" />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function InterviewsTab({
  interviews,
  job,
}: {
  interviews: AtsInterview[];
  job: JobOpening | null;
}) {
  if (!interviews.length) return <EmptyBlock text="No interviews scheduled" />;
  return (
    <ul className="space-y-2">
      {interviews.map((i) => {
        const round = i.round || i.interviewType;
        return (
          <li
            key={i.id}
            className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] px-3 py-2.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[12px] font-medium text-[#111827]">
                  {i.interviewCode} · {INTERVIEW_ROUND_LABELS[i.round] ?? String(round)}
                </p>
                <p className="mt-0.5 text-[10px] text-[#6B7280]">
                  {job?.title || "Open role"} · {i.mode === "online" ? "Online" : "Offline"}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                  interviewStatusTone(i.status),
                )}
              >
                {i.status}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#374151]">
              <span>
                {formatPostedOn(i.date)} · {interviewTimeWindow(i.time)}
              </span>
              <span>{i.interviewer || i.participantNames?.join(", ") || "No interviewer"}</span>
            </div>
            {i.feedback ? (
              <p className="mt-1.5 text-[11px] text-[#6B7280]">{i.feedback}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function OffersTab({ offers, job }: { offers: AtsOffer[]; job: JobOpening | null }) {
  if (!offers.length) return <EmptyBlock text="No offers yet" />;
  return (
    <ul className="space-y-2">
      {offers.map((o) => (
        <li key={o.id} className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] px-3 py-2.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[12px] font-medium text-[#111827]">{o.offerCode}</p>
              <p className="mt-0.5 text-[10px] text-[#6B7280]">
                {job?.title || o.department || "Offer"} · Join {o.joiningDate || "—"}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                offerStatusTone(o.status),
              )}
            >
              {OFFER_STATUS_LABELS[o.status]}
            </span>
          </div>
          <p className="mt-2 text-[12px] font-semibold text-[#111827]">
            CTC {o.ctc ? formatInr(o.ctc) : "—"}
          </p>
          {o.offerLetterName ? (
            <p className="mt-0.5 text-[10px] text-[#6B7280]">{o.offerLetterName}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FileText className="size-5" />
      </div>
      <p className="text-[12px] text-[#6B7280]">{text}</p>
    </div>
  );
}
