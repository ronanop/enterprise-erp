"use client";

import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import { CloudPoDeliveryLinesEditor } from "@/components/projects/cloud-po-delivery-lines";
import {
  hasValidTypeQtyLines,
  TypeQtyLinesEditor,
} from "@/components/projects/material-type-qty-lines";
import {
  ProjectsErrorBanner,
  ProjectsPage,
  ProjectsSection,
  ProjectsPageHeader,
} from "@/components/projects/projects-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const READ_ONLY_CONTROL_CLASS =
  "disabled:pointer-events-none disabled:cursor-default disabled:opacity-100 disabled:text-foreground";
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

/** Local calendar date as `YYYY-MM-DD` for date inputs. */
export function todayISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** True when a yes/no field has an explicit Yes or No selection. */
export function answeredYesNo(value: string | undefined): boolean {
  return value === "true" || value === "false";
}

/**
 * Persist a checkpoint date when Yes or No is answered (Yes = completed,
 * No = expected). Clears the date when the answer is unset.
 */
export function dateIfAnswered(
  answer: string | undefined,
  date: string | undefined,
): string | null {
  return answeredYesNo(answer) ? orNull(date) : null;
}

/** Load yes/no from a stored boolean + optional expected/completed date. */
export function yesNoFromBoolDate(
  done: boolean,
  date: string | null | undefined,
): string {
  if (done) return "true";
  if (date) return "false";
  return "";
}

/**
 * Load yes/no for date-only checkpoints (no done flag): future date ⇒ No
 * (expected), today/past ⇒ Yes (completed).
 */
export function yesNoFromDateOnly(date: string | null | undefined): string {
  if (!date) return "";
  return date > todayISODate() ? "false" : "true";
}

function isLinkedDateField(name: string): boolean {
  return name.endsWith("_date");
}

/**
 * File picker that avoids `sr-only` + label/`htmlFor`, which scrolls the page
 * to the clipped input and leaves a blank viewport.
 */
