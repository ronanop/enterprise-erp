"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  FinanceField,
  FinanceSelect,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  createTask,
  getCompany,
  getOpportunity,
  listEmployeeOptions,
  type Company,
  type CrmTask,
  type Opportunity,
  type Option,
} from "@/services/sales-crm-service";

const PRIORITIES = [
  { value: "highest", label: "Highest" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

const REPEAT_OPTIONS = [
  { value: "none", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

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

function dueAtIso(date: string): string | null {
  if (!date) return null;
  return `${date}T23:59:00.000Z`;
}

function accountLabel(company: Company | null | undefined): string {
  if (!company) return "";
  return company.customer_name?.trim() || "";
}

function opportunityLabel(opp: Opportunity | null | undefined): string {
  if (!opp) return "";
  const name = opp.opportunity_name?.trim() || "";
  const code = opp.opportunity_code?.trim() || "";
  if (name && code && name !== code) return `${name} (${code})`;
  return name || code;
}

function employeeLabel(employees: Option[], employeeId: string): string {
  if (!employeeId) return "";
  return employees.find((row) => row.id === employeeId)?.label?.trim() || "";
}

type FormState = {
  account_name: string;
  opportunity_name: string;
  subject: string;
  due_date: string;
  priority: "highest" | "high" | "medium" | "low";
  owner_employee_id: string;
  assigned_to_employee_id: string;
  reminder_date: string;
  reminder_time: string;
  email: string;
  repeat_rule: string;
  remark: string;
};

function emptyForm(
  accountName = "",
  opportunityName = "",
  ownerEmployeeId = "",
): FormState {
  return {
    account_name: accountName,
    opportunity_name: opportunityName,
    subject: "",
    due_date: todayIsoDate(),
    priority: "medium",
    owner_employee_id: ownerEmployeeId,
    assigned_to_employee_id: "",
    reminder_date: todayIsoDate(),
    reminder_time: defaultTime(1),
    email: "",
    repeat_rule: "none",
    remark: "",
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
  return <FinanceField label={required ? `${label} *` : label}>{children}</FinanceField>;
}

export function TaskAssignmentFormDialog({
  open,
  onClose,
  onSaved,
  opportunityId,
  companyAccountId,
  opportunity: opportunityProp,
  company: companyProp,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (task: CrmTask) => void;
  opportunityId: string;
  companyAccountId?: string | null;
  opportunity?: Opportunity | null;
  company?: Company | null;
}) {
  const [employees, setEmployees] = useState<Option[]>([]);
  const [branchId, setBranchId] = useState(opportunityProp?.branch_id ?? "");
  const [customerId, setCustomerId] = useState<string | null>(opportunityProp?.customer_id ?? null);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(
      accountLabel(companyProp),
      opportunityLabel(opportunityProp),
      opportunityProp?.owner_employee_id ?? "",
    ),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ownerName = useMemo(
    () => employeeLabel(employees, form.owner_employee_id),
    [employees, form.owner_employee_id],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const seededAccount = accountLabel(companyProp);
    const seededOpportunity = opportunityLabel(opportunityProp);
    const seededOwnerId = opportunityProp?.owner_employee_id ?? "";
    if (seededAccount || seededOpportunity || seededOwnerId || opportunityProp) {
      setBranchId(opportunityProp?.branch_id ?? "");
      setCustomerId(opportunityProp?.customer_id ?? null);
      setForm((current) => ({
        ...emptyForm(
          seededAccount || current.account_name,
          seededOpportunity || current.opportunity_name,
          seededOwnerId || current.owner_employee_id,
        ),
        remark: current.remark,
      }));
    }

    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const accountId =
          companyAccountId || opportunityProp?.company_account_id || null;
        const [opp, company, employeeRows] = await Promise.all([
          getOpportunity(opportunityId),
          accountId
            ? getCompany(accountId).catch(() => companyProp ?? null)
            : Promise.resolve(companyProp ?? null),
          listEmployeeOptions().catch(() => [] as Option[]),
        ]);
        if (cancelled) return;

        let resolvedCompany = company;
        if (!resolvedCompany && opp.company_account_id) {
          resolvedCompany = await getCompany(opp.company_account_id).catch(() => null);
        }
        if (cancelled) return;

        setEmployees(employeeRows);
        setBranchId(opp.branch_id);
        setCustomerId(opp.customer_id);

        const ownerId =
          opp.owner_employee_id ||
          opportunityProp?.owner_employee_id ||
          employeeRows[0]?.id ||
          "";
        const assigneeId =
          employeeRows.find((row) => row.id !== ownerId)?.id ||
          employeeRows[0]?.id ||
          ownerId;
        const assigneeEmail =
          employeeRows.find((row) => row.id === assigneeId)?.email ?? "";

        setForm((current) => ({
          ...emptyForm(
            accountLabel(resolvedCompany) || current.account_name,
            opportunityLabel(opp) || current.opportunity_name,
            ownerId,
          ),
          assigned_to_employee_id: assigneeId,
          email: assigneeEmail,
          remark: current.remark,
          subject: current.subject,
          due_date: current.due_date,
          priority: current.priority,
          reminder_date: current.reminder_date,
          reminder_time: current.reminder_time,
          repeat_rule: current.repeat_rule,
        }));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiClientError ? err.message : "Failed to load task form");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, opportunityId, companyAccountId, opportunityProp, companyProp]);

  function onAssignToChange(employeeId: string) {
    const email = employees.find((row) => row.id === employeeId)?.email ?? "";
    setForm((current) => ({
      ...current,
      assigned_to_employee_id: employeeId,
      email,
    }));
  }

  async function onSubmit() {
    if (!form.account_name.trim() || !form.opportunity_name.trim()) {
      setError("Account and opportunity names could not be loaded. Close and try again.");
      return;
    }
    if (!form.subject.trim()) {
      setError("Subject is required");
      return;
    }
    if (!form.owner_employee_id) {
      setError("Owner could not be loaded for this opportunity");
      return;
    }
    if (!form.assigned_to_employee_id) {
      setError("Assign to is required");
      return;
    }
    if (!branchId) {
      setError("Opportunity branch is missing");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await createTask({
        branch_id: branchId,
        title: form.subject.trim(),
        description: form.remark.trim() || null,
        owner_employee_id: form.owner_employee_id,
        assigned_to_employee_id: form.assigned_to_employee_id,
        due_at: dueAtIso(form.due_date),
        priority: form.priority,
        opportunity_id: opportunityId,
        customer_id: customerId,
        account_name: form.account_name.trim(),
        opportunity_name: form.opportunity_name.trim(),
        reminder_date: form.reminder_date || null,
        reminder_time: form.reminder_time || null,
        email: form.email.trim() || null,
        repeat_rule: form.repeat_rule === "none" ? null : form.repeat_rule,
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-assignment-dialog-title"
        className="w-full max-w-lg rounded-xl border border-border/80 bg-card shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <h2 id="task-assignment-dialog-title" className="text-sm font-medium tracking-tight">
            Task Assignment
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
          {loading && !form.account_name && !form.opportunity_name ? (
            <p className="text-xs text-muted-foreground">Loading opportunity…</p>
          ) : null}
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldRow label="Account Name">
              <Input
                value={form.account_name}
                readOnly
                className="h-8 bg-muted/40"
                placeholder={loading ? "Loading…" : "Account name"}
              />
            </FieldRow>
            <FieldRow label="Opportunity Name">
              <Input
                value={form.opportunity_name}
                readOnly
                className="h-8 bg-muted/40"
                placeholder={loading ? "Loading…" : "Opportunity name"}
              />
            </FieldRow>
          </div>

          <FieldRow label="Subject" required>
            <Input
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="h-8"
              placeholder="What needs to be done?"
            />
          </FieldRow>

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldRow label="Due Date" required>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="h-8"
              />
            </FieldRow>
            <FieldRow label="Priority" required>
              <FinanceSelect
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    priority: e.target.value as FormState["priority"],
                  }))
                }
              >
                {PRIORITIES.map((row) => (
                  <option key={row.value} value={row.value}>
                    {row.label}
                  </option>
                ))}
              </FinanceSelect>
            </FieldRow>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldRow label="Owner Name">
              <Input
                value={ownerName || (loading ? "Loading…" : "")}
                readOnly
                className="h-8 bg-muted/40"
                placeholder="Opportunity owner"
              />
            </FieldRow>
            <FieldRow label="Assign To" required>
              <FinanceSelect
                value={form.assigned_to_employee_id}
                onChange={(e) => onAssignToChange(e.target.value)}
              >
                <option value="">Select team member</option>
                {employees.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </FinanceSelect>
            </FieldRow>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldRow label="Reminder Date">
              <Input
                type="date"
                value={form.reminder_date}
                onChange={(e) => setForm((f) => ({ ...f, reminder_date: e.target.value }))}
                className="h-8"
              />
            </FieldRow>
            <FieldRow label="Reminder Time">
              <Input
                type="time"
                value={form.reminder_time}
                onChange={(e) => setForm((f) => ({ ...f, reminder_time: e.target.value }))}
                className="h-8"
              />
            </FieldRow>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldRow label="Email Id">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="h-8"
                placeholder="assignee@company.com"
              />
            </FieldRow>
            <FieldRow label="Repeat">
              <FinanceSelect
                value={form.repeat_rule}
                onChange={(e) => setForm((f) => ({ ...f, repeat_rule: e.target.value }))}
              >
                {REPEAT_OPTIONS.map((row) => (
                  <option key={row.value} value={row.value}>
                    {row.label}
                  </option>
                ))}
              </FinanceSelect>
            </FieldRow>
          </div>

          <FieldRow label="Remark">
            <FinanceTextarea
              value={form.remark}
              onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
              rows={3}
              placeholder="Notes for the assignee…"
            />
          </FieldRow>
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
            disabled={saving || (loading && !form.owner_employee_id)}
            onClick={() => void onSubmit()}
          >
            {saving ? "Saving…" : "Assign Task"}
          </Button>
        </div>
      </div>
    </div>
  );
}
