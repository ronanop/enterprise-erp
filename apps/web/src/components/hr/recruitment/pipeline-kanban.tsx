"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Briefcase,
  CheckCircle2,
  FileSearch,
  FileText,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  PartyPopper,
  Plus,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { InitialsAvatar } from "@/components/hr/recruitment/dashboard/status-badge";
import { SourceBrandIcon } from "@/components/hr/recruitment/source-brand-icon";
import { Button } from "@/components/ui/button";
import {
  canAdvance,
  canMarkBackedOut,
  canMarkHired,
  daysInStage,
  nextStage,
} from "@/config/pipeline-config";
import { cn } from "@/lib/utils";
import type {
  AtsCandidate,
  AtsInterview,
  JobOpening,
  PipelineApplication,
  PipelineStage,
} from "@/types/recruitment-ats";
import { PIPELINE_STAGES, SOURCE_LABELS } from "@/types/recruitment-ats";

type Props = {
  applications: PipelineApplication[];
  candidates: AtsCandidate[];
  jobs: JobOpening[];
  interviews?: AtsInterview[];
  onAdvance: (applicationId: string) => void;
  onReject: (applicationId: string, reason: string) => void;
  onMarkHired: (applicationId: string) => void;
  onMarkBackedOut: (applicationId: string, reason: string) => void;
  onMoveStage?: (applicationId: string, stage: PipelineStage) => void;
  onAddCandidate?: () => void;
  onViewProfile?: (candidate: AtsCandidate) => void;
};

type ReasonModal = {
  mode: "reject" | "backed_out";
  applicationId: string;
} | null;

type DetailTab = "overview" | "interviews" | "documents" | "activity";

type StageChrome = {
  headerBg: string;
  headerText: string;
  icon: LucideIcon;
  countTone: string;
};

const STAGE_CHROME: Record<PipelineStage, StageChrome> = {
  sourced: {
    headerBg: "bg-[#F3F4F6]",
    headerText: "text-[#374151]",
    icon: UserPlus,
    countTone: "text-[#6B7280]",
  },
  screening: {
    headerBg: "bg-[#EEF6FF]",
    headerText: "text-[#1D4ED8]",
    icon: FileSearch,
    countTone: "text-[#3B82F6]",
  },
  interview_round_1: {
    headerBg: "bg-[#F4EDFB]",
    headerText: "text-[#7C3AED]",
    icon: MessageSquare,
    countTone: "text-[#8B5CF6]",
  },
  interview_round_2: {
    headerBg: "bg-[#FFF4E5]",
    headerText: "text-[#C2410C]",
    icon: Users,
    countTone: "text-[#EA580C]",
  },
  hr_discussion: {
    headerBg: "bg-[#ECFDF5]",
    headerText: "text-[#047857]",
    icon: Briefcase,
    countTone: "text-[#00A866]",
  },
  background_check: {
    headerBg: "bg-[#FFF7ED]",
    headerText: "text-[#B45309]",
    icon: ShieldCheck,
    countTone: "text-[#D97706]",
  },
  offer_sent: {
    headerBg: "bg-[#FCE7F3]",
    headerText: "text-[#BE185D]",
    icon: Send,
    countTone: "text-[#DB2777]",
  },
  offer_accepted: {
    headerBg: "bg-[#ECFDF5]",
    headerText: "text-[#047857]",
    icon: PartyPopper,
    countTone: "text-[#00A866]",
  },
};

function stageLabel(stage: PipelineStage): string {
  return PIPELINE_STAGES.find((s) => s.id === stage)?.label ?? stage;
}

function statusChip(app: PipelineApplication): { label: string; className: string } {
  switch (app.status) {
    case "hired":
      return { label: "Hired", className: "bg-[#ECFDF5] text-[#00A866]" };
    case "rejected":
      return { label: "Rejected", className: "bg-[#FFF1F2] text-[#F43F5E]" };
    case "backed_out":
      return { label: "Backed Out", className: "bg-[#FFF1F2] text-[#BE123C]" };
    case "offer_declined":
      return { label: "Offer Declined", className: "bg-[#FFF1F2] text-[#F43F5E]" };
    case "active":
      return {
        label: stageLabel(app.stage),
        className: "bg-[#F5F3FF] text-[#7C3AED]",
      };
    default: {
      const _exhaustive: never = app.status;
      return { label: String(_exhaustive), className: "bg-[#F3F4F6] text-[#6B7280]" };
    }
  }
}