function StageFilePicker({
  current,
  accept,
  disabled,
  onPick,
}: {
  current: string;
  accept?: string;
  disabled?: boolean;
  onPick: (fileName: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      {!disabled ? (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            tabIndex={-1}
            accept={accept}
            onChange={(e) => {
              const file = e.target.files?.[0];
              onPick(file?.name ?? "");
              // Allow re-selecting the same file name later.
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            className="h-10 w-fit shrink-0 cursor-pointer px-4"
            onClick={() => inputRef.current?.click()}
          >
            Choose file
          </Button>
        </>
      ) : null}
      <p
        className={cn(
          "min-w-0 truncate text-sm",
          current ? "font-medium text-foreground" : "text-muted-foreground",
        )}
        title={current || undefined}
      >
        {current || "No file chosen"}
      </p>
    </div>
  );
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
  | "type_qty_lines"
  | "cloud_po_lines"
  | "file";
  required?: boolean;
  /** Fixed choices (domain enums). */
  options?: { value: string; label: string }[];
  /** Choices resolved from the lookups map returned by `load`. */
  optionsKey?: string;
  placeholder?: string;
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
  /** For type_qty_lines - show per-line delivery date (default true). */
  showDate?: boolean;
  /** For type_qty_lines - lock type/qty; only dates editable (SCM). */
  datesOnly?: boolean;
  /** For cloud_po_lines - SCM / onsite receipt / installation qty tracking. */
  deliveryMode?: "scm" | "onsite" | "install";
  /** Force this control disabled even when the form is editable (reference sections). */
  readOnly?: boolean;
  /** Hide field unless predicate returns true. */
  visibleWhen?: (values: FormValues) => boolean;
  /** Clear these fields when this yesno/select/checkbox value changes. */
  clearFieldsOnChange?: string[];
  /** When the select value changes, merge extra fields (e.g. entity → state). */
  fillFieldsOnChange?: (value: string, lookups: Lookups) => Record<string, string>;
};

export type FormSection = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Desktop column count for the field grid (default 2). */
  columns?: 2 | 3;
  fields: FieldSpec[];
};

type FieldBlock =
  | { kind: "single"; field: FieldSpec }
  | { kind: "pair"; checkbox: FieldSpec; date: FieldSpec };

/** Pair checkbox/yesno + following date when the date is cleared by / tied to that field. */
function groupFieldBlocks(fields: FieldSpec[]): FieldBlock[] {
  const blocks: FieldBlock[] = [];
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const next = fields[i + 1];
    const clearsDate =
      (field.type === "checkbox" || field.type === "yesno") &&
      next?.type === "date" &&
      (field.clearFieldsOnChange ?? []).includes(next.name);
    if (clearsDate && next) {
      blocks.push({ kind: "pair", checkbox: field, date: next });
      i += 1;
      continue;
    }
    blocks.push({ kind: "single", field });
  }
  return blocks;
}

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
  readOnly = false,
  readOnlyBanner,
  headerActions,
  afterSections,
}: {
  title: string;
  description?: string;
  backHref: string;
  backLabel: string;
  submitLabel: string;
  sections: FormSection[];
  emptyValues: FormValues;
  load: () => Promise<{
    values?: FormValues;
    lookups?: Lookups;
    readOnly?: boolean;
    readOnlyBanner?: string;
  }>;
  onSave: (values: FormValues) => Promise<string>;
  /** When true, fields are disabled and save is hidden (stage owner view). */
  readOnly?: boolean;
  readOnlyBanner?: string;
  headerActions?: ReactNode;
  /** Extra content rendered below the form sections, above the save bar. */
  afterSections?: ReactNode;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [lookups, setLookups] = useState<Lookups>({});
  const [formReadOnly, setFormReadOnly] = useState(readOnly);
  const [formReadOnlyBanner, setFormReadOnlyBanner] = useState(readOnlyBanner ?? "");
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
      if (result.readOnly !== undefined && !readOnly) setFormReadOnly(result.readOnly);
      if (result.readOnlyBanner !== undefined && !readOnlyBanner)
        setFormReadOnlyBanner(result.readOnlyBanner);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load form data");
    } finally {
      setLoading(false);
    }
  }, [load, readOnly, readOnlyBanner]);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    setFormReadOnly(readOnly);
    setFormReadOnlyBanner(readOnlyBanner ?? "");
  }, [readOnly, readOnlyBanner]);

  function set(
    name: string,
    value: string,
    clearFields?: string[],
    fillFields?: Record<string, string>,
  ) {
    if (formReadOnly) return;
    setValues((v) => {
      const next = { ...v, ...fillFields, [name]: value };
      for (const key of clearFields ?? []) {
        next[key] = "";
      }
      return next;
    });
  }

  /**
   * Yes → stamp linked `*_date` fields with today (locked in UI).
   * No → clear linked dates so the expected-date picker is empty/editable;
   *      also clear any non-date linked fields (e.g. handover person).
   * Unset → clear all linked fields.
   */
  function setYesNo(field: FieldSpec, nextValue: string) {
    if (formReadOnly) return;
    const linked = field.clearFieldsOnChange ?? [];
    setValues((v) => {
      const next = { ...v, [field.name]: nextValue };
      for (const key of linked) {
        if (nextValue === "true" && isLinkedDateField(key)) {
          next[key] = todayISODate();
        } else {
          next[key] = "";
        }
      }
      return next;
    });
  }

  /** Paired date shows for both Yes and No; other gates (e.g. isServer) still apply. */
  function isPairedDateVisible(checkbox: FieldSpec, date: FieldSpec): boolean {
    const answer = values[checkbox.name];
    if (!answeredYesNo(answer)) return false;
    if (!date.visibleWhen) return true;
    return date.visibleWhen({ ...values, [checkbox.name]: "true" });
  }

  function pairedDateLabel(checkboxName: string, date: FieldSpec): string {
    if (values[checkboxName] === "false") {
      return date.label.replace(/\s*Date\s*$/i, "").trim()
        ? `Expected ${date.label.replace(/\s*Date\s*$/i, "").trim()} Date`
        : "Expected Date";
    }
    return date.label;
  }

  function isFieldVisible(field: FieldSpec): boolean {
    // Dates linked to a yes/no are visible for both Yes and No (expected date).
    if (field.type === "date") {
      for (const section of sections) {
        for (const f of section.fields) {
          if (
            f.type === "yesno" &&
            (f.clearFieldsOnChange ?? []).includes(field.name)
          ) {
            const parentVisible = f.visibleWhen ? f.visibleWhen(values) : true;
            if (!parentVisible) return false;
            if (!answeredYesNo(values[f.name])) return false;
            if (!field.visibleWhen) return true;
            return field.visibleWhen({ ...values, [f.name]: "true" });
          }
        }
      }
    }
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

  function fieldSpanClass(field: FieldSpec, columns?: 2 | 3): string | undefined {
    const spanFull =
      field.full ||
      field.type === "type_qty_lines" ||
      field.type === "cloud_po_lines" ||
      field.type === "textarea" ||
      field.type === "file";
    if (!spanFull) return undefined;
    return columns === 3 ? "sm:col-span-2 xl:col-span-3" : "sm:col-span-2";
  }

  function renderFieldControl(field: FieldSpec) {
    const controlDisabled = formReadOnly || Boolean(field.readOnly);
    if (field.type === "cloud_po_lines") {
      return (
        <CloudPoDeliveryLinesEditor
          value={values[field.name] ?? ""}
          disabled={controlDisabled}
          mode={
            field.deliveryMode === "onsite"
              ? "onsite"
              : field.deliveryMode === "install"
                ? "install"
                : "scm"
          }
          onChange={(next) => set(field.name, next)}
        />
      );
    }
    if (field.type === "type_qty_lines") {
      return (
        <TypeQtyLinesEditor
          value={values[field.name] ?? ""}
          options={optionsFor(field)}
          addLabel={field.addLabel ?? "Add type"}
          showDate={field.showDate !== false}
          datesOnly={Boolean(field.datesOnly)}
          disabled={controlDisabled}
          onChange={(next) => set(field.name, next)}
        />
      );
    }
    if (field.type === "select") {
      return (
        <FinanceSelect
          value={values[field.name] ?? ""}
          disabled={formReadOnly}
          className={cn(formReadOnly && READ_ONLY_CONTROL_CLASS)}
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
      );
    }
    if (field.type === "textarea") {
      return (
        <FinanceTextarea
          value={values[field.name] ?? ""}
          placeholder={field.placeholder}
          disabled={formReadOnly}
          className={cn(formReadOnly && READ_ONLY_CONTROL_CLASS)}
          onChange={(e) => set(field.name, e.target.value)}
        />
      );
    }
    if (field.type === "readonly") {
      if (field.full) {
        return (
          <FinanceTextarea
            className="min-w-0 w-full"
            value={values[field.name] ?? ""}
            disabled
            aria-readonly="true"
            rows={3}
          />
        );
      }
      return (
        <Input
          className="min-w-0 w-full"
          value={values[field.name] ?? ""}
          disabled
          aria-readonly="true"
        />
      );
    }
    if (field.type === "file") {
      const current = (values[field.name] ?? "").trim();
      return (
        <StageFilePicker
          current={current}
          accept={field.placeholder || undefined}
          disabled={formReadOnly}
          onPick={(fileName) => set(field.name, fileName)}
        />
      );
    }
    if (field.type === "yesno") {
      return (
        <div
          className={cn(
            "flex flex-wrap items-center gap-4 text-sm text-foreground",
            formReadOnly && "pointer-events-none",
          )}
        >
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="size-4 cursor-pointer rounded border border-input accent-[var(--color-accent,#0369A1)]"
              checked={values[field.name] === "true"}
              disabled={formReadOnly}
              onChange={() =>
                setYesNo(field, values[field.name] === "true" ? "" : "true")
              }
            />
            <span>Yes</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="size-4 cursor-pointer rounded border border-input accent-[var(--color-accent,#0369A1)]"
              checked={values[field.name] === "false"}
              disabled={formReadOnly}
              onChange={() =>
                setYesNo(field, values[field.name] === "false" ? "" : "false")
              }
            />
            <span>No</span>
          </label>
        </div>
      );
    }
    if (field.type === "checkbox") {
      return (
        <label
          className={cn(
            "flex min-h-10 w-full items-start gap-3 rounded-lg border border-border/80 bg-muted/25 px-3 py-2.5 text-sm text-foreground transition-colors duration-200",
            formReadOnly ? "cursor-default" : "cursor-pointer hover:bg-muted/40",
          )}
        >
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border border-input accent-[var(--color-accent,#0369A1)]"
            checked={values[field.name] === "true"}
            disabled={formReadOnly}
            onChange={(e) =>
              set(
                field.name,
                e.target.checked ? "true" : "false",
                field.clearFieldsOnChange,
              )
            }
          />
          <span className="min-w-0 leading-snug">{field.placeholder ?? "Yes"}</span>
        </label>
      );
    }
    if (field.type === "date") {
      return (
        <Input
          className={cn(
            "min-w-0 cursor-pointer",
            formReadOnly && READ_ONLY_CONTROL_CLASS,
          )}
          type="date"
          value={values[field.name] ?? ""}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          disabled={formReadOnly}
          onChange={(e) => set(field.name, e.target.value)}
        />
      );
    }
    return (
      <Input
        className={cn("min-w-0 w-full", formReadOnly && READ_ONLY_CONTROL_CLASS)}
        type={field.type}
        value={values[field.name] ?? ""}
        placeholder={field.placeholder}
        step={field.step}
        min={field.min}
        max={field.max}
        disabled={formReadOnly}
        onChange={(e) => set(field.name, e.target.value)}
      />
    );
  }

  function renderField(
    field: FieldSpec,
    className?: string,
    opts?: { labelOverride?: string; forceReadOnly?: boolean },
  ) {
    const label = opts?.labelOverride ?? field.label;
    const controlField =
      opts?.forceReadOnly && field.type === "date"
        ? { ...field }
        : field;
    return (
      <FinanceField
        key={field.name}
        label={isFieldRequired(field) ? `${label} *` : label}
        className={cn("min-w-0", className)}
      >
        {opts?.forceReadOnly && field.type === "date" ? (
          <Input
            className={cn("min-w-0 cursor-default", READ_ONLY_CONTROL_CLASS)}
            type="date"
            value={values[field.name] ?? ""}
            disabled
            readOnly
            aria-readonly="true"
          />
        ) : (
          renderFieldControl(controlField)
        )}
      </FinanceField>
    );
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
    if (formReadOnly) return;
    if (field.creatable === "customer" && value === NEW_CUSTOMER_VALUE) {
      openCustomerDialog(field.name);
      return;
    }
    const filled = field.fillFieldsOnChange?.(value, lookups) ?? {};
    set(field.name, value, field.clearFieldsOnChange, filled);
  }

  async function saveCustomerDialog() {
    const name = customerDraftName.trim();
    if (!name) {
      setCustomerDialogError("Customer name is required.");
      return;
    }
    const branchId = (values.branch_id ?? "").trim();
    if (!branchId) {
      setCustomerDialogError("Select an office branch context before creating a customer.");
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
    if (formReadOnly) return;
    const missing = sections
      .flatMap((s) => s.fields)
      .filter((f) => {
        if (!isFieldRequired(f) || f.type === "readonly") return false;
        if (f.type === "checkbox") return values[f.name] !== "true";
        if (f.type === "yesno") return values[f.name] !== "true" && values[f.name] !== "false";
        if (f.type === "type_qty_lines") {
          return !hasValidTypeQtyLines(values[f.name], {
            requireDate: f.showDate !== false,
          });
        }
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

      <ProjectsPageHeader title={title} description={description} actions={headerActions} />

      {error ? <ProjectsErrorBanner>{error}</ProjectsErrorBanner> : null}

      <div
        className={cn(
          "space-y-5",
          formReadOnly &&
          "[&_input:disabled]:pointer-events-none [&_input:disabled]:cursor-default [&_input:disabled]:opacity-100 [&_input:disabled]:text-foreground [&_select:disabled]:pointer-events-none [&_select:disabled]:cursor-default [&_select:disabled]:opacity-100 [&_select:disabled]:text-foreground [&_textarea:disabled]:pointer-events-none [&_textarea:disabled]:cursor-default [&_textarea:disabled]:opacity-100 [&_textarea:disabled]:text-foreground",
        )}
      >
        {sections.map((section) => (
          <ProjectsSection
            key={section.title}
            title={section.title}
            subtitle={section.subtitle}
            icon={section.icon}
            bodyClassName="min-w-0"
          >
            <div
              className={cn(
                "grid min-w-0 grid-cols-1 items-start gap-x-8 gap-y-5",
                section.columns === 3
                  ? "sm:grid-cols-2 xl:grid-cols-3"
                  : "sm:grid-cols-2",
              )}
            >
              {groupFieldBlocks(section.fields).map((block) => {
                if (block.kind === "pair") {
                  if (!isFieldVisible(block.checkbox)) return null;
                  const answer = values[block.checkbox.name];
                  const dateVisible = isPairedDateVisible(block.checkbox, block.date);
                  return (
                    <div
                      key={block.checkbox.name}
                      className={cn(
                        "grid min-w-0 grid-cols-1 items-start gap-x-8 gap-y-5",
                        // Always reserve full row width so checkboxes stay in the left column;
                        // date appears in the right column when Yes (today, locked) or No (expected).
                        section.columns === 3
                          ? "sm:col-span-2 xl:col-span-3 sm:grid-cols-2"
                          : "sm:col-span-2 sm:grid-cols-2",
                      )}
                    >
                      {renderField(block.checkbox)}
                      {dateVisible ? (
                        renderField(block.date, undefined, {
                          labelOverride: pairedDateLabel(block.checkbox.name, block.date),
                          forceReadOnly: answer === "true",
                        })
                      ) : (
                        <div className="hidden sm:block" aria-hidden="true" />
                      )}
                    </div>
                  );
                }
                if (!isFieldVisible(block.field)) return null;
                return renderField(block.field, fieldSpanClass(block.field, section.columns));
              })}
            </div>
          </ProjectsSection>
        ))}
      </div>

      {afterSections}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => router.push(backHref)}
          disabled={saving}
        >
          {formReadOnly ? backLabel : "Cancel"}
        </Button>
        {!formReadOnly ? (
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? "Saving…" : submitLabel}
          </Button>
        ) : null}
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
