"use client";

import { useMemo, useState } from "react";
import {
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  DoorOpen,
  Eye,
  FileSearch,
  FileText,
  IndianRupee,
  Mail,
  MessageSquare,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { formatInrGrouping } from "@/services/recruitment-ats-lookups";
import {
  bgPortalStatusLabel,
  bgPortalStatusTone,
} from "@/services/bg-check-portal-service";

import { InitialsAvatar } from "@/components/hr/recruitment/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { RowActionsItem, RowActionsMenu } from "@/components/ui/row-actions-menu";
import { nextStage, PIPELINE_NAV_STAGES, PIPELINE_STAGES } from "@/config/pipeline-config";
import { cn } from "@/lib/utils";
import type {
  AtsCandidate,
  AtsInterview,
  AtsOffer,
  InterviewRecommendation,
  InterviewRound,
  JobOpening,
  PipelineApplication,
  PipelineStage,
} from "@/types/recruitment-ats";

function isBgTerminalStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "verified" || s === "cleared" || s === "rejected" || s === "failed";
}

export type PipelineAdvanceOutcome = {
  applicationId: string;
  recommendation: InterviewRecommendation;
  feedback: string;
};

type Props = {
  applications: PipelineApplication[];
  candidates: AtsCandidate[];
  jobs: JobOpening[];
  interviews?: AtsInterview[];
  initialStage?: PipelineStage | "all";
  onAdvanceOutcome: (input: PipelineAdvanceOutcome) => void;
  onReject: (applicationId: string, reason: string) => void;
  onScheduleInterview?: (
    application: PipelineApplication,
    candidate: AtsCandidate,
    round: InterviewRound,
  ) => void;
  /** Capture salary discussed in Negotiation Round (prefills offer CTC). */
  onSetNegotiatedSalary?: (application: PipelineApplication, candidate: AtsCandidate) => void;
  /** Optional: create/resend document portal alone (usually bundled with offer send). */
  onRequestBgDocs?: (application: PipelineApplication, candidate: AtsCandidate) => void;
  /** Open HR drawer to preview candidate-uploaded BG portal documents. */
  onViewBgDocs?: (application: PipelineApplication, candidate: AtsCandidate) => void;
  /** Vendor BG email with attachments (BG stage). */
  onSendBgCheck?: (application: PipelineApplication, candidate: AtsCandidate) => void;
  /** HR marks BG docs verified or rejected. */
  onReviewBgPortal?: (
    application: PipelineApplication,
    candidate: AtsCandidate,
    decision: "verified" | "rejected",
  ) => void;
  /** applicationId → portal status (docs_requested, docs_submitted, verified, rejected, …) */
  bgPortalStatusByAppId?: Record<string, string>;
  /** Create / send a new offer letter (opens template picker). */
  onGenerateOffer?: (application: PipelineApplication, candidate: AtsCandidate) => void;
  /** Preview an offer letter that was already created (Documents). */
  onViewOfferLetter?: (application: PipelineApplication, candidate: AtsCandidate) => void;
  offers?: AtsOffer[];
  onAcceptOffer?: (application: PipelineApplication, candidate: AtsCandidate) => void;
  /** Candidate backed out after offer (BG / offer stage). */
  onBackOut?: (application: PipelineApplication, candidate: AtsCandidate) => void;
  onViewProfile?: (candidate: AtsCandidate) => void;
  onCompleteOnboarding?: (
    application: PipelineApplication,
    candidate: AtsCandidate,
  ) => void;
};

const STAGE_ICONS: Partial<Record<PipelineStage, typeof FileSearch>> = {
  screening: FileSearch,
  interview_round_1: MessageSquare,
  interview_round_2: Users,
  hr_discussion: MessageSquare,
  background_check: ShieldCheck,
  offer_sent: FileText,
  offer_accepted: CheckCircle2,
};

