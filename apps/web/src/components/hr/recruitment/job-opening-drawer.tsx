"use client";

import { useEffect, useState } from "react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  formatInrGrouping,
  hiringManagerSourceHint,
  loadAtsLookups,
  parseInrInput,
  recruiterSourceHint,
  type AtsLookupSource,
  type NamedOption,
} from "@/services/recruitment-ats-lookups";
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
  const [salaryMinDisplay, setSalaryMinDisplay] = useState(
    initial?.salaryMin ? formatInrGrouping(initial.salaryMin) : "",
  );
  const [salaryMaxDisplay, setSalaryMaxDisplay] = useState(
    initial?.salaryMax ? formatInrGrouping(initial.salaryMax) : "",
  );
  const [experienceMin, setExperienceMin] = useState(String(initial?.experienceMin ?? 0));
  const [experienceMax, setExperienceMax] = useState(String(initial?.experienceMax ?? 5));
  const [skills, setSkills] = useState(initial?.skills.join(", ") ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [priority, setPriority] = useState<JobPriority>(initial?.priority ?? "medium");
  const [status, setStatus] = useState<JobOpening["status"]>(initial?.status ?? "open");
  const [jdFileName, setJdFileName] = useState(initial?.jdFileName ?? "");

  const [employees, setEmployees] = useState<NamedOption[]>([]);
  const [branches, setBranches] = useState<NamedOption[]>([]);
  const [recruiters, setRecruiters] = useState<NamedOption[]>([]);
  const [managerSource, setManagerSource] = useState<AtsLookupSource>("demo");
  const [recruiterSource, setRecruiterSource] = useState<AtsLookupSource>("demo");

  useEffect(() => {
    if (!open) return;
    void loadAtsLookups().then((lookups) => {
      setEmployees(lookups.hiringManagers);
      setBranches(lookups.branches);
      setRecruiters(lookups.recruiters);
      setManagerSource(lookups.managerSource);
      setRecruiterSource(lookups.recruiterSource);
      if ((!branch || branch === "Head Office") && lookups.branches[0]) {
        setBranch(lookups.branches[0].name);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when drawer opens
  }, [open]);

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
      salaryMin: parseInrInput(salaryMinDisplay),
      salaryMax: parseInrInput(salaryMaxDisplay),
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
      jdFileName: jdFileName || undefined,
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
          <Button type="button" className="cursor-pointer bg-[#7C3AED] text-white hover:bg-[#6D28D9]" disabled={!title.trim()} onClick={save}>
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
            <SetupSelect value={branch} onChange={(e) => setBranch(e.target.value)}>
              {branches.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
              {!branches.some((b) => b.name === branch) && branch ? (
                <option value={branch}>{branch}</option>
              ) : null}
            </SetupSelect>
          </SetupField>
          <SetupField label="Location">
            <SetupInput value={location} onChange={(e) => setLocation(e.target.value)} />
          </SetupField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Hiring manager" hint={hiringManagerSourceHint(managerSource)}>
            <SearchableSelect
              value={hiringManager}
              onChange={setHiringManager}
              placeholder="Select manager…"
              searchPlaceholder="Type a name…"
              options={employees.map((e) => ({ value: e.name, label: e.name }))}
            />
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
        <div className="grid gap-3 sm:grid-cols-3">
          <SetupField label="No. of positions">
            <SetupInput type="number" value={positions} onChange={(e) => setPositions(e.target.value)} />
          </SetupField>
          <SetupField label="Salary min (₹)" hint="Indian Rupees">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                ₹
              </span>
              <SetupInput
                className="pl-6"
                inputMode="numeric"
                value={salaryMinDisplay}
                onChange={(e) => {
                  const n = parseInrInput(e.target.value);
                  setSalaryMinDisplay(n ? formatInrGrouping(n) : e.target.value.replace(/[^\d]/g, ""));
                }}
                placeholder="6,00,000"
              />
            </div>
          </SetupField>
          <SetupField label="Salary max (₹)" hint="Indian Rupees">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                ₹
              </span>
              <SetupInput
                className="pl-6"
                inputMode="numeric"
                value={salaryMaxDisplay}
                onChange={(e) => {
                  const n = parseInrInput(e.target.value);
                  setSalaryMaxDisplay(n ? formatInrGrouping(n) : e.target.value.replace(/[^\d]/g, ""));
                }}
                placeholder="12,00,000"
              />
            </div>
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
        <SetupField label="JD attachment" hint="PDF / DOC for interview attach">
          <SetupInput
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setJdFileName(f?.name ?? "");
            }}
          />
          {jdFileName ? (
            <p className="mt-1 text-[10px] text-muted-foreground">{jdFileName}</p>
          ) : null}
        </SetupField>
        <SetupField label="Status">
          <SetupSelect
            value={status}
            onChange={(e) => setStatus(e.target.value as JobOpening["status"])}
          >
            <option value="open">Open</option>
            <option value="draft">Draft</option>
            <option value="on_hold">On Hold</option>
            <option value="closed">Closed</option>
          </SetupSelect>
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
