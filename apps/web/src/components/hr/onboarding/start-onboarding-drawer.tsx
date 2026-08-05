"use client";

import { useEffect, useMemo, useState } from "react";

import { EmployeeSelect, MasterSelect } from "@/components/hr/shared/employee-select";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
} from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import type { AcceptedOfferOption } from "@/services/onboarding-management-service";
import {
  loadHrMasterDirectory,
  type HrMasterOption,
} from "@/services/hr-master-connector";
import { validateEmail, validateMobile } from "@/lib/employee-validators";
import { managerDisplayName } from "@/lib/hr/org-heads";
import type { StartOnboardingInput } from "@/types/onboarding-management";

type Props = {
  open: boolean;
  onClose: () => void;
  acceptedOffers: AcceptedOfferOption[];
  onSubmit: (input: StartOnboardingInput) => Promise<void>;
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function StartOnboardingDrawer({ open, onClose, acceptedOffers, onSubmit }: Props) {
  const [offerId, setOfferId] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [reportingManager, setReportingManager] = useState("");
  const [branch, setBranch] = useState("");
  const [shift, setShift] = useState("");
  const [leavePolicy, setLeavePolicy] = useState("Standard");
  const [employmentType, setEmploymentType] = useState("full_time");
  const [buddyId, setBuddyId] = useState("");
  const [hrOwner, setHrOwner] = useState("HR Executive");
  const [expiryDays, setExpiryDays] = useState("14");
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [masters, setMasters] = useState<{
    departments: HrMasterOption[];
    designations: HrMasterOption[];
    managers: HrMasterOption[];
    shifts: HrMasterOption[];
    branches: HrMasterOption[];
    employees: HrMasterOption[];
  }>({
    departments: [],
    designations: [],
    managers: [],
    shifts: [],
    branches: [],
    employees: [],
  });

  useEffect(() => {
    if (!open) return;
    void loadHrMasterDirectory().then((m) => {
      setMasters({
        departments: m.departments,
        designations: m.designations,
        managers: m.managers,
        shifts: m.shifts,
        branches: m.branches,
        employees: m.employees,
      });
      setBranch((prev) => prev || m.branches[0]?.label || "Head Office");
      setShift((prev) => prev || m.shifts[0]?.label || "General");
      if (!m.designations.length) {
        toast("No designations found — add them in HR Setup → Designations", "error");
      }
    });
  }, [open]);

  const selected = useMemo(
    () => acceptedOffers.find((o) => o.id === offerId),
    [acceptedOffers, offerId],
  );

  useEffect(() => {
    if (!selected) return;
    if (selected.designation) setDesignation(selected.designation);
    if (selected.department) setDepartment(selected.department);
  }, [selected]);

  const buddy = masters.employees.find((e) => e.id === buddyId);

  const branchId = masters.branches.find((b) => b.label === branch)?.id ?? "";
  const departmentId = masters.departments.find((d) => d.label === department)?.id ?? "";
  const branchHeadName = managerDisplayName(
    masters.branches.find((b) => b.id === branchId)?.headEmployeeId,
    masters.employees.map((m) => ({ id: m.id, label: m.label })),
  );
  const departmentHeadName = managerDisplayName(
    masters.departments.find((d) => d.id === departmentId)?.headEmployeeId,
    masters.employees.map((m) => ({ id: m.id, label: m.label })),
  );

  function validate(): string[] {
    const next: string[] = [];
    const name = selected?.candidateName || manualName.trim();
    const email = (selected?.candidateEmail || manualEmail).trim();
    const phone = digitsOnly(selected?.candidatePhone || manualPhone);

    if (!name) next.push("Candidate name is required");
    if (!joiningDate) next.push("Joining date is required");

    if (!selected) {
      const emailErr = validateEmail(email);
      if (emailErr) next.push(emailErr);
      if (!phone) next.push("Phone is required");
      else {
        const phoneErr = validateMobile(phone);
        if (phoneErr) next.push(phoneErr);
      }
    } else if (phone) {
      const phoneErr = validateMobile(phone);
      if (phoneErr) next.push(phoneErr);
    }

    if (!(designation || selected?.designation)) {
      next.push("Designation is required");
    }
    if (!(department || selected?.department || masters.departments[0])) {
      next.push("Department is required");
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

    const name = selected?.candidateName || manualName.trim();
    const email = (selected?.candidateEmail || manualEmail).trim();
    const phone = digitsOnly(selected?.candidatePhone || manualPhone);

    setSaving(true);
    try {
      await onSubmit({
        candidateId: selected?.candidateId || crypto.randomUUID(),
        candidateName: name,
        candidateEmail: email,
        candidatePhone: phone,
        offerId: selected?.id || crypto.randomUUID(),
        offerCode: selected?.code || `OFF-${Date.now().toString().slice(-6)}`,
        joiningDate,
        department: department || selected?.department || masters.departments[0]?.label || "General",
        designation: designation || selected?.designation || "",
        reportingManager,
        branch: branch || masters.branches[0]?.label || "Head Office",
        shift: shift || masters.shifts[0]?.label || "General",
        leavePolicy,
        employmentType,
        buddy: buddy ? buddy.label.split(" · ")[0] : undefined,
        hrOwner,
        invitationExpiryDays: Number(expiryDays) || 14,
      });
      onClose();
      setOfferId("");
      setManualName("");
      setManualEmail("");
      setManualPhone("");
      setJoiningDate("");
      setDesignation("");
      setDepartment("");
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
      description="Create a pre-joining case after offer acceptance. Linked to Workforce masters for department, shift, and buddy."
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

        <SetupField label="Accepted offer" hint="Select from Recruitment offers with Accepted status">
          <SetupSelect value={offerId} onChange={(e) => setOfferId(e.target.value)}>
            <option value="">
              {acceptedOffers.length ? "Select offer…" : "No accepted offers — enter manually"}
            </option>
            {acceptedOffers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.code} · {o.candidateName}
              </option>
            ))}
          </SetupSelect>
        </SetupField>

        {!offerId ? (
          <>
            <SetupField label="Candidate name" required>
              <SetupInput
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Full name"
              />
            </SetupField>
            <div className="grid gap-3 sm:grid-cols-2">
              <SetupField label="Email" required>
                <SetupInput
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </SetupField>
              <SetupField label="Phone" required hint="10-digit Indian mobile">
                <SetupInput
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  placeholder="9876543210"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(digitsOnly(e.target.value).slice(0, 10))}
                />
              </SetupField>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{selected?.candidateName}</p>
            <p>
              {selected?.candidateEmail || "No email"} · {selected?.designation || "No designation"}
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Joining date" required>
            <SetupInput
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
            />
          </SetupField>
          <SetupField label="Employment type">
            <SetupSelect
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
            >
              <option value="full_time">Full Time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
              <option value="part_time">Part Time</option>
            </SetupSelect>
          </SetupField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <MasterSelect
            label="Department"
            required
            value={masters.departments.find((d) => d.label === department)?.id || ""}
            options={masters.departments}
            onChange={(_id, opt) => setDepartment(opt?.label || "")}
            placeholder={selected?.department || "Select department…"}
          />
          <MasterSelect
            label="Designation"
            required
            value={masters.designations.find((d) => d.label === designation)?.id || ""}
            options={masters.designations}
            onChange={(_id, opt) => setDesignation(opt?.label || "")}
            placeholder={
              masters.designations.length
                ? selected?.designation || "Select designation…"
                : "No designations in DB"
            }
          />
        </div>
        {!masters.designations.length ? (
          <p className="text-[11px] text-amber-800">
            Designations come from HR Setup → Employment → Designations (API `/hr/designations`).
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {masters.designations.length} designation(s) loaded from database.
          </p>
        )}

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
            value={masters.branches.find((b) => b.label === branch)?.id || branch}
            options={masters.branches}
            onChange={(_id, opt) => setBranch(opt?.label || _id)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Branch head" hint="From HR Setup → Branches">
            <SetupInput readOnly value={branchHeadName} />
          </SetupField>
          <SetupField label="Department head" hint="From HR Setup → Departments">
            <SetupInput readOnly value={departmentHeadName} />
          </SetupField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <MasterSelect
            label="Shift"
            value={masters.shifts.find((s) => s.label === shift)?.id || shift}
            options={masters.shifts}
            onChange={(_id, opt) => setShift(opt?.label || _id)}
          />
          <SetupField label="Leave policy">
            <SetupInput value={leavePolicy} onChange={(e) => setLeavePolicy(e.target.value)} />
          </SetupField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <EmployeeSelect
            label="Assign buddy"
            value={buddyId}
            options={masters.employees}
            onChange={setBuddyId}
          />
          <SetupField label="Assign HR">
            <SetupInput value={hrOwner} onChange={(e) => setHrOwner(e.target.value)} />
          </SetupField>
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
