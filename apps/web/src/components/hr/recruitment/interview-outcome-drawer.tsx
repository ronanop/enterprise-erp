"use client";

import { useState } from "react";

import {
  SetupDrawer,
  SetupField,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { HrStatusBadge } from "@/components/hr/hr-primitives";
import type {
  AtsCandidate,
  AtsInterview,
  InterviewRecommendation,
  JobOpening,
} from "@/types/recruitment-ats";
import { INTERVIEW_ROUND_LABELS } from "@/types/recruitment-ats";

type Props = {
  open: boolean;
  onClose: () => void;
  interview: AtsInterview | null;
  candidate: AtsCandidate | null;
  job: JobOpening | null;
  onSave: (input: {
    interviewId: string;
    recommendation: InterviewRecommendation;
    feedback: string;
  }) => void;
};

export function InterviewOutcomeDrawer({
  open,
  onClose,
  interview,
  candidate,
  job,
  onSave,
}: Props) {
  const [recommendation, setRecommendation] = useState<InterviewRecommendation | "">(
    interview?.recommendation || "",
  );
  const [feedback, setFeedback] = useState(interview?.feedback ?? "");

  if (!interview) return null;

  const roundLabel =
    INTERVIEW_ROUND_LABELS[interview.round] ??
    interview.round ??
    interview.interviewType;

  function save() {
    if (!recommendation || !interview || !feedback.trim()) return;
    onSave({
      interviewId: interview.id,
      recommendation,
      feedback: feedback.trim(),
    });
    onClose();
  }

  const nextPhaseHint =
    recommendation === "selected"
      ? interview.round === "round_1"
        ? "Selected moves the candidate to Interview Round 2."
        : interview.round === "round_2"
          ? "Selected moves the candidate to Negotiation Round."
          : interview.round === "hr"
            ? "Selected moves the candidate to Background Check."
            : "Selected advances the candidate to the next phase."
      : recommendation === "rejected"
        ? "Rejected exits the candidate from the pipeline."
        : recommendation === "hold"
          ? "Hold keeps the candidate on the current stage."
          : null;

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Interview outcome"
      description={`${interview.interviewCode} · ${roundLabel}`}
      footer={
        <>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!recommendation || !feedback.trim()}
            onClick={save}
          >
            Save outcome
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs">
          <p className="font-medium">{candidate?.fullName ?? "Candidate"}</p>
          <p className="mt-0.5 text-muted-foreground">
            {job?.title ?? "Role"} · {interview.date} {interview.time} · {interview.mode}
          </p>
          <div className="mt-2">
            <HrStatusBadge status={interview.status} />
          </div>
          {interview.participantNames?.length ? (
            <div className="mt-2 space-y-0.5 text-muted-foreground">
              {interview.participantNames.map((name, i) => (
                <p key={`${name}-${i}`}>
                  Interviewer {i + 1}: {name}
                </p>
              ))}
            </div>
          ) : interview.interviewer ? (
            <p className="mt-2 text-muted-foreground">Interviewer 1: {interview.interviewer}</p>
          ) : null}
          {interview.sectionContent ? (
            <p className="mt-2 whitespace-pre-wrap text-foreground">{interview.sectionContent}</p>
          ) : null}
        </div>

        <SetupField label="Result" required>
          <SetupSelect
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value as InterviewRecommendation | "")}
          >
            <option value="">Select…</option>
            <option value="selected">Selected</option>
            <option value="hold">Hold</option>
            <option value="rejected">Rejected</option>
          </SetupSelect>
        </SetupField>

        <SetupField
          label={
            recommendation === "selected"
              ? "Review / feedback"
              : recommendation === "rejected"
                ? "Rejection reason"
                : "Feedback"
          }
          required
        >
          <SetupTextarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            placeholder={
              recommendation === "selected"
                ? "Required review before advancing to the next phase…"
                : recommendation === "rejected"
                  ? "Required reason for rejection…"
                  : "Strengths, gaps, overall notes…"
            }
          />
        </SetupField>
        {nextPhaseHint ? (
          <p className="text-[11px] text-muted-foreground">{nextPhaseHint}</p>
        ) : null}
      </div>
    </SetupDrawer>
  );
}
