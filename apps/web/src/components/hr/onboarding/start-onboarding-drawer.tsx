"use client";

import { useEffect, useState } from "react";

import { MasterSelect } from "@/components/hr/shared/employee-select";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
} from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import {
  loadHrMasterDirectory,
  type HrMasterOption,
} from "@/services/hr-master-connector";
import { validateEmail, validateMobile } from "@/lib/employee-validators";
import { EMPLOYMENT_TYPE_OPTIONS, employmentDurationKind } from "@/config/hr-master-options";
import { listEmploymentTypeOptions, listEntityOptions, loadSetupOrgLookups } from "@/services/hr-setup-service";
import type { StartOnboardingInput } from "@/types/onboarding-management";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: StartOnboardingInput) => Promise<void>;
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function StartOnboardingDrawer({ open, onClose, onSubmit }: Props) {
  const [joiningDate, setJoiningDate] = useState("");
  const [entityId, setEntityId] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [reportingManager, setReportingManager] = useState("");
  const [branch, setBranch] = useState("");
  const [employmentType, setEmploymentType] = useState("permanent");
  const [probationPeriodDays, setProbationPeriodDays] = useState("");
  const [trainingDurationDays, setTrainingDurationDays] = useState("");
  const [expiryDays, setExpiryDays] = useState("14");
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidatePhone, setCandidatePhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [masters, setMasters] = useState<{
    departments: HrMasterOption[];
    designations: HrMasterOption[];
    managers: HrMasterOption[];
    branches: HrMasterOption[];
  }>({
    departments: [],
    designations: [],
    managers: [],
    branches: [],
  });
  const [employmentTypes, setEmploymentTypes] = useState(EMPLOYMENT_TYPE_OPTIONS);
  const [entities, setEntities] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    void Promise.all([
      loadHrMasterDirectory(),
      listEmploymentTypeOptions(),
      listEntityOptions(),
      loadSetupOrgLookups(),
    ]).then(([m, types, entityOpts, org]) => {
      const orgBranches = org.branches.map((b) => ({
        id: b.value,
        label: b.label,
        companyId: b.companyId,
      }));
      const byId = new Map<string, HrMasterOption>();
      for (const b of [...orgBranches, ...m.branches]) {
        if (b.id && !byId.has(b.id)) byId.set(b.id, b);
      }
      const branches = [...byId.values()];
      setMasters({
        departments: m.departments,
        designations: m.designations,
        managers: m.managers,
        branches,
      });
      setEmploymentTypes(types);
      setEntities(entityOpts);
      setBranch((prev) => prev || branches[0]?.label || "Head Office");
      setEntityId((prev) => prev || entityOpts[0]?.value || "");
      if (!m.designations.length) {
        toast("No designations found — add them in HR Setup → Designations", "error");
      }
      if (!entityOpts.length) {
        toast("No legal entities found — add them in HR Setup → Legal Entities", "error");
      }
      if (!branches.length) {
        toast("No branches found — add them in Org Setup → Branches", "error");
      }
    });
  }, [open]);

  function validate(): string[] {
    const next: string[] = [];
    const name = candidateName.trim();
    const email = candidateEmail.trim();
    const phone = digitsOnly(candidatePhone);

    if (!name) next.push("Candidate name is required");
    if (!joiningDate) next.push("Joining date is required");
    if (!entityId) next.push("Legal entity is required");

    const emailErr = validateEmail(email);
    if (emailErr) next.push(emailErr);
    if (!phone) next.push("Phone is required");
    else {
      const phoneErr = validateMobile(phone);
      if (phoneErr) next.push(phoneErr);
    }

    if (!designation) next.push("Designation is required");
    if (!department && !masters.departments[0]) next.push("Department is required");

    const durationKind = employmentDurationKind(employmentType);
    if (durationKind === "probation") {
      const days = Number(probationPeriodDays);
      if (!probationPeriodDays.trim() || !Number.isFinite(days) || days < 1 || days > 730) {
        next.push("Probation period (days) is required");
      }
    }
    if (durationKind === "training") {
      const days = Number(trainingDurationDays);
      if (!trainingDurationDays.trim() || !Number.isFinite(days) || days < 1 || days > 730) {
        next.push("Training duration (days) is required");
      }
    }

    const days = Number(expiryDays);
    if (!Number.isFinite(days) || days < 1 || days > 90) {
      next.push("Invitation expiry must be between 1 and 90 days");
    }

    return next;
  }

  async function handleSave() {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (nextErrors.length) {
      toast(nextErrors[0], "error");
      return;
    }

    const name = candidateName.trim();
    const email = candidateEmail.trim();
    const phone = digitsOnly(candidatePhone);
    const entity = entities.find((e) => e.value === entityId);

    setSaving(true);
    try {
      await onSubmit({
        candidateId: crypto.randomUUID(),
        candidateName: name,
        candidateEmail: email,
        candidatePhone: phone,
        joiningDate,
        entityId,
        entityName: entity?.label || "",
        department: department || masters.departments[0]?.label || "General",
        designation,
        reportingManager,
        branch: branch || masters.branches[0]?.label || "Head Office",
        employmentType,
        probationPeriodDays:
          employmentDurationKind(employmentType) === "probation" ? probationPeriodDays.trim() : "0",
        trainingDurationDays:
          employmentDurationKind(employmentType) === "training" ? trainingDurationDays.trim() : "",
        invitationExpiryDays: Number(expiryDays) || 14,
      });
      onClose();
      setCandidateName("");
      setCandidateEmail("");
      setCandidatePhone("");
      setJoiningDate("");
      setDesignation("");
      setDepartment("");
      setEntityId(entities[0]?.value || "");
      setErrors([]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title="Start Onboarding"
      description="Create a pre-joining case. The candidate completes their profile via the portal; HR verifies and assigns employment details after joining."
      footer={
        <>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Starting…" : "Start onboarding"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {errors.length ? (
          <ul className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            {errors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        ) : null}

        <SetupField label="Candidate name" required>
          <SetupInput
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            placeholder="Full name"
          />
        </SetupField>

        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Personal mail" required hint="Candidate personal email (not company email)">
            <SetupInput
              type="email"
              value={candidateEmail}
              onChange={(e) => setCandidateEmail(e.target.value)}
              placeholder="name@gmail.com"
            />
          </SetupField>
          <SetupField label="Phone" required hint="10-digit Indian mobile">
            <SetupInput
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              placeholder="9876543210"
              value={candidatePhone}
              onChange={(e) => setCandidatePhone(digitsOnly(e.target.value).slice(0, 10))}
            />
          </SetupField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Joining date" required>
            <SetupInput
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
            />
          </SetupField>
          <SetupField label="Legal entity" required hint="HR Setup → Legal Entities">
            <SetupSelect value={entityId} onChange={(e) => setEntityId(e.target.value)}>
              <option value="">Select entity…</option>
              {entities.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Employment type">
            <SetupSelect
              value={employmentType}
              onChange={(e) => {
                const next = e.target.value;
                setEmploymentType(next);
                if (employmentDurationKind(next) !== "probation") setProbationPeriodDays("");
                if (employmentDurationKind(next) !== "training") setTrainingDurationDays("");
              }}
            >
              {employmentTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
          {employmentDurationKind(employmentType) === "probation" ? (
            <SetupField
              label="Probation period (days)"
              required
              hint="Enter the probation length in days"
            >
              <SetupInput
                type="number"
                min={1}
                max={730}
                placeholder="e.g. 90"
                value={probationPeriodDays}
                onChange={(e) => setProbationPeriodDays(e.target.value)}
              />
            </SetupField>
          ) : null}
          {employmentDurationKind(employmentType) === "training" ? (
            <SetupField
              label="Training duration (days)"
              required
              hint="Enter the intern/trainee duration in days"
            >
              <SetupInput
                type="number"
                min={1}
                max={730}
                placeholder="e.g. 90"
                value={trainingDurationDays}
                onChange={(e) => setTrainingDurationDays(e.target.value)}
              />
            </SetupField>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <MasterSelect
            label="Department"
            required
            value={masters.departments.find((d) => d.label === department)?.id || ""}
            options={masters.departments}
            onChange={(_id, opt) => setDepartment(opt?.label || "")}
            placeholder="Select department…"
          />
          <MasterSelect
            label="Designation"
            required
            value={masters.designations.find((d) => d.label === designation)?.id || ""}
            options={masters.designations}
            onChange={(_id, opt) => setDesignation(opt?.label || "")}
            placeholder={
              masters.designations.length ? "Select designation…" : "No designations in DB"
            }
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <MasterSelect
            label="Reporting manager"
            hint="Only employees set up as reporting managers"
            value={masters.managers.find((m) => m.label.startsWith(reportingManager))?.id || ""}
            options={masters.managers}
            onChange={(_id, opt) =>
              setReportingManager(opt ? opt.label.split(" (")[0] : "")
            }
          />
                  <MasterSelect
                    label="Branch"
                    hint="Org Setup → Branches"
                    value={masters.branches.find((b) => b.label === branch)?.id || ""}
                    options={masters.branches}
                    onChange={(_id, opt) => setBranch(opt?.label || "")}
                    placeholder={
                      masters.branches.length
                        ? "Select company branch…"
                        : "No branches — add in Org Setup → Branches"
                    }
                  />
        </div>

        <SetupField label="Invitation link expiry (days)" hint="Secure portal link validity (1–90)">
          <SetupInput
            type="number"
            min={1}
            max={90}
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
          />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
