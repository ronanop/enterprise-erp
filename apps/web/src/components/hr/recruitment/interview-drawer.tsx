"use client";

import { useEffect, useMemo, useState } from "react";
import { Paperclip, Search, X } from "lucide-react";

import { fileToEmailAttachment } from "@/services/recruitment-ats-service";
import type { EmailAttachmentPayload } from "@/services/email-notification-service";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import {
  isValidEmail,
  loadAtsLookups,
  type NamedOption,
} from "@/services/recruitment-ats-lookups";
import type {
  AtsCandidate,
  AtsInterview,
  InterviewMode,
  InterviewRound,
  JobOpening,
  PipelineApplication,
} from "@/types/recruitment-ats";
import { INTERVIEW_ROUND_LABELS } from "@/types/recruitment-ats";

/** Show the PDF/file name in the field — not an internal path or marker. */
function resumeLinkFromCandidate(cand: AtsCandidate | undefined): string {
  if (!cand) return "";
  const name = (cand.resumeName || "").trim();
  if (name) {
    const base = name.split(/[/\\]/).pop()?.trim();
    return base || name;
  }
  const url = (cand.resumeUrl || "").trim();
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return "";
}

type ExternalInvitee = { name: string; email: string };

type SchedulePayload = Omit<
  AtsInterview,
  "id" | "interviewCode" | "createdAt" | "status" | "notes" | "feedback" | "rating" | "recommendation"
> & {
  notes?: string;
  feedback?: string;
  rating?: number;
  recommendation?: AtsInterview["recommendation"];
  participantEmails?: string[];
  participantInvitees?: { name: string; email: string }[];
  extraAttachment?: EmailAttachmentPayload | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  candidates: AtsCandidate[];
  jobs: JobOpening[];
  applications: PipelineApplication[];
  initial?: {
    candidateId?: string;
    jobId?: string;
    applicationId?: string;
    round?: InterviewRound;
  } | null;
  onSubmit: (input: SchedulePayload) => void | Promise<void>;
};

function filterByQuery(options: NamedOption[], query: string): NamedOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter(
    (o) =>
      o.name.toLowerCase().includes(q) ||
      (o.email || "").toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q),
  );
}

function filterByDepartment(options: NamedOption[], departmentId: string): NamedOption[] {
  if (!departmentId) return options;
  return options.filter((o) => o.departmentId === departmentId);
}

/** Managers first, then other employees; de-dupe by id. */
function mergePeoplePool(managers: NamedOption[], employees: NamedOption[]): NamedOption[] {
  const byId = new Map<string, NamedOption>();
  for (const m of managers) {
    byId.set(m.id, { ...m, isManager: true });
  }
  for (const e of employees) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const am = a.isManager ? 0 : 1;
    const bm = b.isManager ? 0 : 1;
    if (am !== bm) return am - bm;
    return a.name.localeCompare(b.name);
  });
}