export function PipelineKanban({
  applications,
  candidates,
  jobs,
  interviews = [],
  onAdvance,
  onReject,
  onMarkHired,
  onMarkBackedOut,
  onMoveStage,
  onAddCandidate,
  onViewProfile,
}: Props) {
  const [reasonModal, setReasonModal] = useState<ReasonModal>(null);
  const [reason, setReason] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [menuAppId, setMenuAppId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);

  const candMap = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const byStage = useMemo(() => {
    const map = new Map<PipelineStage, PipelineApplication[]>();
    for (const s of PIPELINE_STAGES) map.set(s.id, []);
    for (const a of applications) {
      if (a.status !== "active") continue;
      const list = map.get(a.stage) ?? map.get("sourced")!;
      list.push(a);
    }
    return map;
  }, [applications]);

  const selected = useMemo(
    () => applications.find((a) => a.id === selectedId) ?? null,
    [applications, selectedId],
  );
  const selectedCand = selected ? (candMap.get(selected.candidateId) ?? null) : null;
  const selectedJob = selected ? (jobMap.get(selected.jobId) ?? null) : null;
  const selectedInterviews = useMemo(
    () => (selected ? interviews.filter((i) => i.applicationId === selected.id) : []),
    [interviews, selected],
  );

  useEffect(() => {
    if (!menuAppId) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (menuBtnRef.current?.contains(t)) return;
      const menu = document.getElementById("pipeline-card-menu");
      if (menu?.contains(t)) return;
      setMenuAppId(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuAppId]);

  function confirmReason() {
    if (!reasonModal || !reason.trim()) return;
    if (reasonModal.mode === "reject") onReject(reasonModal.applicationId, reason.trim());
    else onMarkBackedOut(reasonModal.applicationId, reason.trim());
    setReasonModal(null);
    setReason("");
  }

  function openCard(app: PipelineApplication) {
    setSelectedId(app.id);
    setDetailTab("overview");
    setMenuAppId(null);
  }

  return (
    <>
      <div className="erp-scroll flex gap-3 overflow-x-auto pb-1">
          {PIPELINE_STAGES.map((stage) => {
            const cards = byStage.get(stage.id) ?? [];
            const chrome = STAGE_CHROME[stage.id];
            const Icon = chrome.icon;
            return (
              <div
                key={stage.id}
                className="flex w-[240px] shrink-0 flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#FAFBFC]"
              >
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5",
                    chrome.headerBg,
                    chrome.headerText,
                  )}
                >
                  <Icon className="size-3.5 shrink-0" strokeWidth={2} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold leading-tight">
                      {stage.label}
                    </p>
                    <p className={cn("text-[10px] font-medium", chrome.countTone)}>
                      {cards.length} candidate{cards.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-current/70 transition-colors hover:bg-black/5 hover:text-current"
                    aria-label={`Add candidate to ${stage.label}`}
                    onClick={() => onAddCandidate?.()}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>

                <div className="flex max-h-[min(560px,calc(100vh-320px))] flex-col gap-2 overflow-y-auto p-2">
                  {cards.length === 0 ? (
                    <EmptyColumn />
                  ) : (
                    cards.map((app, idx) => {
                      const cand = candMap.get(app.candidateId);
                      const job = jobMap.get(app.jobId);
                      const days = daysInStage(app.stageEnteredAt || app.updatedAt);
                      return (
                        <PipelineCard
                          key={app.id}
                          app={app}
                          cand={cand}
                          job={job}
                          days={days}
                          toneIndex={idx}
                          menuOpen={menuAppId === app.id}
                          onOpen={() => openCard(app)}
                          onMenuToggle={(btn) => {
                            if (menuAppId === app.id) {
                              setMenuAppId(null);
                              return;
                            }
                            menuBtnRef.current = btn;
                            const r = btn.getBoundingClientRect();
                            setMenuPos({ top: r.bottom + 4, left: Math.min(r.right - 160, window.innerWidth - 168) });
                            setMenuAppId(app.id);
                          }}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

      {menuAppId && menuPos
        ? createPortal(
            <div
              id="pipeline-card-menu"
              className="fixed z-[80] w-40 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              {(() => {
                const app = applications.find((a) => a.id === menuAppId);
                if (!app) return null;
                const nxt = nextStage(app.stage);
                return (
                  <>
                    <MenuItem
                      label="View details"
                      onClick={() => {
                        openCard(app);
                        setMenuAppId(null);
                      }}
                    />
                    {canAdvance(app.stage, app.status) && nxt ? (
                      <MenuItem
                        label="Advance"
                        onClick={() => {
                          onAdvance(app.id);
                          setMenuAppId(null);
                        }}
                      />
                    ) : null}
                    <MenuItem
                      label="Reject"
                      danger
                      onClick={() => {
                        setReason("");
                        setReasonModal({ mode: "reject", applicationId: app.id });
                        setMenuAppId(null);
                      }}
                    />
                    {canMarkHired(app.stage, app.status) ? (
                      <MenuItem
                        label="Mark Hired"
                        onClick={() => {
                          onMarkHired(app.id);
                          setMenuAppId(null);
                        }}
                      />
                    ) : null}
                    {canMarkBackedOut(app.stage, app.status) ? (
                      <MenuItem
                        label="Mark Backed Out"
                        danger
                        onClick={() => {
                          setReason("");
                          setReasonModal({ mode: "backed_out", applicationId: app.id });
                          setMenuAppId(null);
                        }}
                      />
                    ) : null}
                  </>
                );
              })()}
            </div>,
            document.body,
          )
        : null}

      {selected && selectedCand ? (
        <CandidateDetailPopover
          application={selected}
          candidate={selectedCand}
          job={selectedJob}
          interviews={selectedInterviews}
          tab={detailTab}
          onTabChange={setDetailTab}
          onClose={() => setSelectedId(null)}
          onViewProfile={() => {
            onViewProfile?.(selectedCand);
            setSelectedId(null);
          }}
          onMoveStage={(stage) => {
            onMoveStage?.(selected.id, stage);
            setSelectedId(null);
          }}
          onAdvance={() => {
            onAdvance(selected.id);
            setSelectedId(null);
          }}
          onReject={() => {
            setReason("");
            setReasonModal({ mode: "reject", applicationId: selected.id });
            setSelectedId(null);
          }}
        />
      ) : null}

      {reasonModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold text-foreground">
              {reasonModal.mode === "reject" ? "Reject candidate" : "Mark backed out"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Exit reason is required.</p>
            <textarea
              className="mt-3 min-h-[88px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason…"
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                  setReasonModal(null);
                  setReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="cursor-pointer bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
                disabled={!reason.trim()}
                onClick={confirmReason}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function EmptyColumn() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#E5E7EB] bg-white px-3 py-10 text-center">
      <div className="flex size-9 items-center justify-center rounded-full bg-[#F3F4F6] text-[#9CA3AF]">
        <Users className="size-4" />
      </div>
      <p className="text-[11px] font-medium text-[#6B7280]">No candidates</p>
      <p className="text-[10px] text-[#9CA3AF]">Move candidates here from another stage</p>
    </div>
  );
}

function PipelineCard({
  app,
  cand,
  job,
  days,
  toneIndex,
  menuOpen,
  onOpen,
  onMenuToggle,
}: {
  app: PipelineApplication;
  cand: AtsCandidate | undefined;
  job: JobOpening | undefined;
  days: number;
  toneIndex: number;
  menuOpen: boolean;
  onOpen: () => void;
  onMenuToggle: (btn: HTMLButtonElement) => void;
}) {
  const loc = cand?.location || cand?.state || "—";
  const exp =
    cand?.experienceYears != null && cand.experienceYears > 0
      ? `${cand.experienceYears} yr${cand.experienceYears === 1 ? "" : "s"}`
      : "—";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "cursor-pointer rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-150 hover:shadow-md",
        menuOpen && "ring-1 ring-[#7C3AED]/40",
      )}
    >
      <div className="flex items-start gap-2">
        <InitialsAvatar name={cand?.fullName ?? "?"} toneIndex={toneIndex} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <p className="truncate text-[12px] font-semibold text-[#111827]">
              {cand?.fullName ?? "Candidate"}
            </p>
            <button
              type="button"
              className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151]"
              aria-label="Card actions"
              onClick={(e) => {
                e.stopPropagation();
                onMenuToggle(e.currentTarget);
              }}
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-[#6B7280]">{job?.title ?? "Role"}</p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[#6B7280]">
        <span className="inline-flex items-center gap-1">
          <SourceBrandIcon source={cand?.source ?? "other"} />
          <span>{SOURCE_LABELS[(cand?.source as keyof typeof SOURCE_LABELS) ?? "other"] ?? "Other"}</span>
        </span>
        <span className="text-[#D1D5DB]">·</span>
        <span>{exp}</span>
        <span className="text-[#D1D5DB]">·</span>
        <span className="inline-flex min-w-0 items-center gap-0.5">
          <MapPin className="size-2.5 shrink-0" />
          <span className="truncate">{loc}</span>
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-[#9CA3AF]">{days}d ago</span>
        <span className="truncate text-[9px] text-[#D1D5DB]">{app.applicationCode}</span>
      </div>
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-[#F9FAFB]",
        danger ? "text-[#F43F5E]" : "text-[#374151]",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function CandidateDetailPopover({
  application,
  candidate,
  job,
  interviews,
  tab,
  onTabChange,
  onClose,
  onViewProfile,
  onMoveStage,
  onAdvance,
  onReject,
}: {
  application: PipelineApplication;
  candidate: AtsCandidate;
  job: JobOpening | null;
  interviews: AtsInterview[];
  tab: DetailTab;
  onTabChange: (t: DetailTab) => void;
  onClose: () => void;
  onViewProfile: () => void;
  onMoveStage: (stage: PipelineStage) => void;
  onAdvance: () => void;
  onReject: () => void;
}) {
  const chip = statusChip(application);
  const days = daysInStage(application.stageEnteredAt || application.updatedAt);
  const nxt = nextStage(application.stage);
  const history =
    application.stageHistory?.length
      ? application.stageHistory
      : [
          {
            stage: application.stage,
            label: stageLabel(application.stage),
            enteredAt: application.stageEnteredAt || application.appliedAt,
          },
        ];

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "interviews", label: "Interviews" },
    { id: "documents", label: "Documents" },
    { id: "activity", label: "Activity" },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/35 p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[min(640px,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-[#F3F4F6] px-4 py-3.5">
          <InitialsAvatar name={candidate.fullName} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#111827]">{candidate.fullName}</p>
                <p className="mt-0.5 truncate text-[11px] text-[#6B7280]">
                  {job?.title ?? "Role"} · {application.applicationCode}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6]"
                aria-label="Close"
                onClick={onClose}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  chip.className,
                )}
              >
                {chip.label}
              </span>
              <span className="text-[10px] text-[#9CA3AF]">{days}d in stage</span>
            </div>
          </div>
        </div>

        <div className="flex gap-1 border-b border-[#F3F4F6] px-3 pt-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn(
                "cursor-pointer rounded-t-md px-3 py-2 text-[11px] font-medium transition-colors",
                tab === t.id
                  ? "border-b-2 border-[#7C3AED] text-[#7C3AED]"
                  : "text-[#6B7280] hover:text-[#374151]",
              )}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="erp-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {tab === "overview" ? (
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <Field label="Email" value={candidate.email || "—"} />
              <Field label="Phone" value={candidate.phone || "—"} />
              <Field
                label="Experience"
                value={
                  candidate.experienceYears != null
                    ? `${candidate.experienceYears} years`
                    : "—"
                }
              />
              <Field label="Location" value={candidate.location || candidate.state || "—"} />
              <Field
                label="Source"
                value={SOURCE_LABELS[candidate.source] ?? candidate.source}
              />
              <Field label="Current company" value={candidate.currentCompany || "—"} />
              <Field
                label="Expected CTC"
                value={
                  candidate.expectedSalary
                    ? `₹${candidate.expectedSalary.toLocaleString("en-IN")}`
                    : "—"
                }
              />
              <Field
                label="Notice"
                value={
                  candidate.noticePeriodDays != null
                    ? `${candidate.noticePeriodDays} days`
                    : "—"
                }
              />
              {application.notes ? (
                <div className="col-span-2">
                  <Field label="Notes" value={application.notes} />
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "interviews" ? (
            interviews.length === 0 ? (
              <EmptyPane
                icon={MessageSquare}
                title="No interviews yet"
                subtitle="Scheduled interviews for this application will appear here"
              />
            ) : (
              <ul className="space-y-2">
                {interviews.map((iv) => (
                  <li
                    key={iv.id}
                    className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2"
                  >
                    <p className="text-[11px] font-medium text-[#111827]">
                      {iv.interviewCode} · {iv.round.replace("_", " ")}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#6B7280]">
                      {iv.date} {iv.time} · {iv.status}
                    </p>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === "documents" ? (
            candidate.resumeName || candidate.resumeUrl ? (
              <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2.5">
                <FileText className="size-4 text-[#7C3AED]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-[#111827]">
                    {candidate.resumeName || "Resume"}
                  </p>
                  {candidate.resumeUrl ? (
                    <a
                      href={candidate.resumeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-[#7C3AED] hover:underline"
                    >
                      Open
                    </a>
                  ) : null}
                </div>
              </div>
            ) : (
              <EmptyPane
                icon={FileText}
                title="No documents"
                subtitle="Resume and other files will show here once uploaded"
              />
            )
          ) : null}

          {tab === "activity" ? (
            history.length === 0 ? (
              <EmptyPane
                icon={CheckCircle2}
                title="No activity"
                subtitle="Stage changes will be listed here"
              />
            ) : (
              <ol className="space-y-2">
                {history.map((h, i) => (
                  <li key={`${h.stage}-${i}`} className="flex gap-2 text-[11px]">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#7C3AED]" />
                    <div>
                      <p className="font-medium text-[#111827]">{h.label}</p>
                      <p className="text-[10px] text-[#9CA3AF]">
                        Entered {new Date(h.enteredAt).toLocaleString()}
                        {h.exitedAt ? ` · Left ${new Date(h.exitedAt).toLocaleString()}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F3F4F6] bg-[#FAFBFC] px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 cursor-pointer text-[11px]"
            onClick={onViewProfile}
          >
            View Profile
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {canAdvance(application.stage, application.status) && nxt ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 cursor-pointer text-[11px]"
                onClick={onAdvance}
              >
                Advance
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 cursor-pointer text-[11px] text-[#F43F5E]"
              onClick={onReject}
            >
              Reject
            </Button>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-[#374151]">
              <span className="sr-only">Move stage</span>
              <select
                className="h-8 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-2 text-[11px] font-medium text-[#7C3AED] outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
                value={application.stage}
                onChange={(e) => onMoveStage(e.target.value as PipelineStage)}
              >
                {PIPELINE_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    Move: {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium tracking-wide text-[#9CA3AF] uppercase">{label}</p>
      <p className="mt-0.5 break-words font-medium text-[#111827]">{value}</p>
    </div>
  );
}

function EmptyPane({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-[#F3F4F6] text-[#9CA3AF]">
        <Icon className="size-4" />
      </div>
      <p className="text-[12px] font-medium text-[#6B7280]">{title}</p>
      <p className="max-w-[240px] text-[10px] text-[#9CA3AF]">{subtitle}</p>
    </div>
  );
}
