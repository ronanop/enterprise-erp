"use client";

import { useMemo, useState } from "react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import type {
  AtsCandidate,
  AtsInterview,
  InterviewMode,
  InterviewRecommendation,
  InterviewType,
  JobOpening,
  PipelineApplication,
} from "@/types/recruitment-ats";

type Props = {
  open: boolean;
  onClose: () => void;
  candidates: AtsCandidate[];
  jobs: JobOpening[];
  applications: PipelineApplication[];
  onSubmit: (input: Omit<AtsInterview, "id" | "interviewCode" | "createdAt" | "status">) => void;
};

export function InterviewDrawer({
  open,
  onClose,
  candidates,
  jobs,
  applications,
  onSubmit,
}: Props) {
  const [candidateId, setCandidateId] = useState("");
  const [jobId, setJobId] = useState("");
  const [interviewType, setInterviewType] = useState<InterviewType>("hr");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [mode, setMode] = useState<InterviewMode>("online");
  const [interviewer, setInterviewer] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState("3");
  const [recommendation, setRecommendation] = useState<InterviewRecommendation | "">("");

  const applicationId = useMemo(() => {
    const app = applications.find(
      (a) => a.candidateId === candidateId && (!jobId || a.jobId === jobId),
    );
    return app?.id ?? "";
  }, [applications, candidateId, jobId]);

  function save() {
    if (!candidateId || !date) return;
    onSubmit({
      candidateId,
      jobId: jobId || applications.find((a) => a.candidateId === candidateId)?.jobId || "",
      applicationId,
      interviewType,
      date,
      time,
      mode,
      interviewer,
      meetingLink,
      location,
      notes,
      feedback,
      rating: Number(rating) || 0,
      recommendation,
    });
    onClose();
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title="Schedule Interview"
      description="Interview reminders are logged in audit when scheduled."
      footer={
        <>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={!candidateId || !date}
            onClick={save}
          >
            Schedule Interview
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <SetupField label="Candidate" required>
          <SetupSelect value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
            <option value="">Select candidate…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.candidateCode} · {c.fullName}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Position">
          <SetupSelect value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">Any / from application</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.jobCode} · {j.title}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Interview type">
            <SetupSelect
              value={interviewType}
              onChange={(e) => setInterviewType(e.target.value as InterviewType)}
            >
              <option value="hr">HR</option>
              <option value="technical">Technical</option>
              <option value="manager">Manager</option>
              <option value="final">Final</option>
            </SetupSelect>
          </SetupField>
          <SetupField label="Mode">
            <SetupSelect value={mode} onChange={(e) => setMode(e.target.value as InterviewMode)}>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </SetupSelect>
          </SetupField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Date" required>
            <SetupInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </SetupField>
          <SetupField label="Time">
            <SetupInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </SetupField>
        </div>
        <SetupField label="Interviewer">
          <SetupInput value={interviewer} onChange={(e) => setInterviewer(e.target.value)} />
        </SetupField>
        {mode === "online" ? (
          <SetupField label="Meeting link">
            <SetupInput value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} />
          </SetupField>
        ) : (
          <SetupField label="Location">
            <SetupInput value={location} onChange={(e) => setLocation(e.target.value)} />
          </SetupField>
        )}
        <SetupField label="Notes">
          <SetupTextarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </SetupField>
        <SetupField label="Feedback (optional)">
          <SetupTextarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} />
        </SetupField>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Rating (1–5)">
            <SetupInput
              type="number"
              min={1}
              max={5}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            />
          </SetupField>
          <SetupField label="Recommendation">
            <SetupSelect
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value as InterviewRecommendation | "")}
            >
              <option value="">Pending</option>
              <option value="selected">Selected</option>
              <option value="hold">Hold</option>
              <option value="rejected">Rejected</option>
            </SetupSelect>
          </SetupField>
        </div>
      </div>
    </SetupDrawer>
  );
}
