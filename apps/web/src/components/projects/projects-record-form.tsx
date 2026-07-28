"use client";

import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  missingRequiredMessage,
  RequiredFieldsDialog,
} from "@/components/crm/sales/required-fields-dialog";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import {
  FinanceField,
  FinanceSelect,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import {
  hasValidTypeQtyLines,
  TypeQtyLinesEditor,
} from "@/components/projects/material-type-qty-lines";
import {
  ProjectsErrorBanner,
  ProjectsPage,
  ProjectsSection,
} from "@/components/projects/projects-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  createCustomer,
  type Option,
} from "@/services/projects-portal-service";

export type FormValues = Record<string, string>;
export type Lookups = Record<string, Option[]>;

const NEW_CUSTOMER_VALUE = "__new_customer__";

const DEMO_CUSTOMER_SUGGESTIONS = ["Airtel", "Jio", "Vodafone Idea", "BSNL"] as const;

/** Empty form inputs become `null` so the API clears the column instead of failing. */
export function orNull(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

export function intOrNull(value: string | undefined): number | null {
  const trimmed = (value ?? "").trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export type FieldSpec = {
  name: string;
  label: string;
  type:
  | "text"
  | "number"
  | "date"
  | "select"
  | "textarea"
  | "readonly"
  | "checkbox"
  | "yesno"
  | "type_qty_lines";
  required?: boolean;
  /** Fixed choices (domain enums). */
  options?: { value: string; label: string }[];
  /** Choices resolved from the lookups map returned by `load`. */
  optionsKey?: string;
  placeholder?: string;
  hint?: string;
  step?: string;
  min?: string;
  max?: string;
  /** Span both columns of the section grid. */
  full?: boolean;
  /**
   * OEM-style create-new for master lookups.
   * Currently supports `customer` (POST /customers).
   */
  creatable?: "customer";
  createNewLabel?: string;
  /** Label for the Add row button on type_qty_lines fields. */
  addLabel?: string;
  /** Hide field unless predicate returns true. */
  visibleWhen?: (values: FormValues) => boolean;
  /** Clear these fields when this yesno/select/checkbox value changes. */
  clearFieldsOnChange?: string[];
};

export type FormSection = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  fields: FieldSpec[];
};

/**
 * Shared create/edit shell for Projects records. Values are held as strings and
 * handed back to the caller, which owns the typed payload conversion.
 */
export function ProjectsRecordForm({
  title,
  description,
  backHref,
  backLabel,
  submitLabel,
  sections,
  emptyValues,
  load,
  onSave,
}: {
  title: string;
  description?: string;
  backHref: string;
  backLabel: string;
  submitLabel: string;
  sections: FormSection[];
  emptyValues: FormValues;
  load: () => Promise<{ values?: FormValues; lookups?: Lookups }>;
  onSave: (values: FormValues) => Promise<string>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [lookups, setLookups] = useState<Lookups>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");

  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerDraftName, setCustomerDraftName] = useState("");
  const [customerDraftEmail, setCustomerDraftEmail] = useState("");
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerDialogError, setCustomerDialogError] = useState<string | null>(null);
  const [customerFieldName, setCustomerFieldName] = useState("customer_id");

  const boot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await load();
      setLookups(result.lookups ?? {});
      if (result.values) setValues((v) => ({ ...v, ...result.values }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load form data");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void boot();
  }, [boot]);

  function set(name: string, value: string, clearFields?: string[]) {
    setValues((v) => {
      const next = { ...v, [name]: value };
      for (const key of clearFields ?? []) {
        next[key] = "";
      }
      return next;
    });
  }

  function isFieldVisible(field: FieldSpec): boolean {
    return field.visibleWhen ? field.visibleWhen(values) : true;
  }

  function isFieldRequired(field: FieldSpec): boolean {
    return Boolean(field.required) && isFieldVisible(field);
  }

  function optionsFor(field: FieldSpec): { value: string; label: string }[] {
    if (field.options) return field.options;
    if (field.optionsKey) {
      return (lookups[field.optionsKey] ?? []).map((o) => ({ value: o.id, label: o.label }));
    }
    return [];
  }

  function openCustomerDialog(fieldName: string) {
    setCustomerFieldName(fieldName);
    setCustomerDraftName("");
    setCustomerDraftEmail("");
    setCustomerDialogError(null);
    setCustomerDialogOpen(true);
  }

  function closeCustomerDialog() {
    setCustomerDialogOpen(false);
    setCustomerDraftName("");
    setCustomerDraftEmail("");
    setCustomerDialogError(null);
  }

  function onSelectChange(field: FieldSpec, value: string) {
    if (field.creatable === "customer" && value === NEW_CUSTOMER_VALUE) {
      openCustomerDialog(field.name);
      return;
    }
    set(field.name, value, field.clearFieldsOnChange);
  }

  async function saveCustomerDialog() {
    const name = customerDraftName.trim();
    if (!name) {
      setCustomerDialogError("Customer name is required.");
      return;
    }
    const branchId = (values.branch_id ?? "").trim();
    if (!branchId) {
      setCustomerDialogError("Select a Branch on the form before creating a customer.");
      return;
    }

    setCustomerSaving(true);
    setCustomerDialogError(null);
    try {
      const created = await createCustomer({
        branch_id: branchId,
        customer_name: name,
        customer_type: "corporate",
        email: customerDraftEmail.trim() || null,
      });
      setLookups((prev) => {
        const current = prev.customers ?? [];
        const next = [
          ...current.filter((c) => c.id !== created.id),
          { id: created.id, label: created.customer_name },
        ].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
        return { ...prev, customers: next };
      });
      set(customerFieldName, created.id);
      closeCustomerDialog();
    } catch (err) {
      setCustomerDialogError(
        err instanceof ApiClientError
          ? `${err.message}${err.errors.length ? `: ${err.errors.join(", ")}` : ""}`
          : err instanceof Error
            ? err.message
            : "Failed to create customer",
      );
    } finally {
      setCustomerSaving(false);
    }
  }

  async function save() {
    const missing = sections
      .flatMap((s) => s.fields)
      .filter((f) => {
        if (!isFieldRequired(f) || f.type === "readonly") return false;
        if (f.type === "checkbox") return values[f.name] !== "true";
        if (f.type === "yesno") return values[f.name] !== "true" && values[f.name] !== "false";
        if (f.type === "type_qty_lines") return !hasValidTypeQtyLines(values[f.name]);
        return !(values[f.name] ?? "").trim();
      })
      .map((f) => f.label);

    if (missing.length > 0) {
      setMandateMessage(missingRequiredMessage(missing));
      setMandateOpen(true);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const href = await onSave(values);
      router.push(href);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? `${err.message}${err.errors.length ? `: ${err.errors.join(", ")}` : ""}`
          : err instanceof Error
            ? err.message
            : "Failed to save record",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return (
    <ProjectsPage>
      <Link
        href={backHref}
        className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {backLabel}
      </Link>

      <PageHeader title={title} description={description} />

      {error ? <ProjectsErrorBanner>{error}</ProjectsErrorBanner> : null}

      {sections.map((section) => (
        <ProjectsSection
          key={section.title}
          title={section.title}
          subtitle={section.subtitle}
          icon={section.icon}
        >
          <div className="grid items-start gap-x-10 gap-y-3 md:grid-cols-2">
            {section.fields.filter(isFieldVisible).map((field) => (
              <FinanceField
                key={field.name}
                label={isFieldRequired(field) ? `${field.label} *` : field.label}
                hint={field.hint}
                className={field.full || field.type === "type_qty_lines" ? "md:col-span-2" : undefined}
              >
                {field.type === "type_qty_lines" ? (
                  <TypeQtyLinesEditor
                    value={values[field.name] ?? ""}
                    options={optionsFor(field)}
                    addLabel={field.addLabel ?? "Add type"}
                    onChange={(next) => set(field.name, next)}
                  />
                ) : field.type === "select" ? (
                  <FinanceSelect
                    value={values[field.name] ?? ""}
                    onChange={(e) => onSelectChange(field, e.target.value)}
                  >
                    <option value="">{field.placeholder ?? "Select…"}</option>
                    {optionsFor(field).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                    {field.creatable === "customer" ? (
                      <option value={NEW_CUSTOMER_VALUE}>
                        {field.createNewLabel ?? "New Customer"}
                      </option>
                    ) : null}
                  </FinanceSelect>
                ) : field.type === "textarea" ? (
                  <FinanceTextarea
                    value={values[field.name] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(e) => set(field.name, e.target.value)}
                  />
                ) : field.type === "readonly" ? (
                  <Input value={values[field.name] ?? ""} disabled aria-readonly="true" />
                ) : field.type === "yesno" ? (
                  <div className="flex flex-wrap items-center gap-4 text-sm text-foreground">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer rounded border border-input accent-[var(--color-accent,#0369A1)]"
                        checked={values[field.name] === "true"}
                        onChange={() =>
                          set(field.name, "true", field.clearFieldsOnChange)
                        }
                      />
                      <span>Yes</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer rounded border border-input accent-[var(--color-accent,#0369A1)]"
                        checked={values[field.name] === "false"}
                        onChange={() =>
                          set(field.name, "false", field.clearFieldsOnChange)
                        }
                      />
                      <span>No</span>
                    </label>
                  </div>
                ) : field.type === "checkbox" ? (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer rounded border border-input accent-[var(--color-accent,#0369A1)]"
                      checked={values[field.name] === "true"}
                      onChange={(e) =>
                        set(
                          field.name,
                          e.target.checked ? "true" : "false",
                          field.clearFieldsOnChange,
                        )
                      }
                    />
                    <span>{field.placeholder ?? "Yes"}</span>
                  </label>
                ) : (
                  <Input
                    type={field.type}
                    value={values[field.name] ?? ""}
                    placeholder={field.placeholder}
                    step={field.step}
                    min={field.min}
                    max={field.max}
                    onChange={(e) => set(field.name, e.target.value)}
                  />
                )}
              </FinanceField>
            ))}
          </div>
        </ProjectsSection>
      ))}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => router.push(backHref)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="cursor-pointer"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>

      <ConfirmDialog
        open={customerDialogOpen}
        title="New Customer"
        description="Save this customer to Master Data. It will appear in the Customer dropdown."
        confirmLabel="Save Customer"
        cancelLabel="Cancel"
        busy={customerSaving}
        onConfirm={() => void saveCustomerDialog()}
        onCancel={closeCustomerDialog}
      >
        <div className="mt-3 space-y-3">
          {customerDialogError ? (
            <p className="text-xs text-destructive" role="alert">
              {customerDialogError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {DEMO_CUSTOMER_SUGGESTIONS.map((name) => (
              <button
                key={name}
                type="button"
                className="cursor-pointer rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-[11px] font-medium transition-colors duration-200 hover:bg-muted"
                onClick={() => setCustomerDraftName(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <FinanceField label="Customer Name *">
            <Input
              value={customerDraftName}
              onChange={(e) => setCustomerDraftName(e.target.value)}
              placeholder="e.g. Airtel"
              autoFocus
            />
          </FinanceField>
          <FinanceField label="Email">
            <Input
              type="email"
              value={customerDraftEmail}
              onChange={(e) => setCustomerDraftEmail(e.target.value)}
              placeholder="Optional"
            />
          </FinanceField>
        </div>
      </ConfirmDialog>

      <RequiredFieldsDialog
        open={mandateOpen}
        message={mandateMessage}
        onClose={() => setMandateOpen(false)}
      />
    </ProjectsPage>
  );
}
