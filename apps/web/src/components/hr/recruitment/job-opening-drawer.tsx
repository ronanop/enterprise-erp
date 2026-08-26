"use client";

import { useState } from "react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import type { CreateJobInput, JobOpening, JobPriority, EmploymentType } from "@/types/recruitment-ats";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateJobInput) => void;
  initial?: JobOpening | null;
};

export function JobOpeningDrawer({ open, onClose, onSubmit, initial }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [department, setDepartment] = useState(initial?.department ?? "");
  const [designation, setDesignation] = useState(initial?.designation ?? "");
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    initial?.employmentType ?? "full_time",
  );
  const [branch, setBranch] = useState(initial?.branch ?? "Head Office");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [hiringManager, setHiringManager] = useState(initial?.hiringManager ?? "");
  const [recruiter, setRecruiter] = useState(initial?.recruiter ?? "");
  const [positions, setPositions] = useState(String(initial?.positions ?? 1));
  const [salaryMin, setSalaryMin] = useState(String(initial?.salaryMin ?? ""));
  const [salaryMax, setSalaryMax] = useState(String(initial?.salaryMax ?? ""));
  const [experienceMin, setExperienceMin] = useState(String(initial?.experienceMin ?? 0));
  const [experienceMax, setExperienceMax] = useState(String(initial?.experienceMax ?? 5));
  const [skills, setSkills] = useState(initial?.skills.join(", ") ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [priority, setPriority] = useState<JobPriority>(initial?.priority ?? "medium");
  const [status, setStatus] = useState<JobOpening["status"]>(initial?.status ?? "open");

  function save() {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      department: department || "General",
      designation: designation || title.trim(),
      employmentType,
      branch,
      location,
      hiringManager,
      recruiter,
      positions: Number(positions) || 1,
      salaryMin: Number(salaryMin) || 0,
      salaryMax: Number(salaryMax) || 0,
      experienceMin: Number(experienceMin) || 0,
      experienceMax: Number(experienceMax) || 0,
      skills: skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      description,
      deadline,
      priority,
      status,
    });
    onClose();
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title={initial ? "Edit Job Opening" : "Create Job Opening"}
      description="Job ID is auto-generated (JOB-000001)."
      footer={
        <>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="cursor-pointer" disabled={!title.trim()} onClick={save}>
            {initial ? "Save" : "Create Job"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {initial ? (
          <p className="font-mono text-xs text-muted-foreground">{initial.jobCode}</p>
        ) : null}
        <SetupField label="Job title" required>
          <SetupInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </SetupField>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Department">
            <SetupInput value={department} onChange={(e) => setDepartment(e.target.value)} />
          </SetupField>
          <SetupField label="Designation">
            <SetupInput value={designation} onChange={(e) => setDesignation(e.target.value)} />
          </SetupField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Employment type">
            <SetupSelect
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
            >
              <option value="full_time">Full Time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
              <option value="part_time">Part Time</option>
            </SetupSelect>
          </SetupField>
          <SetupField label="Priority">
            <SetupSelect
              value={priority}
              onChange={(e) => setPriority(e.target.value as JobPriority)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </SetupSelect>
          </SetupField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Branch">
            <SetupInput value={branch} onChange={(e) => setBranch(e.target.value)} />
          </SetupField>
          <SetupField label="Location">
            <SetupInput value={location} onChange={(e) => setLocation(e.target.value)} />
          </SetupField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Hiring manager">
            <SetupInput value={hiringManager} onChange={(e) => setHiringManager(e.target.value)} />
          </SetupField>
          <SetupField label="Recruiter">
            <SetupInput value={recruiter} onChange={(e) => setRecruiter(e.target.value)} />
          </SetupField>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SetupField label="No. of positions">
            <SetupInput type="number" value={positions} onChange={(e) => setPositions(e.target.value)} />
          </SetupField>
          <SetupField label="Salary min">
            <SetupInput type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
          </SetupField>
          <SetupField label="Salary max">
            <SetupInput type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
          </SetupField>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SetupField label="Exp min (yrs)">
            <SetupInput
              type="number"
              value={experienceMin}
              onChange={(e) => setExperienceMin(e.target.value)}
            />
          </SetupField>
          <SetupField label="Exp max (yrs)">
            <SetupInput
              type="number"
              value={experienceMax}
              onChange={(e) => setExperienceMax(e.target.value)}
            />
          </SetupField>
          <SetupField label="Deadline">
            <SetupInput type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </SetupField>
        </div>
        <SetupField label="Skills required" hint="Comma separated">
          <SetupInput value={skills} onChange={(e) => setSkills(e.target.value)} />
        </SetupField>
        <SetupField label="Job description">
          <SetupTextarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </SetupField>
        <SetupField label="Status">
          <SetupSelect
            value={status}
            onChange={(e) => setStatus(e.target.value as JobOpening["status"])}
          >
            <option value="open">Open</option>
            <option value="on_hold">On Hold</option>
            <option value="closed">Closed</option>
          </SetupSelect>
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
