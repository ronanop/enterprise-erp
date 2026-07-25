"use client";

import { useEffect, useMemo, useState } from "react";

import { EmployeeSelect, MasterSelect } from "@/components/hr/shared/employee-select";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import type { AcceptedOfferOption } from "@/services/onboarding-management-service";
import {
  loadHrMasterDirectory,
  type HrMasterOption,
} from "@/services/hr-master-connector";
import type { StartOnboardingInput } from "@/types/onboarding-management";

type Props = {
  open: boolean;
  onClose: () => void;
  acceptedOffers: AcceptedOfferOption[];
  onSubmit: (input: StartOnboardingInput) => Promise<void>;
};

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
    });
  }, [open]);

  const selected = useMemo(
    () => acceptedOffers.find((o) => o.id === offerId),
    [acceptedOffers, offerId],
  );

  const buddy = masters.employees.find((e) => e.id === buddyId);

  async function handleSave() {
    const name = selected?.candidateName || manualName.trim();
    const email = selected?.candidateEmail || manualEmail.trim();
    if (!name || !joiningDate) return;
    setSaving(true);
    try {
      await onSubmit({
        candidateId: selected?.candidateId || crypto.randomUUID(),
        candidateName: name,
        candidateEmail: email,
        candidatePhone: selected?.candidatePhone || manualPhone,
        offerId: selected?.id || crypto.randomUUID(),
        offerCode: selected?.code || `OFF-${Date.now().toString().slice(-6)}`,
        joiningDate,
        department: department || selected?.department || "General",
        designation: designation || selected?.designation || "Associate",
        reportingManager,
        branch: branch || "Head Office",
        shift: shift || "General",
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
      setJoiningDate("");
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
            disabled={saving || !(selected || manualName) || !joiningDate}
            onClick={() => void handleSave()}
          >
            {saving ? "Starting…" : "Start onboarding"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
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
              <SetupField label="Email">
                <SetupInput
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                />
              </SetupField>
              <SetupField label="Phone">
                <SetupInput value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} />
              </SetupField>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{selected?.candidateName}</p>
            <p>
              {selected?.candidateEmail || "No email"} · {selected?.designation}
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
            value={masters.departments.find((d) => d.label === department)?.id || department}
            options={masters.departments}
            onChange={(_id, opt) => setDepartment(opt?.label || _id)}
            placeholder={selected?.department || "Select department…"}
          />
          <MasterSelect
            label="Designation"
            value={masters.designations.find((d) => d.label === designation)?.id || designation}
            options={masters.designations}
            onChange={(_id, opt) => setDesignation(opt?.label || _id)}
            placeholder={selected?.designation || "Select designation…"}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <MasterSelect
            label="Reporting manager"
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

        <SetupField label="Invitation link expiry (days)" hint="Secure portal link validity">
          <SetupInput
            type="number"
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
          />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
