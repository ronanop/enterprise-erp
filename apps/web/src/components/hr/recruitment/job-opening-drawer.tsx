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
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  formatInrGrouping,
  loadAtsLookups,
  parseInrInput,
  type NamedOption,
} from "@/services/recruitment-ats-lookups";
import type {
  CreateJobInput,
  EmploymentType,
  JobOpening,
  JobPostingAudience,
  JobPriority,
} from "@/types/recruitment-ats";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateJobInput) => void | Promise<void>;
  initial?: JobOpening | null;
};

function nameById(options: NamedOption[], id: string): string {
  return options.find((o) => o.id === id)?.name ?? "";
}

function resolveOptionId(
  options: NamedOption[],
  id: string | undefined,
  name: string | undefined,
): string {
  if (id && options.some((o) => o.id === id)) return id;
  if (name) {
    const match = options.find((o) => o.name === name || o.name.includes(name) || name.includes(o.name));
    if (match) return match.id;
  }
  if (id) return id;
  return "";
}

function withSelectedOption(
  options: NamedOption[],
  id: string,
  fallbackName?: string,
): NamedOption[] {
  if (!id || options.some((o) => o.id === id)) return options;
  return [{ id, name: fallbackName?.trim() || id }, ...options];
}

export function JobOpeningDrawer({ open, onClose, onSubmit, initial }: Props) {
  const editing = Boolean(initial);
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType>("full_time");
  const [branchId, setBranchId] = useState("");
  const [location, setLocation] = useState("");
  const [hiringManagerId, setHiringManagerId] = useState("");
  const [recruiterId, setRecruiterId] = useState("");
  const [positions, setPositions] = useState("1");
  const [salaryMinDisplay, setSalaryMinDisplay] = useState("");
  const [salaryMaxDisplay, setSalaryMaxDisplay] = useState("");
  const [experienceMin, setExperienceMin] = useState("0");
  const [experienceMax, setExperienceMax] = useState("5");
  const [skills, setSkills] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<JobPriority>("medium");
  const [status, setStatus] = useState<JobOpening["status"]>("open");
  const [jdFileName, setJdFileName] = useState("");
  const [postingAudience, setPostingAudience] = useState<JobPostingAudience>("external");
  const [evidenceEmailFileName, setEvidenceEmailFileName] = useState("");
  const [evidenceEmailFile, setEvidenceEmailFile] = useState<File | null>(null);

  const [employees, setEmployees] = useState<NamedOption[]>([]);
  const [branches, setBranches] = useState<NamedOption[]>([]);
  const [departments, setDepartments] = useState<NamedOption[]>([]);
  const [designations, setDesignations] = useState<NamedOption[]>([]);
  const [recruiters, setRecruiters] = useState<NamedOption[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);

  // Hydrate every time the drawer opens so edit shows saved values.
  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setDepartmentId(initial?.departmentId ?? "");
    setDesignationId(initial?.designationId ?? "");
    setEmploymentType(initial?.employmentType ?? "full_time");
    setBranchId(initial?.branchId ?? "");
    const loc = (initial?.location ?? "").trim();
    setLocation(loc && loc !== "—" ? loc : "");
    setHiringManagerId(initial?.hiringManagerId ?? "");
    setRecruiterId(initial?.recruiterId ?? "");
    setPositions(String(initial?.positions ?? 1));
    setSalaryMinDisplay(initial?.salaryMin ? formatInrGrouping(initial.salaryMin) : "");
    setSalaryMaxDisplay(initial?.salaryMax ? formatInrGrouping(initial.salaryMax) : "");
    setExperienceMin(String(initial?.experienceMin ?? 0));
    setExperienceMax(String(initial?.experienceMax ?? 5));
    setSkills(initial?.skills?.join(", ") ?? "");
    setDescription(initial?.description ?? "");
    setDeadline(initial?.deadline ?? "");
    setPriority(initial?.priority ?? "medium");
    setStatus(initial?.status ?? "open");
    setJdFileName(initial?.jdFileName ?? "");
    setPostingAudience(initial?.postingAudience ?? "external");
    setEvidenceEmailFileName(initial?.evidenceEmailFileName ?? "");
    setEvidenceEmailFile(null);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLookupsLoading(true);
    void loadAtsLookups()
      .then((lookups) => {
        if (cancelled) return;
        setEmployees(lookups.hiringManagers);
        setBranches(lookups.branches);
        setDepartments(lookups.departments);
        setDesignations(lookups.designations);
        setRecruiters(lookups.recruiters);

        const nextBranch = resolveOptionId(
          lookups.branches,
          initial?.branchId,
          initial?.branch,
        );
        if (nextBranch) setBranchId(nextBranch);
        else if (!editing && lookups.branches[0]) setBranchId(lookups.branches[0].id);

        const branchForDept = nextBranch || initial?.branchId || "";
        const deptsForBranch = branchForDept
          ? lookups.departments.filter((d) => !d.branchId || d.branchId === branchForDept)
          : lookups.departments;
        const deptPool = deptsForBranch.length ? deptsForBranch : lookups.departments;
        const nextDept = resolveOptionId(deptPool, initial?.departmentId, initial?.department);
        if (nextDept) setDepartmentId(nextDept);
        else if (!editing && deptPool[0]) setDepartmentId(deptPool[0].id);

        const companyId =
          lookups.branches.find((b) => b.id === (nextBranch || initial?.branchId))?.companyId;
        const desigPool = companyId
          ? lookups.designations.filter((d) => !d.companyId || d.companyId === companyId)
          : lookups.designations;
        const desigSource = desigPool.length ? desigPool : lookups.designations;
        const nextDesig = resolveOptionId(
          desigSource,
          initial?.designationId,
          initial?.designation,
        );
        if (nextDesig) setDesignationId(nextDesig);

        const nextHm = resolveOptionId(
          lookups.hiringManagers,
          initial?.hiringManagerId,
          initial?.hiringManager,
        );
        if (nextHm) setHiringManagerId(nextHm);

        const nextRec = resolveOptionId(
          lookups.recruiters,
          initial?.recruiterId,
          initial?.recruiter,
        );
        if (nextRec) setRecruiterId(nextRec);

        setLocation((prev) => {
          if (prev.trim() && prev !== "—") return prev;
          const fromInitial = (initial?.location ?? "").trim();
          if (fromInitial && fromInitial !== "—") return fromInitial;
          const branchName =
            lookups.branches.find((b) => b.id === (nextBranch || initial?.branchId))?.name ||
            initial?.branch ||
            "";
          return branchName;
        });
      })
      .finally(() => {
        if (!cancelled) setLookupsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, editing, initial]);

  const [saving, setSaving] = useState(false);

  const departmentsForBranch = useMemo(() => {
    const scoped = branchId
      ? departments.filter((d) => !d.branchId || d.branchId === branchId)
      : departments;
    const base = scoped.length ? scoped : departments;
    return withSelectedOption(base, departmentId, initial?.department);
  }, [departments, branchId, departmentId, initial?.department]);

  const designationsForCompany = useMemo(() => {
    const companyId = branches.find((b) => b.id === branchId)?.companyId;
    const scoped = companyId
      ? designations.filter((d) => !d.companyId || d.companyId === companyId)
      : designations;
    const base = scoped.length ? scoped : designations;
    return withSelectedOption(base, designationId, initial?.designation);
  }, [designations, branches, branchId, designationId, initial?.designation]);

  const hiringManagerOptions = useMemo(
    () => withSelectedOption(employees, hiringManagerId, initial?.hiringManager),
    [employees, hiringManagerId, initial?.hiringManager],
  );

  const recruiterOptions = useMemo(
    () => withSelectedOption(recruiters, recruiterId, initial?.recruiter),
    [recruiters, recruiterId, initial?.recruiter],
  );

  async function save() {
    if (!title.trim()) return;
    if (!branchId || !departmentId || !hiringManagerId) return;
    if (!evidenceEmailFileName.trim() && !evidenceEmailFile) return;
    const designationName = nameById(designationsForCompany, designationId) || title.trim();
    const branchName = nameById(branches, branchId) || "Head Office";
    const locationValue = location.trim() || branchName;
    setSaving(true);
    try {
      await Promise.resolve(
        onSubmit({
          title: title.trim(),
          department: nameById(departmentsForBranch, departmentId) || "General",
          departmentId,
          designation: designationName,
          designationId: designationId || undefined,
          employmentType,
          branch: branchName,
          branchId,
          location: locationValue,
          hiringManager: nameById(hiringManagerOptions, hiringManagerId),
          hiringManagerId,
          recruiter: nameById(recruiterOptions, recruiterId),
          recruiterId: recruiterId || undefined,
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
          postingAudience,
          evidenceEmailFileName:
            evidenceEmailFile?.name || evidenceEmailFileName.trim() || undefined,
          evidenceEmailFile: evidenceEmailFile,
        }),
      );
      onClose();
    } catch {
      /* parent shows toast; keep drawer open */
    } finally {
      setSaving(false);
    }
  }

  const canSave = Boolean(
    title.trim() &&
      branchId &&
      departmentId &&
      hiringManagerId &&
      (evidenceEmailFile || evidenceEmailFileName.trim()),
  );

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
          <Button
            type="button"
            className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!canSave || saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : initial ? "Save" : "Create Job"}
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
        <SetupField label="Posting type" required>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="job-posting-audience"
                className="cursor-pointer"
                checked={postingAudience === "external"}
                onChange={() => setPostingAudience("external")}
              />
              External
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="job-posting-audience"
                className="cursor-pointer"
                checked={postingAudience === "internal"}
                onChange={() => setPostingAudience("internal")}
              />
              Internal
            </label>
          </div>
        </SetupField>
        <SetupField label="Approval email evidence" required>
          <SetupInput
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.eml,.msg,.doc,.docx"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setEvidenceEmailFile(f);
              setEvidenceEmailFileName(f?.name ?? "");
            }}
          />
          {evidenceEmailFileName ? (
            <p className="mt-1 text-[10px] text-muted-foreground">{evidenceEmailFileName}</p>
          ) : null}
        </SetupField>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Department" required>
            <SearchableSelect
              value={departmentId}
              onChange={setDepartmentId}
              placeholder={lookupsLoading ? "Loading…" : "Select department…"}
              searchPlaceholder="Type a department…"
              options={departmentsForBranch.map((d) => ({ value: d.id, label: d.name }))}
              disabled={lookupsLoading && !departmentId}
            />
          </SetupField>
          <SetupField label="Designation">
            <SearchableSelect
              value={designationId}
              onChange={setDesignationId}
              placeholder={lookupsLoading ? "Loading…" : "Select designation…"}
              searchPlaceholder="Type a designation…"
              options={designationsForCompany.map((d) => ({ value: d.id, label: d.name }))}
              disabled={lookupsLoading && !designationId}
            />
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
          <SetupField label="Branch" required>
            <SetupSelect value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Select branch…</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
          <SetupField label="Location">
            <SetupInput value={location} onChange={(e) => setLocation(e.target.value)} />
          </SetupField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Hiring manager" required>
            <SearchableSelect
              value={hiringManagerId}
              onChange={setHiringManagerId}
              placeholder="Select manager…"
              searchPlaceholder="Type a name…"
              options={hiringManagerOptions.map((e) => ({ value: e.id, label: e.name }))}
            />
          </SetupField>
          <SetupField label="Recruiter">
            <SearchableSelect
              value={recruiterId}
              onChange={setRecruiterId}
              placeholder="Select recruiter…"
              searchPlaceholder="Type a name…"
              options={recruiterOptions.map((r) => ({ value: r.id, label: r.name }))}
            />
          </SetupField>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SetupField label="No. of positions">
            <SetupInput type="number" value={positions} onChange={(e) => setPositions(e.target.value)} />
          </SetupField>
          <SetupField label="Salary min (₹)">
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
          <SetupField label="Salary max (₹)">
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
