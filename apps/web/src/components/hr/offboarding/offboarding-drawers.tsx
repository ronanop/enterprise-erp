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
import { listHrBranchOptions, listHrEmployeeOptions, type HrOption } from "@/services/hr-service";
import { createOffboardingCase, isApiError } from "@/services/offboarding-service";
import type { SeparationType } from "@/types/offboarding";
import { SEPARATION_TYPE_LABELS } from "@/types/offboarding";

export function NewResignationDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [branches, setBranches] = useState<HrOption[]>([]);
  const [employees, setEmployees] = useState<HrOption[]>([]);
  const [branchId, setBranchId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [separationType, setSeparationType] = useState<SeparationType>("resignation");
  const [lwd, setLwd] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    void Promise.all([listHrBranchOptions(), listHrEmployeeOptions()]).then(([b, e]) => {
      setBranches(b);
      setEmployees(e);
      if (!branchId && b[0]) setBranchId(b[0].id);
      if (!employeeId && e[0]) setEmployeeId(e[0].id);
    });
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setLwd(d.toISOString().slice(0, 10));
  }, [open, branchId]);

  async function submit() {
    setError(null);
    if (!branchId || !employeeId || !lwd) {
      setError("Branch, employee, and last working day are required.");
      return;
    }
    setSaving(true);
    try {
      await createOffboardingCase({
        branchId,
        employeeId,
        separationType,
        requestedLastWorkingDate: lwd,
        reason: reason.trim() || undefined,
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(isApiError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="New resignation / exit"
      description="Start an offboarding case. HR will run approvals, clearance, exit interview, and FNF."
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving ? "Creating…" : "Create case"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <SetupField label="Branch" required>
          <SetupSelect value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Employee" required>
          <SetupSelect value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select employee</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.label}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Exit type" required>
          <SetupSelect
            value={separationType}
            onChange={(e) => setSeparationType(e.target.value as SeparationType)}
          >
            {Object.entries(SEPARATION_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Requested last working day" required>
          <SetupInput type="date" value={lwd} onChange={(e) => setLwd(e.target.value)} />
        </SetupField>
        <SetupField label="Reason" hint="Optional — shown to approvers">
          <SetupTextarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}

export function ExitInterviewDrawer({
  open,
  onClose,
  caseId,
  initialNotes,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  initialNotes?: string;
  onSaved: () => void;
}) {
  const [primaryReason, setPrimaryReason] = useState("career_growth");
  const [wouldRecommend, setWouldRecommend] = useState("yes");
  const [comments, setComments] = useState("");
  const [interviewerNotes, setInterviewerNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setInterviewerNotes(initialNotes ?? "");
    setComments("");
  }, [open, initialNotes]);

  async function submit() {
    setSaving(true);
    try {
      const { offboardingAction } = await import("@/services/offboarding-service");
      await offboardingAction(caseId, "exit-interview", {
        answers: {
          reason: primaryReason,
          recommend: wouldRecommend,
          comments,
        },
        interviewer_notes: interviewerNotes || null,
      });
      await offboardingAction(caseId, "checklist", {
        item_key: "exit_interview",
        done: true,
        notes: "Exit interview completed",
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Exit interview"
      description="Capture feedback before the employee leaves. Stored on the offboarding case."
      footer={
        <>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="cursor-pointer"
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving ? "Saving…" : "Save interview"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <SetupField label="Primary reason for leaving">
          <SetupSelect value={primaryReason} onChange={(e) => setPrimaryReason(e.target.value)}>
            <option value="career_growth">Career growth</option>
            <option value="compensation">Compensation</option>
            <option value="relocation">Relocation</option>
            <option value="personal">Personal</option>
            <option value="other">Other</option>
          </SetupSelect>
        </SetupField>
        <SetupField label="Would recommend employer?">
          <SetupSelect value={wouldRecommend} onChange={(e) => setWouldRecommend(e.target.value)}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="maybe">Maybe</option>
          </SetupSelect>
        </SetupField>
        <SetupField label="Employee comments">
          <SetupTextarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} />
        </SetupField>
        <SetupField label="HR interviewer notes">
          <SetupTextarea
            value={interviewerNotes}
            onChange={(e) => setInterviewerNotes(e.target.value)}
            rows={4}
          />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}
