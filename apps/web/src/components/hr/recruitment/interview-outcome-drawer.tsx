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
    if (!recommendation || !interview) return;
    onSave({
      interviewId: interview.id,
      recommendation,
      feedback: feedback.trim(),
    });
    onClose();
  }

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
            className="cursor-pointer bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
            disabled={!recommendation}
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
            <p className="mt-2 text-muted-foreground">
              Participants: {interview.participantNames.join(", ")}
            </p>
          ) : interview.interviewer ? (
            <p className="mt-2 text-muted-foreground">Interviewer: {interview.interviewer}</p>
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

        <SetupField label="Feedback">
          <SetupTextarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            placeholder="Strengths, gaps, overall notes…"
          />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
