"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";

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
  createAttachment,
  createFollowup,
  createTask,
  fileToBase64,
  listBranchOptions,
  listEmployeeOptions,
  listOpportunities,
  type Company,
  type CrmFollowup,
  type FollowupFormInput,
  type Opportunity,
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
  companyAccountId?: string | null;
  defaultBranchId?: string | null;
  opportunityId?: string | null;
};

type FormState = {
  branch_id: string;
  customer_name: string;
  opportunity_id: string;
  task_deadline_date: string;
  task_deadline_time: string;
  notes: string;
  owner_employee_id: string;
};

function emptyForm(
  branchId = "",
  customerName = "",
  ownerId = "",
  opportunityId = "",
): FormState {
  return {
    branch_id: branchId,
    customer_name: customerName,
    opportunity_id: opportunityId,
    task_deadline_date: todayIsoDate(),
    task_deadline_time: defaultTime(24),
    notes: "",
    owner_employee_id: ownerId,
  };
}

function opportunityLabel(opp: Opportunity): string {
  const name = opp.opportunity_name?.trim() || "";
  const code = opp.opportunity_code?.trim() || "";
  if (name && code && name !== code) return `${name} (${code})`;
  return name || code;
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
  companyAccountId,
  defaultBranchId,
  opportunityId,
}: Props) {
  const resolvedAccountId = companyAccount?.id ?? companyAccountId ?? "";
  const [branches, setBranches] = useState<Option[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const [branchRows, employeeRows, opportunityRows] = await Promise.all([
        listBranchOptions().catch(() => [] as Option[]),
        listEmployeeOptions().catch(() => [] as Option[]),
        resolvedAccountId
          ? listOpportunities({ company_account_id: resolvedAccountId }).catch(() => [] as Opportunity[])
          : Promise.resolve([] as Opportunity[]),
      ]);
      if (cancelled) return;
      setBranches(branchRows);
      setEmployees(employeeRows);
      setOpportunities(opportunityRows);
      const branchId =
        defaultBranchId ||
        companyAccount?.branch_id ||
        branchRows[0]?.id ||
        "";
      const ownerId =
        companyAccount?.account_owner_id ||
        employeeRows[0]?.id ||
        "";
      const presetOpportunity =
        opportunityId && opportunityRows.some((row) => row.id === opportunityId)
          ? opportunityId
          : opportunityRows[0]?.id ?? "";
      setForm(
        emptyForm(
          branchId,
          companyAccount?.customer_name ?? "",
          ownerId,
          presetOpportunity,
        ),
      );
      setPendingFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setError(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, companyAccount, companyAccountId, defaultBranchId, opportunityId, resolvedAccountId]);

  if (!open) return null;

  async function onSubmit() {
    const missing: string[] = [];
    if (!form.customer_name.trim()) missing.push("Customer Name");
    if (!form.task_deadline_date) missing.push("Task deadline date");
    if (!form.task_deadline_time) missing.push("Task deadline time");
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
      const scheduledAt = new Date(
        `${form.task_deadline_date}T${form.task_deadline_time}:00`,
      ).toISOString();
      const selectedOpportunity =
        opportunities.find((row) => row.id === form.opportunity_id) ?? null;
      const payload: FollowupFormInput = {
        branch_id: form.branch_id,
        owner_employee_id: form.owner_employee_id,
        followup_at: scheduledAt,
        followup_type: "call",
        company_account_id: resolvedAccountId || null,
        customer_name: form.customer_name.trim(),
        notes: form.notes.trim() || null,
        opportunity_id: form.opportunity_id || opportunityId || null,
      };
      const saved = await createFollowup(payload);
      const taskDueAt = scheduledAt;
      await createTask({
        branch_id: form.branch_id,
        title: `Follow-up: ${form.customer_name.trim()}`,
        description: form.notes.trim() || null,
        owner_employee_id: form.owner_employee_id,
        assigned_to_employee_id: form.owner_employee_id,
        due_at: taskDueAt,
        priority: "medium",
        opportunity_id: form.opportunity_id || opportunityId || null,
        account_name: form.customer_name.trim(),
        opportunity_name: selectedOpportunity?.opportunity_name ?? null,
      });
      for (const file of pendingFiles) {
        const content_base64 = await fileToBase64(file);
        await createAttachment({
          entity_type: "followup",
          entity_id: saved.id,
          branch_id: form.branch_id,
          company_id: companyAccount?.company_id ?? null,
          file_name: file.name,
          category: "other",
          content_base64,
          content_type: file.type || "application/octet-stream",
        });
      }
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

          <FieldRow label="Opportunity Name">
            <FinanceSelect
              value={form.opportunity_id}
              onChange={(e) => setForm((f) => ({ ...f, opportunity_id: e.target.value }))}
            >
              <option value="">Select opportunity</option>
              {opportunities.map((opp) => (
                <option key={opp.id} value={opp.id}>
                  {opportunityLabel(opp)}
                </option>
              ))}
            </FinanceSelect>
          </FieldRow>

          <FieldRow label="Task deadline" required>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="date"
                value={form.task_deadline_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, task_deadline_date: e.target.value }))
                }
                className="h-8"
                aria-label="Task deadline date"
              />
              <Input
                type="time"
                value={form.task_deadline_time}
                onChange={(e) =>
                  setForm((f) => ({ ...f, task_deadline_time: e.target.value }))
                }
                className="h-8"
                aria-label="Task deadline time"
              />
            </div>
          </FieldRow>

          <FieldRow label="Remark">
            <FinanceTextarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
            <div className="mt-2 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                multiple
                disabled={saving}
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  if (picked.length === 0) return;
                  setPendingFiles((current) => [...current, ...picked]);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={saving}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-3.5" aria-hidden="true" />
                Attachment
              </Button>
              {pendingFiles.length > 0 ? (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {pendingFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${file.size}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1"
                    >
                      <span className="min-w-0 truncate text-foreground">{file.name}</span>
                      <button
                        type="button"
                        className="cursor-pointer shrink-0 text-muted-foreground transition-colors duration-200 hover:text-foreground"
                        disabled={saving}
                        aria-label={`Remove ${file.name}`}
                        onClick={() =>
                          setPendingFiles((current) =>
                            current.filter((_, fileIndex) => fileIndex !== index),
                          )
                        }
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
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
            {saving ? "Saving…" : "Create Follow-up"}
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
