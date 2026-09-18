"use client";

import { useEffect, useMemo, useState } from "react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { loadAtsLookups, type NamedOption } from "@/services/recruitment-ats-lookups";
import type {
  AtsCandidate,
  AtsInterview,
  InterviewMode,
  InterviewRound,
  JobOpening,
  PipelineApplication,
} from "@/types/recruitment-ats";
import { INTERVIEW_ROUND_LABELS } from "@/types/recruitment-ats";

type SchedulePayload = Omit<
  AtsInterview,
  "id" | "interviewCode" | "createdAt" | "status" | "notes" | "feedback" | "rating" | "recommendation"
> & {
  notes?: string;
  feedback?: string;
  rating?: number;
  recommendation?: AtsInterview["recommendation"];
};

type Props = {
  open: boolean;
  onClose: () => void;
  candidates: AtsCandidate[];
  jobs: JobOpening[];
  applications: PipelineApplication[];
  onSubmit: (input: SchedulePayload) => void;
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
  const [round, setRound] = useState<InterviewRound>("round_1");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [mode, setMode] = useState<InterviewMode>("online");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [meetingLink, setMeetingLink] = useState("");
  const [location, setLocation] = useState("");
  const [resumeLink, setResumeLink] = useState("");
  const [sectionContent, setSectionContent] = useState("");
  const [employees, setEmployees] = useState<NamedOption[]>([]);

  useEffect(() => {
    if (!open) return;
    void loadAtsLookups().then((lookups) => setEmployees(lookups.employees));
  }, [open]);

  const selectedCandidate = candidates.find((c) => c.id === candidateId);
  const selectedJob = jobs.find((j) => j.id === jobId);

  useEffect(() => {
    if (!candidateId) return;
    const cand = candidates.find((c) => c.id === candidateId);
    if (cand?.resumeUrl) setResumeLink(cand.resumeUrl);
    else if (cand?.resumeName) setResumeLink(cand.resumeName);
    const app = applications.find((a) => a.candidateId === candidateId);
    if (app && !jobId) setJobId(app.jobId);
  }, [candidateId, candidates, applications, jobId]);

  const applicationId = useMemo(() => {
    const app = applications.find(
      (a) => a.candidateId === candidateId && (!jobId || a.jobId === jobId),
    );
    return app?.id ?? "";
  }, [applications, candidateId, jobId]);

  function toggleParticipant(id: string) {
    setParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function save() {
    if (!candidateId || !date || participantIds.length === 0) return;
    const names = employees
      .filter((e) => participantIds.includes(e.id))
      .map((e) => e.name);
    onSubmit({
      candidateId,
      jobId: jobId || applications.find((a) => a.candidateId === candidateId)?.jobId || "",
      applicationId,
      interviewType: round,
      round,
      date,
      time,
      mode,
      interviewer: names.join(", "),
      participantIds,
      participantNames: names,
      meetingLink,
      location,
      resumeLink,
      sectionContent,
      notes: "",
      feedback: "",
      rating: 0,
      recommendation: "",
    });
    onClose();
    setCandidateId("");
    setJobId("");
    setRound("round_1");
    setDate("");
    setParticipantIds([]);
    setResumeLink("");
    setSectionContent("");
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title="Schedule Interview"
      description="Attach resume & JD, pick round and participants. Outcome is recorded after the interview."
      footer={
        <>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
            disabled={!candidateId || !date || participantIds.length === 0}
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
        <SetupField label="Job role" required>
          <SetupSelect value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">Select job role…</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.jobCode} · {j.title}
              </option>
            ))}
          </SetupSelect>
        </SetupField>

        {(selectedCandidate?.resumeName || selectedJob?.jdFileName || selectedJob?.description) && (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs">
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Attachments
            </p>
            {selectedCandidate?.resumeName ? (
              <p className="mt-1">
                Resume:{" "}
                {selectedCandidate.resumeUrl ? (
                  <a
                    href={selectedCandidate.resumeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="cursor-pointer text-[#7C3AED] underline"
                  >
                    {selectedCandidate.resumeName}
                  </a>
                ) : (
                  selectedCandidate.resumeName
                )}
              </p>
            ) : null}
            {selectedJob?.jdFileName ? (
              <p className="mt-0.5">JD file: {selectedJob.jdFileName}</p>
            ) : selectedJob?.description ? (
              <p className="mt-0.5 text-muted-foreground">JD: available on job opening</p>
            ) : null}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Round name" required>
            <SetupSelect
              value={round}
              onChange={(e) => setRound(e.target.value as InterviewRound)}
            >
              {(Object.keys(INTERVIEW_ROUND_LABELS) as InterviewRound[]).map((k) => (
                <option key={k} value={k}>
                  {INTERVIEW_ROUND_LABELS[k]}
                </option>
              ))}
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

        <SetupField label="Participants" required hint="Company employees taking the interview">
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/70 p-2">
            {employees.map((e) => (
              <label
                key={e.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  className="cursor-pointer"
                  checked={participantIds.includes(e.id)}
                  onChange={() => toggleParticipant(e.id)}
                />
                {e.name}
              </label>
            ))}
          </div>
        </SetupField>

        <SetupField label="Resume link">
          <SetupInput
            value={resumeLink}
            onChange={(e) => setResumeLink(e.target.value)}
            placeholder="https://… or uploaded resume"
          />
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

        <SetupField label="Section content" hint="Agenda / topics for this round">
          <SetupTextarea
            value={sectionContent}
            onChange={(e) => setSectionContent(e.target.value)}
            rows={3}
            placeholder="Topics to cover, evaluation focus…"
          />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
