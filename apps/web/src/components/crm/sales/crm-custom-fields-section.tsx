"use client";

import { FormInput } from "lucide-react";

import { CrmSection } from "@/components/crm/crm-ui";
import { FinanceField, FinanceSelect, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { Input } from "@/components/ui/input";
import { useCrmSettingsEffective } from "@/hooks/use-crm-settings";
import {
  catalogOptions,
  customFormFields,
  type CrmFieldConfig,
  type CrmSettingsConfig,
} from "@/services/crm-settings-service";

function formatCustomFieldDisplayValue(
  field: CrmFieldConfig,
  raw: unknown,
  settings: CrmSettingsConfig | null | undefined,
): string {
  if (raw === null || raw === undefined) return "-";
  if (field.type === "checkbox") return raw ? "Yes" : "No";
  if (field.type === "multiselect" || Array.isArray(raw)) {
    const items = Array.isArray(raw)
      ? raw
      : String(raw)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
    return items.length > 0 ? items.map(String).join(", ") : "-";
  }
  if (field.type === "select") {
    const opts = field.catalog_key
      ? catalogOptions(settings, field.catalog_key)
      : (field.options ?? []);
    const match = opts.find((o) => o.value === String(raw));
    if (match?.label) return match.label;
  }
  const text = String(raw).trim();
  return text || "-";
}

export function CrmCustomFieldsReadOnly({
  entity,
  values,
}: {
  entity: string;
  values: Record<string, unknown> | null | undefined;
}) {
  const { settings } = useCrmSettingsEffective();
  const fields = customFormFields(settings, entity);
  const data = values ?? {};
  const rows = fields
    .map((field) => {
      const raw = data[field.key];
      if (raw === null || raw === undefined || raw === "") return null;
      if (Array.isArray(raw) && raw.length === 0) return null;
      return {
        key: field.key,
        label: field.label,
        value: formatCustomFieldDisplayValue(field, raw, settings),
      };
    })
    .filter((row): row is { key: string; label: string; value: string } => row !== null);
  if (rows.length === 0) return null;

  return (
    <CrmSection title="Custom fields" icon={FormInput}>
      <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
        {rows.map((row) => (
          <FinanceField key={row.key} label={row.label}>
            <div className="flex min-h-8 w-full items-center rounded-lg border border-input bg-muted/20 px-2.5 text-sm text-foreground">
              {row.value}
            </div>
          </FinanceField>
        ))}
      </div>
    </CrmSection>
  );
}

export function CrmCustomFieldsSection({
  entity,
  values,
  onChange,
}: {
  entity: string;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const { settings } = useCrmSettingsEffective();
  const fields = customFormFields(settings, entity);
  if (fields.length === 0) return null;

  function setValue(key: string, value: unknown) {
    onChange({ ...values, [key]: value });
  }

  function renderField(field: CrmFieldConfig) {
    const value = values[field.key];
    const label = `${field.label}${field.required ? " *" : ""}`;
    const type = field.type || "text";
    if (type === "textarea") {
      return (
        <FinanceField key={field.key} label={label}>
          <FinanceTextarea
            value={String(value ?? "")}
            onChange={(e) => setValue(field.key, e.target.value)}
          />
        </FinanceField>
      );
    }
    if (type === "checkbox") {
      return (
        <label key={field.key} className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary"
            checked={Boolean(value)}
            onChange={(e) => setValue(field.key, e.target.checked)}
          />
          {label}
        </label>
      );
    }
    if (type === "select" || type === "multiselect") {
      const opts = field.catalog_key
        ? catalogOptions(settings, field.catalog_key)
        : (field.options ?? []).map((o) => ({ ...o, enabled: true }));
      if (type === "multiselect") {
        const selected = Array.isArray(value)
          ? (value as string[])
          : String(value ?? "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
        return (
          <FinanceField key={field.key} label={label}>
            <select
              multiple
              className="min-h-24 w-full cursor-pointer rounded-md border border-input bg-background px-2 py-1 text-sm"
              value={selected}
              onChange={(e) => {
                const next = Array.from(e.target.selectedOptions).map((o) => o.value);
                setValue(field.key, next);
              }}
            >
              {opts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FinanceField>
        );
      }
      return (
        <FinanceField key={field.key} label={label}>
          <FinanceSelect
            value={String(value ?? "")}
            onChange={(e) => setValue(field.key, e.target.value)}
          >
            <option value="">Select…</option>
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FinanceSelect>
        </FinanceField>
      );
    }
    const inputType =
      type === "number"
        ? "number"
        : type === "date"
          ? "date"
          : type === "email"
            ? "email"
            : type === "url"
              ? "url"
              : "text";
    return (
      <FinanceField key={field.key} label={label}>
        <Input
          type={inputType}
          value={String(value ?? "")}
          onChange={(e) =>
            setValue(
              field.key,
              inputType === "number"
                ? e.target.value === ""
                  ? ""
                  : Number(e.target.value)
                : e.target.value,
            )
          }
        />
      </FinanceField>
    );
  }

  return (
    <CrmSection title="Custom fields" icon={FormInput}>
      <div className="grid gap-3 md:grid-cols-2">{fields.map(renderField)}</div>
    </CrmSection>
  );
}
