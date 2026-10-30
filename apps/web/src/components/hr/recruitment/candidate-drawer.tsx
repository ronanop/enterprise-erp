"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import {
  formatInrGrouping,
  INDIAN_STATES,
  isValidEmail,
  isValidIndianMobile,
  isValidPincode,
  loadAtsLookups,
  parseInrInput,
  recruiterSourceHint,
  type AtsLookupSource,
  type NamedOption,
} from "@/services/recruitment-ats-lookups";
import type {
  AtsCandidate,
  CandidateSource,
  CreateCandidateInput,
  JobOpening,
  PipelineApplication,
} from "@/types/recruitment-ats";
import { SOURCE_LABELS } from "@/types/recruitment-ats";

const SKILL_TONES = [
  "bg-sky-50 text-sky-800",
  "bg-emerald-50 text-emerald-800",
  "bg-amber-50 text-amber-800",
  "bg-slate-100 text-slate-700",
];

type Props = {
  open: boolean;
  onClose: () => void;
  jobs: JobOpening[];
  applications?: PipelineApplication[];
  /** When set, drawer edits this candidate instead of creating */
  initial?: AtsCandidate | null;
  /** Prefill job opening when adding from a job detail page */
  initialJobId?: string | null;
  onSubmit: (input: CreateCandidateInput, jobId?: string) => void | Promise<void>;
};

function looksLikeResumeLabel(value: string): boolean {
  const v = value.trim();
  return /^resume\s*:/i.test(v) || /\.(pdf|docx?|txt)$/i.test(v);
}

