/**
 * Recruitment pipeline — stage (kanban column) is independent of
 * status (active / exit outcome). Ported helpers for frontend + API parity.
 *
 * `sourced` = applied / awaiting HR accept on job detail (not shown in Pipeline nav).
 * Pipeline UI stages start at Screening.
 */

/** Applied / awaiting HR decision — hidden from Pipeline left nav */
export const APPLIED_STAGE_ID = "sourced" as const;

/** Hiring funnel stages (full set — includes offer_sent for data/legacy). */
export const PIPELINE_STAGES = [
  { id: "screening", label: "Screening", order: 1 },
  { id: "interview_round_1", label: "Interview Round 1", order: 2 },
  { id: "interview_round_2", label: "Interview Round 2", order: 3 },
  { id: "hr_discussion", label: "Negotiation Round", order: 4 },
  { id: "background_check", label: "Background Check", order: 5 },
  { id: "offer_sent", label: "Offer Sent", order: 6 },
  { id: "offer_accepted", label: "Offer Accepted", order: 7 },
] as const;

/** Left-nav stages on Pipeline (Offer Sent hidden — handled under Background Check). */
export const PIPELINE_NAV_STAGES = PIPELINE_STAGES.filter(
  (s) => s.id !== "offer_sent",
);

export type PipelineUiStageId = (typeof PIPELINE_STAGES)[number]["id"];
export type PipelineStageId = typeof APPLIED_STAGE_ID | PipelineUiStageId;

export const CANDIDATE_STATUSES = [
  "active",
  "rejected",
  "offer_declined",
  "backed_out",
  "hired",
] as const;

export type CandidatePipelineStatus = (typeof CANDIDATE_STATUSES)[number];

export const STATUS_LABELS: Record<CandidatePipelineStatus, string> = {
  active: "Active",
  rejected: "Rejected",
  offer_declined: "Offer Declined",
  backed_out: "Backed Out",
  hired: "Hired",
};

/** Full order including applied (sourced) → screening → … */
const FULL_STAGE_ORDER: PipelineStageId[] = [
  APPLIED_STAGE_ID,
  ...PIPELINE_STAGES.map((s) => s.id),
];

/** Legacy ATS / API stage codes → stage ids */
export const LEGACY_STAGE_MAP: Record<string, PipelineStageId> = {
  applied: APPLIED_STAGE_ID,
  sourced: APPLIED_STAGE_ID,
  resume_screening: "screening",
  hr_screening: "screening",
  screening: "screening",
  technical_interview: "interview_round_1",
  interview: "interview_round_1",
  interview_round_1: "interview_round_1",
  manager_interview: "interview_round_2",
  interview_round_2: "interview_round_2",
  final_interview: "hr_discussion",
  selected: "hr_discussion",
  hr_discussion: "hr_discussion",
  background_check: "background_check",
  offer: "offer_sent",
  offer_sent: "offer_sent",
  offer_accepted: "offer_accepted",
  hired: "offer_accepted",
};

export function normalizeStage(raw: string | null | undefined): PipelineStageId {
  if (!raw) return APPLIED_STAGE_ID;
  const key = raw.toLowerCase().trim();
  return LEGACY_STAGE_MAP[key] ?? "screening";
}

export function stageIndex(stage: PipelineStageId): number {
  return FULL_STAGE_ORDER.indexOf(stage);
}

export function nextStage(stage: PipelineStageId): PipelineStageId | null {
  const i = stageIndex(stage);
  if (i < 0 || i >= FULL_STAGE_ORDER.length - 1) return null;
  return FULL_STAGE_ORDER[i + 1];
}

export function canAdvance(
  stage: PipelineStageId,
  status: CandidatePipelineStatus,
): boolean {
  return status === "active" && nextStage(stage) != null;
}

export function canMarkHired(
  stage: PipelineStageId,
  status: CandidatePipelineStatus,
): boolean {
  return status === "active" && stage === "offer_accepted";
}

export function canMarkBackedOut(
  stage: PipelineStageId,
  status: CandidatePipelineStatus,
): boolean {
  return status === "active" && stage === "offer_accepted";
}

export function canReject(
  stage: PipelineStageId,
  status: CandidatePipelineStatus,
): boolean {
  return status === "active";
}

export function markRejected(input: {
  stage: PipelineStageId;
  exitReason: string;
}): {
  status: "rejected";
  exitedAtStage: PipelineStageId;
  exitReason: string;
} {
  const reason = input.exitReason.trim();
  if (!reason) throw new Error("exit_reason is required when rejecting");
  return {
    status: "rejected",
    exitedAtStage: input.stage,
    exitReason: reason,
  };
}

export function markBackedOut(input: {
  stage: PipelineStageId;
  status: CandidatePipelineStatus;
  exitReason: string;
}): {
  status: "backed_out";
  exitedAtStage: PipelineStageId;
  exitReason: string;
} {
  if (!canMarkBackedOut(input.stage, input.status)) {
    throw new Error("backed_out is only allowed from offer_accepted while active");
  }
  const reason = input.exitReason.trim();
  if (!reason) throw new Error("exit_reason is required when marking backed out");
  return {
    status: "backed_out",
    exitedAtStage: input.stage,
    exitReason: reason,
  };
}

export function markHired(input: {
  stage: PipelineStageId;
  status: CandidatePipelineStatus;
}): { status: "hired" } {
  if (!canMarkHired(input.stage, input.status)) {
    throw new Error("hired is only allowed from offer_accepted while active");
  }
  return { status: "hired" };
}

export function markOfferDeclined(input: {
  stage: PipelineStageId;
  exitReason: string;
}): {
  status: "offer_declined";
  exitedAtStage: PipelineStageId;
  exitReason: string;
} {
  const reason = input.exitReason.trim();
  if (!reason) throw new Error("exit_reason is required when declining an offer");
  return {
    status: "offer_declined",
    exitedAtStage: input.stage,
    exitReason: reason,
  };
}

export function computeBackoutRate(hired: number, backedOut: number): number {
  const denom = hired + backedOut;
  if (denom === 0) return 0;
  return Math.round((backedOut / denom) * 1000) / 10;
}

export function daysInStage(updatedAt: string, now = Date.now()): number {
  const start = new Date(updatedAt).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 86400000));
}