export function InterviewDrawer({
  open,
  onClose,
  candidates,
  jobs,
  applications,
  initial,
  onSubmit,
}: Props) {
  const [candidateId, setCandidateId] = useState("");
  const [jobId, setJobId] = useState("");
  const [round, setRound] = useState<InterviewRound>("round_1");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [mode, setMode] = useState<InterviewMode>("online");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [externalInvitees, setExternalInvitees] = useState<ExternalInvitee[]>([]);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailError, setEmailError] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [location, setLocation] = useState("");
  const [resumeLink, setResumeLink] = useState("");
  const [sectionContent, setSectionContent] = useState("");
  const [extraFile, setExtraFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<NamedOption[]>([]);
  const [hrEmployees, setHrEmployees] = useState<NamedOption[]>([]);
  const [managers, setManagers] = useState<NamedOption[]>([]);
  const [departments, setDepartments] = useState<NamedOption[]>([]);
  const [departmentId, setDepartmentId] = useState("");

  useEffect(() => {
    if (!open) return;
    void loadAtsLookups().then((lookups) => {
      setEmployees(lookups.employees);
      setHrEmployees(lookups.hrEmployees?.length ? lookups.hrEmployees : lookups.employees);
      // Prefer People roles → Manager; fall back to hiring managers / all employees.
      const lineManagers = lookups.managers?.length
        ? lookups.managers
        : lookups.hiringManagers?.length
          ? lookups.hiringManagers
          : lookups.employees;
      setManagers(lineManagers);
      setDepartments(lookups.departments ?? []);
    });
    const nextCandidateId = initial?.candidateId ?? "";
    const nextJobId = initial?.jobId ?? "";
    setCandidateId(nextCandidateId);
    setJobId(nextJobId);
    setRound(initial?.round ?? "round_1");
    setDate("");
    setTime("10:00");
    setMode("online");
    setParticipantIds([]);
    setExternalInvitees([]);
    setEmailDraft("");
    setEmailError("");
    setParticipantSearch("");
    setDepartmentId("");
    setMeetingLink("");
    setLocation("");
    setSectionContent("");
    setResumeLink("");
    setExtraFile(null);
    setSaving(false);
  }, [open, initial]);

  const selectedCandidate =
    candidates.find((c) => c.id === candidateId) ||
    candidates.find((c) => c.apiId === candidateId);
  const selectedJob = jobs.find((j) => j.id === jobId);
  const isInternalJob = selectedJob?.postingAudience === "internal";

  // When the user picks/changes a candidate, pull resume + default job from their saved profile.
  useEffect(() => {
    if (!open) return;
    if (!candidateId) {
      setResumeLink("");
      return;
    }
    const cand =
      candidates.find((c) => c.id === candidateId) ||
      candidates.find((c) => c.apiId === candidateId);
    setResumeLink(resumeLinkFromCandidate(cand));
    if (!jobId) {
      const app = applications.find(
        (a) =>
          (a.candidateId === candidateId || a.candidateId === cand?.id) &&
          a.status === "active",
      );
      if (app) setJobId(app.jobId);
    }
  }, [open, candidateId, candidates, applications, jobId]);

  // Reset participant picks when switching job audience or round.
  useEffect(() => {
    setParticipantIds([]);
    setExternalInvitees([]);
    setEmailDraft("");
    setEmailError("");
    setParticipantSearch("");
    setDepartmentId("");
  }, [jobId, isInternalJob, round]);

  const employeePool = round === "hr" ? hrEmployees : employees;
  const managerPool = round === "hr" ? hrEmployees : managers;
  /** Round 1 / 2: pick a department to include that team’s managers + employees. */
  const allowDepartmentPick = round === "round_1" || round === "round_2";

  const externalParticipantPool = useMemo(() => {
    if (round === "hr") return managerPool;
    if (!allowDepartmentPick || !departmentId) return managerPool;
    const inDept = filterByDepartment(employees, departmentId);
    const mgrInDept = filterByDepartment(managers, departmentId);
    return mergePeoplePool(mgrInDept, inDept);
  }, [round, allowDepartmentPick, departmentId, managerPool, managers, employees]);

  const internalParticipantPool = useMemo(() => {
    if (!allowDepartmentPick || !departmentId) return employeePool;
    return filterByDepartment(employeePool, departmentId);
  }, [allowDepartmentPick, departmentId, employeePool]);

  const filteredEmployees = useMemo(
    () => filterByQuery(internalParticipantPool, participantSearch),
    [internalParticipantPool, participantSearch],
  );
  const filteredManagers = useMemo(
    () => filterByQuery(externalParticipantPool, participantSearch),
    [externalParticipantPool, participantSearch],
  );

  const applicationId = useMemo(() => {
    if (initial?.applicationId) return initial.applicationId;
    const app = applications.find(
      (a) => a.candidateId === candidateId && (!jobId || a.jobId === jobId),
    );
    return app?.id ?? "";
  }, [applications, candidateId, jobId, initial?.applicationId]);

  function toggleParticipant(id: string) {
    setParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function addExternalEmail() {
    const email = emailDraft.trim().toLowerCase();
    if (!email) {
      setEmailError("Enter an email address");
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email");
      return;
    }
    if (externalInvitees.some((e) => e.email === email)) {
      setEmailError("Already added");
      return;
    }
    const local = email.split("@")[0] || email;
    setExternalInvitees((prev) => [...prev, { name: local, email }]);
    setEmailDraft("");
    setEmailError("");
  }

  function removeExternalEmail(email: string) {
    setExternalInvitees((prev) => prev.filter((e) => e.email !== email));
  }

  const hasParticipants = isInternalJob
    ? participantIds.length > 0
    : participantIds.length > 0 || externalInvitees.length > 0;

  async function save() {
    if (!candidateId || !date || !hasParticipants || saving) return;
    setSaving(true);
    try {
      const pool = isInternalJob
        ? mergePeoplePool([], employeePool)
        : mergePeoplePool(managerPool, allowDepartmentPick ? employees : []);
      const selected = pool.filter((e) => participantIds.includes(e.id));
      const staffInvitees = selected
        .map((e) => ({ name: e.name, email: (e.email || "").trim() }))
        .filter((e) => Boolean(e.email));
      const invitees = isInternalJob
        ? staffInvitees
        : [...staffInvitees, ...externalInvitees];
      const names = [
        ...selected.map((e) => e.name),
        ...(isInternalJob ? [] : externalInvitees.map((e) => e.email)),
      ];
      let extraAttachment: EmailAttachmentPayload | null = null;
      if (extraFile) {
        extraAttachment = await fileToEmailAttachment(extraFile);
      }
      await onSubmit({
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
        participantEmails: invitees.map((e) => e.email),
        participantInvitees: invitees,
        meetingLink,
        location,
        resumeLink,
        sectionContent,
        extraAttachment,
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
      setExternalInvitees([]);
      setResumeLink("");
      setSectionContent("");
      setExtraFile(null);
    } finally {
      setSaving(false);
    }
  }

  const roundTitle = INTERVIEW_ROUND_LABELS[round] || "Interview";
  const lockedRound = Boolean(initial?.round);

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title={`Schedule ${roundTitle}`}
      description={
        lockedRound
          ? `Enter date, time, meeting link and interviewers for ${roundTitle}.`
          : "Attach resume & JD, pick round and interviewers. Outcome is recorded after the interview."
      }
      footer={
        <>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!candidateId || !date || !hasParticipants || saving}
            onClick={() => void save()}
          >
            {saving ? "Scheduling…" : `Schedule ${roundTitle}`}
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
                {j.postingAudience === "internal" ? " · Internal" : ""}
              </option>
            ))}
          </SetupSelect>
        </SetupField>

        {selectedJob?.jdFileName || selectedJob?.description ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs">
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Job description
            </p>
            {selectedJob.jdFileName ? (
              <p className="mt-1">{selectedJob.jdFileName}</p>
            ) : (
              <p className="mt-1 text-muted-foreground">Available on the selected job opening</p>
            )}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Round name" required>
            <SetupSelect
              value={round}
              disabled={lockedRound}
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

        {!jobId ? (
          <SetupField label="Interviewers" required hint="Select a job role first">
            <p className="rounded-lg border border-border/70 px-3 py-2 text-[11px] text-muted-foreground">
              Interviewer options depend on whether the job is Internal or External.
            </p>
          </SetupField>
        ) : isInternalJob ? (
          <SetupField
            label="Interviewers"
            required
            hint={
              round === "hr"
                ? "Company HR employees for this internal role"
                : allowDepartmentPick
                  ? "Pick a department to include that team, or leave All for everyone"
                  : "Select interviewers for this round (shown as Interviewer 1, 2, …)"
            }
          >
            {allowDepartmentPick && departments.length ? (
              <SetupSelect
                className="mb-2"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </SetupSelect>
            ) : null}
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <SetupInput
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                placeholder="Search employees…"
                className="pl-8"
              />
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/70 p-2">
              {filteredEmployees.length ? (
                filteredEmployees.map((e) => {
                  const serial = participantIds.indexOf(e.id);
                  return (
                  <label
                    key={e.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors duration-150 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      className="cursor-pointer"
                      checked={serial >= 0}
                      onChange={() => toggleParticipant(e.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{e.name}</span>
                      {e.email ? (
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {e.email}
                        </span>
                      ) : null}
                    </span>
                    {serial >= 0 ? (
                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Interviewer {serial + 1}
                      </span>
                    ) : e.isManager ? (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Manager
                      </span>
                    ) : null}
                  </label>
                  );
                })
              ) : (
                <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                  {participantSearch.trim() || departmentId
                    ? "No employees match this filter."
                    : round === "hr"
                      ? "No HR employees found. Flag employees as HR in Org Setup → People roles."
                      : "No employees loaded."}
                </p>
              )}
            </div>
          </SetupField>
        ) : (
          <>
            <SetupField
              label="Add interviewer by email"
              required={participantIds.length === 0}
              hint="External interviewers receive the meeting invite by email"
            >
              <div className="flex gap-2">
                <SetupInput
                  type="email"
                  value={emailDraft}
                  onChange={(e) => {
                    setEmailDraft(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addExternalEmail();
                    }
                  }}
                  placeholder="name@company.com"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 cursor-pointer"
                  onClick={addExternalEmail}
                >
                  Add
                </Button>
              </div>
              {emailError ? (
                <p className="mt-1 text-[10px] text-destructive">{emailError}</p>
              ) : null}
              {externalInvitees.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {externalInvitees.map((inv, idx) => (
                    <span
                      key={inv.email}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px]"
                    >
                      Interviewer {participantIds.length + idx + 1}: {inv.email}
                      <button
                        type="button"
                        className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground"
                        aria-label={`Remove ${inv.email}`}
                        onClick={() => removeExternalEmail(inv.email)}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </SetupField>

            <SetupField
              label="Interviewers"
              required={externalInvitees.length === 0}
              hint={
                round === "hr"
                  ? "Search and select interviewers / HR for the Negotiation Round"
                  : allowDepartmentPick
                    ? "Select a department, then pick interviewers (numbered Interviewer 1, 2, …)"
                    : "Search and select interviewers for the meeting"
              }
            >
              {allowDepartmentPick && departments.length ? (
                <SetupSelect
                  className="mb-2"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                >
                  <option value="">All departments (managers only)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </SetupSelect>
              ) : null}
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <SetupInput
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  placeholder={
                    departmentId ? "Search team members…" : "Search interviewers…"
                  }
                  className="pl-8"
                />
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/70 p-2">
                {filteredManagers.length ? (
                  filteredManagers.map((e) => {
                    const serial = participantIds.indexOf(e.id);
                    return (
                    <label
                      key={e.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors duration-150 hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        className="cursor-pointer"
                        checked={serial >= 0}
                        onChange={() => toggleParticipant(e.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{e.name}</span>
                        {e.email ? (
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {e.email}
                          </span>
                        ) : null}
                      </span>
                      {serial >= 0 ? (
                        <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          Interviewer {serial + 1}
                        </span>
                      ) : e.isManager || !departmentId ? (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Manager
                        </span>
                      ) : (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Employee
                        </span>
                      )}
                    </label>
                    );
                  })
                ) : (
                  <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                    {participantSearch.trim() || departmentId
                      ? "No people match this filter."
                      : "No interviewers loaded. Tag Manager in Org Setup → People roles."}
                  </p>
                )}
              </div>
            </SetupField>
          </>
        )}

        <SetupField
          label="Resume"
          hint={
            selectedCandidate && resumeLink
              ? "Auto-filled from the candidate’s saved resume"
              : selectedCandidate
                ? "No resume on this candidate — paste a file name or link"
                : "Select a candidate to auto-fill the resume file name"
          }
        >
          <SetupInput
            value={resumeLink}
            onChange={(e) => setResumeLink(e.target.value)}
            placeholder="e.g. candidate_resume.pdf"
          />
        </SetupField>

        <SetupField
          label="Additional attachment"
          hint="Optional — one extra file attached to the invite email (PDF, DOC, image, etc.)"
        >
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-dashed border-input px-2.5 text-xs text-muted-foreground transition-colors duration-200 hover:bg-muted/40">
              <Paperclip className="size-3.5" />
              {extraFile ? extraFile.name : "Choose file"}
              <input
                type="file"
                className="hidden"
                onChange={(e) => setExtraFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {extraFile ? (
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setExtraFile(null)}
              >
                <X className="size-3" />
                Clear
              </button>
            ) : null}
          </div>
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

        <SetupField label="Content" hint="Agenda / topics for this round">
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