function nextInterviewRound(stage: PipelineStage): InterviewRound | null {
  switch (stage) {
    case "screening":
      return "round_1";
    case "interview_round_1":
      return "round_2";
    case "interview_round_2":
      return "hr";
    default:
      return null;
  }
}

function outcomeTitle(stage: PipelineStage): string {
  switch (stage) {
    case "interview_round_1":
      return "Round 1 result";
    case "interview_round_2":
      return "Round 2 result";
    case "hr_discussion":
      return "Negotiation Round result";
    case "background_check":
      return "Background check result";
    default:
      return "Phase result";
  }
}

function scheduleLabel(round: InterviewRound): string {
  switch (round) {
    case "round_1":
      return "Schedule Round 1";
    case "round_2":
      return "Schedule Round 2";
    case "hr":
      return "Schedule Negotiation Round";
    default: {
      const _exhaustive: never = round;
      return String(_exhaustive);
    }
  }
}

function moveNextLabel(stage: PipelineStage): string {
  switch (stage) {
    case "interview_round_1":
      return "Move to Round 2";
    case "interview_round_2":
      return "Move to HR";
    case "hr_discussion":
      return "Generate & send offer";
    case "background_check":
      return "Generate & send offer";
    default:
      return "Advance";
  }
}

function hasRoundInterview(
  interviews: AtsInterview[],
  app: PipelineApplication,
  round: InterviewRound,
): boolean {
  return interviews.some(
    (i) =>
      i.applicationId === app.id &&
      (i.round === round || i.interviewType === round) &&
      (i.status === "scheduled" || i.status === "completed"),
  );
}