export function CandidateDrawer({
  open,
  onClose,
  jobs,
  applications = [],
  initial,
  initialJobId,
  onSubmit,
}: Props) {
  const editing = Boolean(initial);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [currentDesignation, setCurrentDesignation] = useState("");
  const [experienceYears, setExperienceYears] = useState("0");
  const [expectedSalaryDisplay, setExpectedSalaryDisplay] = useState("");
  const [noticePeriodDays, setNoticePeriodDays] = useState("30");
  const [address, setAddress] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [resumeName, setResumeName] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState("");
  const [source, setSource] = useState<CandidateSource>("linkedin");
  const [recruiter, setRecruiter] = useState("");
  const [jobId, setJobId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [recruiters, setRecruiters] = useState<NamedOption[]>([]);
  const [recruiterSource, setRecruiterSource] = useState<AtsLookupSource>("demo");

  useEffect(() => {
    if (!open) return;
    void loadAtsLookups().then((lookups) => {
      setRecruiters(lookups.recruiters);
      setRecruiterSource(lookups.recruiterSource);
    });
  }, [open]);

  const linkedJobId = useMemo(() => {
    if (!initial) return "";
    if (initialJobId) return initialJobId;
    const apps = applications
      .filter((a) => a.candidateId === initial.id && a.status === "active")
      .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
    return apps[0]?.jobId || "";
  }, [initial, initialJobId, applications]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setFullName(initial.fullName);
      setEmail(initial.email);
      setPhone(initial.phone);
      setAlternatePhone(initial.alternatePhone);
      setGender(initial.gender);
      setDob(initial.dob);
      setCurrentCompany(initial.currentCompany);
      const designation = initial.currentDesignation || "";
      setCurrentDesignation(looksLikeResumeLabel(designation) ? "" : designation);
      setExperienceYears(String(initial.experienceYears ?? 0));
      setExpectedSalaryDisplay(
        initial.expectedSalary ? formatInrGrouping(initial.expectedSalary) : "",
      );
      setNoticePeriodDays(String(initial.noticePeriodDays ?? 30));
      setAddress(initial.address || "");
      setState(initial.state || "");
      setPincode(initial.pincode || "");
      const resumeFromTitle = looksLikeResumeLabel(initial.currentDesignation || "")
        ? initial.currentDesignation.replace(/^resume\s*:\s*/i, "").trim()
        : "";
      setResumeName(initial.resumeName || resumeFromTitle || "");
      setResumeUrl(initial.resumeUrl || "");
      setPortfolioUrl(initial.portfolioUrl || "");
      setLinkedinUrl(initial.linkedinUrl || "");
      setSkills(
        (initial.skills ?? [])
          .map((s) => s.trim())
          .filter(Boolean),
      );
      setSkillDraft("");
      setSource(initial.source);
      setRecruiter(initial.recruiter || "");
      setJobId(linkedJobId || initialJobId || "");
      setError("");
      setSaving(false);
      return;
    }
    setFullName("");
    setEmail("");
    setPhone("");
    setAlternatePhone("");
    setGender("");
    setDob("");
    setCurrentCompany("");
    setCurrentDesignation("");
    setExperienceYears("0");
    setExpectedSalaryDisplay("");
    setNoticePeriodDays("30");
    setAddress("");
    setState("");
    setPincode("");
    setResumeName("");
    setResumeUrl("");
    setPortfolioUrl("");
    setLinkedinUrl("");
    setSkills([]);
    setSkillDraft("");
    setSource("recruiter");
    setRecruiter("");
    setJobId(initialJobId || "");
    setError("");
    setSaving(false);
  }, [open, initial, initialJobId, linkedJobId]);

  function handleResumeFile(file: File) {
    setResumeName(file.name);
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setResumeUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function addSkill(raw?: string) {
    const parts = (raw ?? skillDraft)
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setSkills((prev) => {
      const next = [...prev];
      for (const p of parts) {
        if (!next.some((s) => s.toLowerCase() === p.toLowerCase())) next.push(p);
      }
      return next;
    });
    setSkillDraft("");
  }

  async function save() {
    setError("");
    if (!fullName.trim()) {
      setError("Full name is required");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email address");
      return;
    }
    if (!isValidIndianMobile(phone)) {
      setError("Phone must be a 10-digit Indian mobile number");
      return;
    }
    if (alternatePhone && !isValidIndianMobile(alternatePhone)) {
      setError("Alternate phone must be a 10-digit Indian mobile number");
      return;
    }
    if (pincode && !isValidPincode(pincode)) {
      setError("Pincode must be 6 digits");
      return;
    }

    const location = [address, state, pincode].filter(Boolean).join(", ");
    setSaving(true);
    try {
      await Promise.resolve(
        onSubmit(
          {
            fullName: fullName.trim(),
            email: email.trim(),
            phone: phone.replace(/\s+/g, ""),
            alternatePhone: alternatePhone.replace(/\s+/g, ""),
            gender,
            dob,
            currentCompany,
            currentDesignation,
            experienceYears: Number(experienceYears) || 0,
            expectedSalary: parseInrInput(expectedSalaryDisplay),
            noticePeriodDays: Number(noticePeriodDays) || 0,
            location,
            address,
            state,
            pincode,
            resumeName,
            resumeUrl,
            portfolioUrl,
            linkedinUrl,
            skills,
            source,
            recruiter: recruiter || "HR Recruiter",
          },
          jobId || undefined,
        ),
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save candidate");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit =
    Boolean(fullName.trim()) && isValidEmail(email) && isValidIndianMobile(phone);

  const openJobs = jobs.filter((j) => j.status === "open");
  const jobOptions = useMemo(() => {
    const map = new Map(openJobs.map((j) => [j.id, j]));
    if (jobId && !map.has(jobId)) {
      const linked = jobs.find((j) => j.id === jobId);
      if (linked) map.set(linked.id, linked);
    }
    return Array.from(map.values());
  }, [openJobs, jobs, jobId]);
  const selectedJob = jobOptions.find((j) => j.id === jobId) ?? null;

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title={editing ? "Edit Candidate" : "Add Candidate"}
      description={
        editing
          ? `${initial?.candidateCode ?? ""} — update details below.`
          : "Candidate ID is auto-generated (CAN-000001). Duplicate emails are blocked."
      }
      footer={
        <>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer bg-primary text-primary-foreground hover:opacity-90"
            disabled={!canSubmit || saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Add Candidate"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <SetupField label="Full name" required>
          <SetupInput value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </SetupField>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Email" required>
            <SetupInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </SetupField>
          <SetupField label="Phone" required hint="10-digit mobile">
            <SetupInput
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="9876543210"
            />
          </SetupField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Alternate phone">
            <SetupInput
              inputMode="numeric"
              maxLength={10}
              value={alternatePhone}
              onChange={(e) => setAlternatePhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </SetupField>
          <SetupField label="Gender">
            <SetupSelect value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Select</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </SetupSelect>
          </SetupField>
        </div>
        <SetupField label="DOB">
          <SetupInput type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </SetupField>
        <SetupField label="Address">
          <SetupInput
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="House / street / locality"
          />
        </SetupField>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="State">
            <SetupSelect value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">Select state…</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
          <SetupField label="Pincode" hint="6 digits">
            <SetupInput
              inputMode="numeric"
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="110001"
            />
          </SetupField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Current company">
            <SetupInput value={currentCompany} onChange={(e) => setCurrentCompany(e.target.value)} />
          </SetupField>
          <SetupField label="Current designation">
            <SetupInput
              value={currentDesignation}
              onChange={(e) => setCurrentDesignation(e.target.value)}
            />
          </SetupField>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SetupField label="Experience (yrs)">
            <SetupInput
              type="number"
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
            />
          </SetupField>
          <SetupField label="Expected salary (₹)">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                ₹
              </span>
              <SetupInput
                className="pl-6"
                inputMode="numeric"
                value={expectedSalaryDisplay}
                onChange={(e) => {
                  const n = parseInrInput(e.target.value);
                  setExpectedSalaryDisplay(
                    n ? formatInrGrouping(n) : e.target.value.replace(/[^\d]/g, ""),
                  );
                }}
                placeholder="8,00,000"
              />
            </div>
          </SetupField>
          <SetupField label="Notice period (days)">
            <SetupInput
              type="number"
              value={noticePeriodDays}
              onChange={(e) => setNoticePeriodDays(e.target.value)}
            />
          </SetupField>
        </div>
        <SetupField
          label="Skills"
          hint="Type a skill and press Enter, or paste comma-separated"
        >
          <div className="space-y-2">
            {skills.length ? (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill, i) => (
                  <span
                    key={skill}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                      SKILL_TONES[i % SKILL_TONES.length],
                    )}
                  >
                    {skill}
                    <button
                      type="button"
                      aria-label={`Remove ${skill}`}
                      className="inline-flex size-4 cursor-pointer items-center justify-center rounded-full transition-opacity duration-150 hover:opacity-70"
                      onClick={() => setSkills((prev) => prev.filter((s) => s !== skill))}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              <SetupInput
                value={skillDraft}
                onChange={(e) => setSkillDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="e.g. React, Python, SQL"
              />
              <Button
                type="button"
                variant="outline"
                className="h-9 shrink-0 cursor-pointer px-3"
                onClick={() => addSkill()}
                disabled={!skillDraft.trim()}
              >
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
          </div>
        </SetupField>
        <SetupField label="Resume upload" hint="Optional — attach file; enter profile details manually">
          <SetupInput
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleResumeFile(f);
            }}
          />
          {resumeName ? (
            <p className="mt-1 text-[10px] text-muted-foreground">Attached: {resumeName}</p>
          ) : null}
        </SetupField>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Portfolio URL">
            <SetupInput value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} />
          </SetupField>
          <SetupField label="LinkedIn">
            <SetupInput value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} />
          </SetupField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Source">
            <SetupSelect
              value={source}
              onChange={(e) => setSource(e.target.value as CandidateSource)}
            >
              {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
          <SetupField label="Recruiter" hint={recruiterSourceHint(recruiterSource)}>
            <SearchableSelect
              value={recruiter}
              onChange={setRecruiter}
              placeholder="Select recruiter…"
              searchPlaceholder="Type a name…"
              options={recruiters.map((r) => ({ value: r.name, label: r.name }))}
            />
          </SetupField>
        </div>
        <SetupField
          label="Apply to job"
          hint={
            selectedJob
              ? editing
                ? `Applied for ${selectedJob.title} (${selectedJob.jobCode})`
                : `Will apply to ${selectedJob.title}`
              : jobOptions.length
                ? editing
                  ? "Select the role this candidate should be linked to"
                  : "Optional — apply candidate to an opening"
                : "No open job openings available. Create/publish a job first."
          }
        >
          <SetupSelect
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            disabled={!jobOptions.length}
          >
            <option value="">
              {editing ? "None — no job link" : "None — add to talent pool only"}
            </option>
            {jobOptions.map((j) => (
              <option key={j.id} value={j.id}>
                {j.jobCode} · {j.title}
                {j.department ? ` · ${j.department}` : ""}
                {j.status !== "open" ? ` (${j.status})` : ""}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
