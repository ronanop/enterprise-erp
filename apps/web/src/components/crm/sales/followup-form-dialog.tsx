"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  FinanceField,
  FinanceSelect,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import {
  RequiredFieldsDialog,
  missingRequiredMessage,
} from "@/components/crm/sales/required-fields-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  createFollowup,
  listBranchOptions,
  listEmployeeOptions,
  type Company,
  type CrmFollowup,
  type FollowupFormInput,
  type Option,
} from "@/services/sales-crm-service";

function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function defaultTime(hoursFromNow = 1): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + hoursFromNow);
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (followup: CrmFollowup) => void;
  companyAccount?: Company | null;
  defaultBranchId?: string | null;
  opportunityId?: string | null;
};

type FormState = {
  branch_id: string;
  customer_name: string;
  followup_date: string;
  followup_time: string;
  notes: string;
  owner_employee_id: string;
};

function emptyForm(branchId = "", customerName = "", ownerId = ""): FormState {
  return {
    branch_id: branchId,
    customer_name: customerName,
    followup_date: todayIsoDate(),
    followup_time: defaultTime(1),
    notes: "",
    owner_employee_id: ownerId,
  };
}

function FieldRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <FinanceField label={required ? `${label} *` : label}>{children}</FinanceField>
  );
}

export function FollowupFormDialog({
  open,
  onClose,
  onSaved,
  companyAccount,
  defaultBranchId,
  opportunityId,
}: Props) {
  const [branches, setBranches] = useState<Option[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const [branchRows, employeeRows] = await Promise.all([
        listBranchOptions().catch(() => [] as Option[]),
        listEmployeeOptions().catch(() => [] as Option[]),
      ]);
      if (cancelled) return;
      setBranches(branchRows);
      setEmployees(employeeRows);
      const branchId =
        defaultBranchId ||
        companyAccount?.branch_id ||
        branchRows[0]?.id ||
        "";
      const ownerId =
        companyAccount?.account_owner_id ||
        employeeRows[0]?.id ||
        "";
      setForm(
        emptyForm(branchId, companyAccount?.customer_name ?? "", ownerId),
      );
      setError(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, companyAccount, defaultBranchId]);

  if (!open) return null;

  async function onSubmit() {
    const missing: string[] = [];
    if (!form.customer_name.trim()) missing.push("Customer Name");
    if (!form.followup_date) missing.push("Date");
    if (!form.followup_time) missing.push("Time");
    if (!form.owner_employee_id) missing.push("Team Member");
    if (!form.branch_id) missing.push("Branch");
    if (missing.length > 0) {
      setMandateMessage(missingRequiredMessage(missing));
      setMandateOpen(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const followupAt = new Date(`${form.followup_date}T${form.followup_time}:00`).toISOString();
      const payload: FollowupFormInput = {
        branch_id: form.branch_id,
        owner_employee_id: form.owner_employee_id,
        followup_at: followupAt,
        followup_type: "call",
        company_account_id: companyAccount?.id ?? null,
        customer_name: form.customer_name.trim(),
        notes: form.notes.trim() || null,
        opportunity_id: opportunityId ?? null,
      };
      const saved = await createFollowup(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create follow-up");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="followup-dialog-title"
        className="w-full max-w-lg rounded-xl border border-border/80 bg-card shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <h2 id="followup-dialog-title" className="text-sm font-medium tracking-tight">
            New Follow-up
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            disabled={saving}
            onClick={onClose}
          >
            Close
          </Button>
        </div>

        <div className="space-y-3 px-4 py-4">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <FieldRow label="Customer Name" required>
            <Input
              value={form.customer_name}
              onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
              className="h-8"
            />
          </FieldRow>

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldRow label="Date" required>
              <Input
                type="date"
                value={form.followup_date}
                onChange={(e) => setForm((f) => ({ ...f, followup_date: e.target.value }))}
                className="h-8"
              />
            </FieldRow>
            <FieldRow label="Time" required>
              <Input
                type="time"
                value={form.followup_time}
                onChange={(e) => setForm((f) => ({ ...f, followup_time: e.target.value }))}
                className="h-8"
              />
            </FieldRow>
          </div>

          <FieldRow label="Remark">
            <FinanceTextarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </FieldRow>

          <FieldRow label="Internal Team Member" required>
            <FinanceSelect
              value={form.owner_employee_id}
              onChange={(e) => setForm((f) => ({ ...f, owner_employee_id: e.target.value }))}
            >
              <option value="">Select team member</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.label}
                </option>
              ))}
            </FinanceSelect>
          </FieldRow>

          {branches.length > 1 ? (
            <FieldRow label="Branch" required>
              <FinanceSelect
                value={form.branch_id}
                onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
              >
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.label}
                  </option>
                ))}
              </FinanceSelect>
            </FieldRow>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border/70 px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            disabled={saving}
            onClick={() => void onSubmit()}
          >
            {saving ? "Saving…" : "Save Follow-up"}
          </Button>
        </div>
      </div>
      <RequiredFieldsDialog
        open={mandateOpen}
        message={mandateMessage}
        onClose={() => setMandateOpen(false)}
      />
    </div>
  );
}