export function PipelineStageBoard({
  applications,
  candidates,
  jobs,
  interviews = [],
  initialStage,
  onAdvanceOutcome,
  onReject,
  onScheduleInterview,
  onSetNegotiatedSalary,
  onRequestBgDocs,
  onViewBgDocs,
  onSendBgCheck,
  onReviewBgPortal,
  bgPortalStatusByAppId = {},
  onGenerateOffer,
  onViewOfferLetter,
  offers = [],
  onAcceptOffer,
  onBackOut,
  onViewProfile,
  onCompleteOnboarding,
}: Props) {
  const [stage, setStage] = useState<PipelineStage>(() => {
    const raw =
      initialStage && initialStage !== "all" ? initialStage : "screening";
    // Offer Sent nav removed — land on Background Check instead
    return raw === "offer_sent" ? "background_check" : raw;
  });
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [outcomeAppId, setOutcomeAppId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<InterviewRecommendation | "">("");
  const [feedback, setFeedback] = useState("");
  const [menuAppId, setMenuAppId] = useState<string | null>(null);

  function findOfferForApp(app: PipelineApplication, candidateId: string): AtsOffer | undefined {
    return (
      offers.find((o) => o.applicationId === app.id) ||
      offers.find((o) => o.candidateId === candidateId && o.jobId === app.jobId)
    );
  }

  const candById = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const counts = useMemo(() => {
    const map = new Map<PipelineStage, number>();
    for (const s of PIPELINE_NAV_STAGES) map.set(s.id, 0);
    for (const a of applications) {
      if (a.status !== "active") continue;
      // Offer Sent is hidden — count those candidates under Background Check
      if (a.stage === "offer_sent") {
        map.set("background_check", (map.get("background_check") ?? 0) + 1);
        continue;
      }
      if (map.has(a.stage)) {
        map.set(a.stage, (map.get(a.stage) ?? 0) + 1);
      }
    }
    return map;
  }, [applications]);

  const rows = useMemo(() => {
    if (stage !== "background_check") {
      return applications.filter((a) => a.status === "active" && a.stage === stage);
    }
    // Background Check includes offer_sent (Offer Sent nav removed)
    return applications.filter(
      (a) =>
        a.status === "active" &&
        (a.stage === "background_check" || a.stage === "offer_sent"),
    );
  }, [applications, stage]);

  function openOutcome(appId: string) {
    setOutcomeAppId(appId);
    setRecommendation("");
    setFeedback("");
  }

  function confirmOutcome() {
    if (!outcomeAppId || !recommendation || !feedback.trim()) return;
    onAdvanceOutcome({
      applicationId: outcomeAppId,
      recommendation,
      feedback: feedback.trim(),
    });
    setOutcomeAppId(null);
    setRecommendation("");
    setFeedback("");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-border/70 bg-card p-2 shadow-sm">
        <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Pipeline stages
        </p>
        <nav className="space-y-0.5" aria-label="Pipeline stages">
          {PIPELINE_NAV_STAGES.map((s) => {
            const Icon = STAGE_ICONS[s.id] ?? ChevronRight;
            const active = stage === s.id;
            const count = counts.get(s.id) ?? 0;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStage(s.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors duration-200",
                  active
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-foreground hover:bg-muted/60",
                )}
              >
                <Icon className="size-3.5 shrink-0 opacity-80" />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="min-w-0 rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {PIPELINE_NAV_STAGES.find((s) => s.id === stage)?.label ??
                PIPELINE_STAGES.find((s) => s.id === stage)?.label ??
                stage}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {rows.length} active candidate{rows.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {!rows.length ? (
          <div className="px-4 py-16 text-center text-sm text-muted-foreground">
            No candidates in this stage yet.
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {rows.map((app) => {
              const cand = candById.get(app.candidateId);
              const job = jobById.get(app.jobId);
              if (!cand) return null;

              const scheduleRound = nextInterviewRound(stage);
              const currentRound: InterviewRound | null =
                stage === "interview_round_1"
                  ? "round_1"
                  : stage === "interview_round_2"
                    ? "round_2"
                    : stage === "hr_discussion"
                      ? "hr"
                      : scheduleRound;
              const scheduledHere =
                currentRound != null && hasRoundInterview(interviews, app, currentRound);
              const bgStatus = bgPortalStatusByAppId[app.id];
              const showBgBadge = stage === "background_check";

              return (
                <li
                  key={app.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/30"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                    onClick={() => onViewProfile?.(cand)}
                  >
                    <InitialsAvatar name={cand.fullName} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{cand.fullName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {job?.title || "Role"} · {cand.email || cand.phone || cand.candidateCode}
                      </p>
                    </div>
                  </button>
                  {showBgBadge ? (
                    <button
                      type="button"
                      title="View uploaded BG documents"
                      className={cn(
                        "shrink-0 cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-semibold transition-opacity duration-150 hover:opacity-80",
                        bgPortalStatusTone(bgStatus || "docs_requested"),
                      )}
                      onClick={() => onViewBgDocs?.(app, cand)}
                    >
                      {bgPortalStatusLabel(bgStatus || "docs_requested")}
                    </button>
                  ) : null}
                  <RowActionsMenu
                    open={menuAppId === app.id}
                    onOpenChange={(open) => setMenuAppId(open ? app.id : null)}
                    align="end"
                    menuClassName="min-w-[14rem]"
                  >
                    {stage === "screening" ? (
                      <RowActionsItem
                        onClick={() => {
                          setMenuAppId(null);
                          onScheduleInterview?.(app, cand, "round_1");
                        }}
                      >
                        <CalendarPlus className="size-3.5 shrink-0" />
                        Schedule Round 1
                      </RowActionsItem>
                    ) : null}

                    {stage === "hr_discussion" ? (
                      <>
                        <RowActionsItem
                          onClick={() => {
                            setMenuAppId(null);
                            onSetNegotiatedSalary?.(app, cand);
                          }}
                        >
                          <IndianRupee className="size-3.5 shrink-0" />
                          {app.negotiatedCtc
                            ? `Salary ₹${formatInrGrouping(app.negotiatedCtc)}`
                            : "Add salary"}
                        </RowActionsItem>
                        <RowActionsItem
                          onClick={() => {
                            setMenuAppId(null);
                            onGenerateOffer?.(app, cand);
                          }}
                        >
                          <FileText className="size-3.5 shrink-0" />
                          Create offer letter
                        </RowActionsItem>
                      </>
                    ) : null}

                    {stage === "interview_round_1" || stage === "interview_round_2" ? (
                      <RowActionsItem
                        onClick={() => {
                          setMenuAppId(null);
                          openOutcome(app.id);
                        }}
                      >
                        <ChevronRight className="size-3.5 shrink-0" />
                        {moveNextLabel(stage)}
                      </RowActionsItem>
                    ) : null}

                    {(stage === "interview_round_1" ||
                      stage === "interview_round_2" ||
                      stage === "hr_discussion") &&
                    currentRound ? (
                      <RowActionsItem
                        onClick={() => {
                          setMenuAppId(null);
                          onScheduleInterview?.(app, cand, currentRound);
                        }}
                      >
                        <CalendarPlus className="size-3.5 shrink-0" />
                        {scheduledHere
                          ? `Reschedule ${currentRound === "hr" ? "Negotiation" : currentRound === "round_2" ? "Round 2" : "Round 1"}`
                          : scheduleLabel(currentRound)}
                      </RowActionsItem>
                    ) : null}

                    {stage === "background_check" ? (
                      <>
                        <RowActionsItem
                          onClick={() => {
                            setMenuAppId(null);
                            onViewBgDocs?.(app, cand);
                          }}
                        >
                          <Eye className="size-3.5 shrink-0" />
                          View uploaded docs
                        </RowActionsItem>
                        <RowActionsItem
                          onClick={() => {
                            setMenuAppId(null);
                            onRequestBgDocs?.(app, cand);
                          }}
                        >
                          <ShieldCheck className="size-3.5 shrink-0" />
                          Resend doc link
                        </RowActionsItem>
                        <RowActionsItem
                          onClick={() => {
                            setMenuAppId(null);
                            onSendBgCheck?.(app, cand);
                          }}
                        >
                          <Mail className="size-3.5 shrink-0" />
                          Send BG check
                        </RowActionsItem>
                        {findOfferForApp(app, cand.id) ? (
                          <RowActionsItem
                            onClick={() => {
                              setMenuAppId(null);
                              onViewOfferLetter?.(app, cand);
                            }}
                          >
                            <FileText className="size-3.5 shrink-0" />
                            Offer letter
                          </RowActionsItem>
                        ) : (
                          <RowActionsItem
                            onClick={() => {
                              setMenuAppId(null);
                              onGenerateOffer?.(app, cand);
                            }}
                          >
                            <FileText className="size-3.5 shrink-0" />
                            Create offer letter
                          </RowActionsItem>
                        )}
                        {!isBgTerminalStatus(bgStatus) ? (
                          <>
                            <RowActionsItem
                              onClick={() => {
                                setMenuAppId(null);
                                onReviewBgPortal?.(app, cand, "verified");
                              }}
                            >
                              <CheckCircle2 className="size-3.5 shrink-0" />
                              BG verified
                            </RowActionsItem>
                            <RowActionsItem
                              destructive
                              onClick={() => {
                                setMenuAppId(null);
                                onReviewBgPortal?.(app, cand, "rejected");
                              }}
                            >
                              <XCircle className="size-3.5 shrink-0" />
                              BG rejected
                            </RowActionsItem>
                          </>
                        ) : null}
                        {findOfferForApp(app, cand.id) ? (
                          <>
                            <RowActionsItem
                              onClick={() => {
                                setMenuAppId(null);
                                onAcceptOffer?.(app, cand);
                              }}
                            >
                              <CheckCircle2 className="size-3.5 shrink-0" />
                              Offer accepted
                            </RowActionsItem>
                            <RowActionsItem
                              destructive
                              onClick={() => {
                                setMenuAppId(null);
                                onBackOut?.(app, cand);
                              }}
                            >
                              <XCircle className="size-3.5 shrink-0" />
                              Backed out
                            </RowActionsItem>
                          </>
                        ) : null}
                      </>
                    ) : null}

                    {stage === "offer_accepted" ? (
                      <RowActionsItem
                        onClick={() => {
                          setMenuAppId(null);
                          onCompleteOnboarding?.(app, cand);
                        }}
                      >
                        <DoorOpen className="size-3.5 shrink-0" />
                        Complete onboarding
                      </RowActionsItem>
                    ) : null}

                    {stage !== "offer_accepted" && stage !== "background_check" ? (
                      <RowActionsItem
                        destructive
                        onClick={() => {
                          setMenuAppId(null);
                          setRejectId(app.id);
                          setRejectReason("");
                        }}
                      >
                        <XCircle className="size-3.5 shrink-0" />
                        Rejected
                      </RowActionsItem>
                    ) : null}
                  </RowActionsMenu>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {rejectId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg">
            <h4 className="text-sm font-semibold">Mark as rejected</h4>
            <p className="mt-1 text-xs text-muted-foreground">Reason is required for audit.</p>
            <textarea
              className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Skills mismatch"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={() => setRejectId(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="cursor-pointer"
                disabled={!rejectReason.trim()}
                onClick={() => {
                  onReject(rejectId, rejectReason.trim());
                  setRejectId(null);
                }}
              >
                Confirm rejected
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {outcomeAppId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          {(() => {
            const app = applications.find((a) => a.id === outcomeAppId);
            const fromStage = app?.stage ?? stage;
            const nxt = nextStage(fromStage);
            const toLabel =
              PIPELINE_STAGES.find((s) => s.id === nxt)?.label ?? "next stage";
            const nextRound = nextInterviewRound(fromStage);
            return (
              <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-lg">
                <h4 className="text-sm font-semibold">{outcomeTitle(fromStage)}</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose Selected / Rejected / Hold and add a reason.{" "}
                  {recommendation === "selected"
                    ? nextRound
                      ? `Selected moves them to ${toLabel}, then asks for date, time, meeting link and participants for ${scheduleLabel(nextRound)}.`
                      : `Selected moves them to ${toLabel}.`
                    : recommendation === "rejected"
                      ? "Rejected exits the candidate from the pipeline."
                      : recommendation === "hold"
                        ? "Hold keeps the candidate on this stage."
                        : nextRound
                          ? `If Selected, you will schedule the next round (${scheduleLabel(nextRound)}) next.`
                          : null}
                </p>
                <label className="mt-3 block text-[11px] font-medium text-foreground">
                  Result <span className="text-destructive">*</span>
                </label>
                <select
                  className="mt-1 h-9 w-full cursor-pointer rounded-md border border-input bg-background px-2 text-sm"
                  value={recommendation}
                  onChange={(e) =>
                    setRecommendation(e.target.value as InterviewRecommendation | "")
                  }
                >
                  <option value="">Select…</option>
                  <option value="selected">Selected / Proceed</option>
                  <option value="hold">Hold</option>
                  <option value="rejected">Rejected</option>
                </select>
                <label className="mt-3 block text-[11px] font-medium text-foreground">
                  Feedback / reason <span className="text-destructive">*</span>
                </label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={4}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={
                    recommendation === "rejected"
                      ? "Required rejection reason…"
                      : "Required review / feedback…"
                  }
                  autoFocus
                />
                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => {
                      setOutcomeAppId(null);
                      setRecommendation("");
                      setFeedback("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="cursor-pointer"
                    disabled={!recommendation || !feedback.trim()}
                    onClick={confirmOutcome}
                  >
                    {recommendation === "selected" && nextRound
                      ? `Continue to ${scheduleLabel(nextRound)}`
                      : recommendation === "selected"
                        ? "Save & advance"
                        : "Save result"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}
