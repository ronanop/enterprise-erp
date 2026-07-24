"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import {
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
  createMeeting,
  listBranchOptions,
  listCompanies,
  listEmployeeOptions,
  type Company,
  type CrmMeeting,
  type MeetingFormInput,
  type Option,
} from "@/services/sales-crm-service";
import { cn } from "@/lib/utils";

const VENUES = [
  { value: "client_location", label: "Client location" },
  { value: "office", label: "Office" },
  { value: "online", label: "Online" },
  { value: "phone", label: "Phone" },
] as const;

const RELATED_TO = [
  { value: "others", label: "Others" },
  { value: "leads", label: "Leads" },
  { value: "contacts", label: "Contacts" },
  { value: "opportunities", label: "Opportunities" },
] as const;

const REPEAT_OPTIONS = [
  { value: "none", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

const REMINDER_OPTIONS = [
  { value: "none", label: "None" },
  { value: "at_time", label: "At time of event" },
  { value: "5_minutes", label: "5 minutes before" },
  { value: "10_minutes", label: "10 minutes before" },
  { value: "15_minutes", label: "15 minutes before" },
  { value: "30_minutes", label: "30 minutes before" },
  { value: "1_hour", label: "1 hour before" },
  { value: "1_day", label: "1 day before" },
] as const;

const PARTICIPANT_REMINDER_OPTIONS = [
  { value: "none", label: "None" },
  { value: "email", label: "Email" },
  { value: "popup", label: "Popup" },
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

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (meeting: CrmMeeting) => void;
  /** Prefill Account when opened from a company detail page. */
  companyAccount?: Company | null;
  defaultBranchId?: string | null;
};

type FormState = {
  branch_id: string;
  title: string;
  meeting_mode: string;
  location: string;
  all_day: boolean;
  meeting_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  organizer_employee_id: string;
  tagged_employee_id: string;
  participants_text: string;
  related_to: string;
  repeat_rule: string;
  participants_reminder: string;
  company_account_id: string;
  notes: string;
  reminder_primary: string;
  reminder_secondary: string;
};

function emptyForm(branchId = "", accountId = "", hostId = ""): FormState {
  const date = todayIsoDate();
  return {
    branch_id: branchId,
    title: "New Meeting",
    meeting_mode: "client_location",
    location: "",
    all_day: false,
    meeting_date: date,
    start_time: defaultTime(1),
    end_date: date,
    end_time: defaultTime(2),
    organizer_employee_id: hostId,
    tagged_employee_id: "",
    participants_text: "",
    related_to: "others",
    repeat_rule: "none",
    participants_reminder: "none",
    company_account_id: accountId,
    notes: "",
    reminder_primary: "15_minutes",
    reminder_secondary: "none",
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
    <div className="grid grid-cols-[140px_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
      <span
        className={cn(
          "pt-2 text-xs text-muted-foreground",
          required && "after:ml-0.5 after:text-destructive after:content-['*']",
        )}
      >
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function underlineInputClass(invalid?: boolean) {
  return cn(
    "h-9 w-full rounded-none border-0 border-b bg-transparent px-0 text-sm shadow-none",
    "focus-visible:border-primary focus-visible:ring-0",
    invalid ? "border-destructive" : "border-border",
  );
}

export function MeetingFormDialog({
  open,
  onClose,
  onSaved,
  companyAccount,
  defaultBranchId,
}: Props) {
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [employees, setEmployees] = useState<Option[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [accountQuery, setAccountQuery] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTouched(false);
    setAccountQuery("");
    setAccountOpen(false);

    void Promise.all([
      listBranchOptions(),
      listEmployeeOptions(),
      listCompanies().catch(() => [] as Company[]),
    ]).then(([branches, employeeOptions, companyRows]) => {
      setEmployees(employeeOptions);
      setCompanies(companyRows);
      const branchId = companyAccount?.branch_id || defaultBranchId || branches[0]?.id || "";
      const hostId = companyAccount?.account_owner_id || employeeOptions[0]?.id || "";
      setForm(
        emptyForm(branchId, companyAccount?.id ?? "", hostId),
      );
    });
  }, [open, companyAccount, defaultBranchId]);

  const selectedAccount = useMemo(
    () => companies.find((c) => c.id === form.company_account_id) ?? companyAccount ?? null,
    [companies, form.company_account_id, companyAccount],
  );

  const filteredAccounts = useMemo(() => {
    const q = accountQuery.trim().toLowerCase();
    if (!q) return companies.slice(0, 8);
    return companies
      .filter(
        (c) =>
          c.customer_name.toLowerCase().includes(q) ||
          c.account_number.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [accountQuery, companies]);

  if (!open) return null;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const titleInvalid = touched && !form.title.trim();
  const venueInvalid = touched && !form.meeting_mode;
  const fromInvalid = touched && !form.meeting_date;
  const toInvalid = touched && !form.end_date;
  const accountInvalid = touched && !form.company_account_id;

  async function save() {
    setTouched(true);
    const missing: string[] = [];
    if (!form.title.trim()) missing.push("Title");
    if (!form.meeting_mode) missing.push("Meeting Venue");
    if (!form.meeting_date) missing.push("From");
    if (!form.end_date) missing.push("To");
    if (!form.company_account_id) missing.push("Account");
    if (!form.organizer_employee_id) missing.push("Host");
    if (!form.branch_id) missing.push("Branch");
    if (missing.length > 0) {
      setMandateMessage(missingRequiredMessage(missing));
      setMandateOpen(true);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const toApiTime = (value: string) =>
        value ? (value.length === 5 ? `${value}:00` : value) : null;
      const payload: MeetingFormInput = {
        branch_id: form.branch_id,
        title: form.title.trim(),
        meeting_date: form.meeting_date,
        end_date: form.end_date || form.meeting_date,
        start_time: form.all_day ? null : toApiTime(form.start_time),
        end_time: form.all_day ? null : toApiTime(form.end_time),
        all_day: form.all_day,
        location: form.location.trim() || null,
        meeting_mode: form.meeting_mode,
        related_to: form.related_to || "others",
        repeat_rule: form.repeat_rule || "none",
        participants_reminder: form.participants_reminder || "none",
        reminder_primary: form.reminder_primary || "none",
        reminder_secondary: form.reminder_secondary || "none",
        company_account_id: form.company_account_id,
        organizer_employee_id: form.organizer_employee_id,
        tagged_employee_id: form.tagged_employee_id || null,
        participants_text: form.participants_text.trim() || null,
        notes: form.notes.trim() || null,
      };
      const saved = await createMeeting(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? `${err.message}${err.errors.length ? `: ${err.errors.join(", ")}` : ""}`
          : "Failed to save meeting",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-information-title"
        className="erp-scroll flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border/70 px-5 py-4">
          <h2 id="meeting-information-title" className="text-base font-semibold tracking-tight text-foreground">
            Meeting Information
          </h2>
        </div>

        <div className="erp-scroll space-y-4 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <FieldRow label="Title" required>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className={underlineInputClass(titleInvalid)}
              aria-invalid={titleInvalid}
            />
          </FieldRow>

          <FieldRow label="Meeting Venue" required>
            <FinanceSelect
              value={form.meeting_mode}
              onChange={(e) => set("meeting_mode", e.target.value)}
              className={cn(
                "h-9 rounded-none border-0 border-b px-0 shadow-none focus-visible:border-primary focus-visible:ring-0",
                venueInvalid ? "border-destructive" : "border-border",
              )}
              aria-invalid={venueInvalid}
            >
              {VENUES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </FinanceSelect>
          </FieldRow>

          <FieldRow label="Location">
            <Input
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              className={underlineInputClass()}
              placeholder="Add location"
            />
          </FieldRow>

          <FieldRow label="All day">
            <label className="inline-flex cursor-pointer items-center gap-2 pt-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.all_day}
                onChange={(e) => set("all_day", e.target.checked)}
                className="size-4 cursor-pointer rounded border-input accent-primary"
              />
              <span className="sr-only">All day</span>
            </label>
          </FieldRow>

          <FieldRow label="From" required>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={form.meeting_date}
                onChange={(e) => {
                  set("meeting_date", e.target.value);
                  if (!form.end_date || form.end_date < e.target.value) {
                    set("end_date", e.target.value);
                  }
                }}
                className={underlineInputClass(fromInvalid)}
                aria-invalid={fromInvalid}
              />
              {!form.all_day ? (
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => set("start_time", e.target.value)}
                  className={underlineInputClass(fromInvalid)}
                />
              ) : null}
            </div>
          </FieldRow>

          <FieldRow label="To" required>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => set("end_date", e.target.value)}
                className={underlineInputClass(toInvalid)}
                aria-invalid={toInvalid}
              />
              {!form.all_day ? (
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => set("end_time", e.target.value)}
                  className={underlineInputClass(toInvalid)}
                />
              ) : null}
            </div>
          </FieldRow>

          <FieldRow label="Host">
            <FinanceSelect
              value={form.organizer_employee_id}
              onChange={(e) => set("organizer_employee_id", e.target.value)}
              className="h-9 rounded-none border-0 border-b border-border px-0 shadow-none focus-visible:border-primary focus-visible:ring-0"
            >
              <option value="">Select host</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </FinanceSelect>
          </FieldRow>

          <FieldRow label="Tag Internal Member">
            <FinanceSelect
              value={form.tagged_employee_id}
              onChange={(e) => set("tagged_employee_id", e.target.value)}
              className="h-9 rounded-none border-0 border-b border-border px-0 shadow-none focus-visible:border-primary focus-visible:ring-0"
            >
              <option value="">None</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </FinanceSelect>
          </FieldRow>

          <FieldRow label="Participants">
            <div className="space-y-2">
              <Input
                value={form.participants_text}
                onChange={(e) => set("participants_text", e.target.value)}
                className={underlineInputClass()}
                placeholder="Type participant names"
              />
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
                onClick={() => {
                  const next = form.participants_text.trim()
                    ? `${form.participants_text.trim()}, `
                    : "";
                  set("participants_text", next);
                }}
              >
                <Plus className="size-3.5" /> Add
              </button>
            </div>
          </FieldRow>

          <FieldRow label="Related To">
            <FinanceSelect
              value={form.related_to}
              onChange={(e) => set("related_to", e.target.value)}
              className="h-9 rounded-none border-0 border-b border-border px-0 shadow-none focus-visible:border-primary focus-visible:ring-0"
            >
              {RELATED_TO.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </FinanceSelect>
          </FieldRow>

          <FieldRow label="Repeat">
            <FinanceSelect
              value={form.repeat_rule}
              onChange={(e) => set("repeat_rule", e.target.value)}
              className="h-9 rounded-none border-0 border-b border-border px-0 shadow-none focus-visible:border-primary focus-visible:ring-0"
            >
              {REPEAT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </FinanceSelect>
          </FieldRow>

          <FieldRow label="Participants Reminder">
            <FinanceSelect
              value={form.participants_reminder}
              onChange={(e) => set("participants_reminder", e.target.value)}
              className="h-9 rounded-none border-0 border-b border-border px-0 shadow-none focus-visible:border-primary focus-visible:ring-0"
            >
              {PARTICIPANT_REMINDER_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </FinanceSelect>
          </FieldRow>

          <FieldRow label="Account" required>
            <div className="relative">
              <div
                className={cn(
                  "flex items-center gap-2 border-b pb-1",
                  accountInvalid ? "border-destructive" : "border-border",
                )}
              >
                <Input
                  value={accountOpen ? accountQuery : selectedAccount?.customer_name ?? ""}
                  onChange={(e) => {
                    setAccountQuery(e.target.value);
                    setAccountOpen(true);
                  }}
                  onFocus={() => {
                    setAccountOpen(true);
                    setAccountQuery(selectedAccount?.customer_name ?? "");
                  }}
                  className="h-8 flex-1 rounded-none border-0 px-0 shadow-none focus-visible:ring-0"
                  placeholder="Search account"
                  aria-invalid={accountInvalid}
                />
                <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </div>
              {accountOpen ? (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border/80 bg-card py-1 shadow-md">
                  {filteredAccounts.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-muted-foreground">No accounts found</li>
                  ) : (
                    filteredAccounts.map((account) => (
                      <li key={account.id}>
                        <button
                          type="button"
                          className="flex w-full cursor-pointer flex-col items-start px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-muted/60"
                          onClick={() => {
                            set("company_account_id", account.id);
                            if (!form.branch_id) set("branch_id", account.branch_id);
                            setAccountOpen(false);
                            setAccountQuery("");
                          }}
                        >
                          <span className="font-medium text-foreground">{account.customer_name}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {account.account_number}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>
          </FieldRow>

          <FieldRow label="Description">
            <FinanceTextarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="min-h-[88px] rounded-md"
              rows={4}
            />
          </FieldRow>

          <FieldRow label="Reminder">
            <div className="space-y-2">
              <FinanceSelect
                value={form.reminder_primary}
                onChange={(e) => set("reminder_primary", e.target.value)}
                className="h-9 rounded-none border-0 border-b border-border px-0 shadow-none focus-visible:border-primary focus-visible:ring-0"
              >
                {REMINDER_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </FinanceSelect>
              <FinanceSelect
                value={form.reminder_secondary}
                onChange={(e) => set("reminder_secondary", e.target.value)}
                className="h-9 rounded-none border-0 border-b border-border px-0 shadow-none focus-visible:border-primary focus-visible:ring-0"
              >
                {REMINDER_OPTIONS.map((item) => (
                  <option key={`sec-${item.value}`} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </FinanceSelect>
            </div>
          </FieldRow>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/70 px-5 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
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
