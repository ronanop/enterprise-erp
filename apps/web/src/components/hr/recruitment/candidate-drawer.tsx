"use client";

import { useState } from "react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import type {
  CandidateSource,
  CreateCandidateInput,
  JobOpening,
} from "@/types/recruitment-ats";
import { SOURCE_LABELS } from "@/types/recruitment-ats";

type Props = {
  open: boolean;
  onClose: () => void;
  jobs: JobOpening[];
  onSubmit: (input: CreateCandidateInput, jobId?: string) => void;
};

export function CandidateDrawer({ open, onClose, jobs, onSubmit }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [currentDesignation, setCurrentDesignation] = useState("");
  const [experienceYears, setExperienceYears] = useState("0");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [noticePeriodDays, setNoticePeriodDays] = useState("30");
  const [location, setLocation] = useState("");
  const [resumeName, setResumeName] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [source, setSource] = useState<CandidateSource>("linkedin");
  const [recruiter, setRecruiter] = useState("");
  const [jobId, setJobId] = useState("");

  function save() {
    if (!fullName.trim() || !email.trim()) return;
    onSubmit(
      {
        fullName: fullName.trim(),
        email: email.trim(),
        phone,
        alternatePhone,
        gender,
        dob,
        currentCompany,
        currentDesignation,
        experienceYears: Number(experienceYears) || 0,
        expectedSalary: Number(expectedSalary) || 0,
        noticePeriodDays: Number(noticePeriodDays) || 0,
        location,
        resumeName,
        portfolioUrl,
        linkedinUrl,
        source,
        recruiter: recruiter || "HR Recruiter",
      },
      jobId || undefined,
    );
    onClose();
    setFullName("");
    setEmail("");
    setPhone("");
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title="Add Candidate"
      description="Candidate ID is auto-generated (CAN-000001). Duplicate emails are blocked."
      footer={
        <>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={!fullName.trim() || !email.trim()}
            onClick={save}
          >
            Add Candidate
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <SetupField label="Full name" required>
          <SetupInput value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </SetupField>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Email" required>
            <SetupInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </SetupField>
          <SetupField label="Phone">
            <SetupInput value={phone} onChange={(e) => setPhone(e.target.value)} />
          </SetupField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Alternate phone">
            <SetupInput value={alternatePhone} onChange={(e) => setAlternatePhone(e.target.value)} />
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
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="DOB">
            <SetupInput type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </SetupField>
          <SetupField label="Location">
            <SetupInput value={location} onChange={(e) => setLocation(e.target.value)} />
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
          <SetupField label="Expected salary">
            <SetupInput
              type="number"
              value={expectedSalary}
              onChange={(e) => setExpectedSalary(e.target.value)}
            />
          </SetupField>
          <SetupField label="Notice period (days)">
            <SetupInput
              type="number"
              value={noticePeriodDays}
              onChange={(e) => setNoticePeriodDays(e.target.value)}
            />
          </SetupField>
        </div>
        <SetupField label="Resume file name">
          <SetupInput
            value={resumeName}
            onChange={(e) => setResumeName(e.target.value)}
            placeholder="resume.pdf"
          />
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
          <SetupField label="Recruiter">
            <SetupInput value={recruiter} onChange={(e) => setRecruiter(e.target.value)} />
          </SetupField>
        </div>
        <SetupField label="Apply to job (optional)">
          <SetupSelect value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">None — add to talent pool only</option>
            {jobs
              .filter((j) => j.status === "open")
              .map((j) => (
                <option key={j.id} value={j.id}>
                  {j.jobCode} · {j.title}
                </option>
              ))}
          </SetupSelect>
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
