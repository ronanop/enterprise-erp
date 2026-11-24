"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CRM_FIELD_TYPES,
  type CrmFieldConfig,
  type CrmFieldType,
} from "@/services/crm-settings-service";

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function CrmFormFieldBuilder({
  fields,
  catalogKeys,
  onChange,
}: {
  fields: CrmFieldConfig[];
  catalogKeys: string[];
  onChange: (next: CrmFieldConfig[]) => void;
}) {
  const ordered = fields.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  function update(key: string, patch: Partial<CrmFieldConfig>) {
    onChange(fields.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function addCustomField() {
    const base = `cf_field_${fields.length + 1}`;
    let key = base;
    let n = 1;
    const existing = new Set(fields.map((f) => f.key));
    while (existing.has(key)) {
      n += 1;
      key = `${base}_${n}`;
    }
    onChange([
      ...fields,
      {
        key,
        label: "New field",
        type: "text",
        source: "custom",
        visible: true,
        required: false,
        order: fields.length,
      },
    ]);
  }

  function removeCustom(key: string) {
    onChange(fields.filter((f) => f.key !== key));
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={addCustomField}>
          <Plus className="size-3.5" />
          Add field
        </Button>
      </div>
      {ordered.map((field, idx) => {
        const isCustom = field.source === "custom" || field.key.startsWith("cf_");
        return (
          <div
            key={field.key}
            className="space-y-2 rounded-lg border border-border/70 bg-card px-3 py-2.5"
          >
            <div className="grid gap-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_8rem_auto]">
              <Input
                className="h-8"
                value={field.label}
                onChange={(e) => {
                  const label = e.target.value;
                  if (isCustom) {
                    update(field.key, {
                      label,
                      key: `cf_${slugify(label) || field.key.replace(/^cf_/, "")}`,
                    });
                  } else {
                    update(field.key, { label });
                  }
                }}
                aria-label="Field label"
              />
              <select
                className="h-8 cursor-pointer rounded-md border border-input bg-background px-2 text-sm"
                value={(field.type as string) || "text"}
                onChange={(e) => update(field.key, { type: e.target.value as CrmFieldType })}
                aria-label="Field type"
              >
                {CRM_FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                className="h-8"
                value={field.order ?? idx}
                onChange={(e) =>
                  update(field.key, {
                    order: Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0,
                  })
                }
                aria-label="Order"
              />
              {isCustom ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 cursor-pointer text-destructive"
                  onClick={() => removeCustom(field.key)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : (
                <span className="self-center text-[11px] text-muted-foreground">Stock</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={field.visible !== false}
                  onChange={(e) => update(field.key, { visible: e.target.checked })}
                />
                Visible
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={Boolean(field.required)}
                  onChange={(e) => update(field.key, { required: e.target.checked })}
                />
                Required
              </label>
              {(field.type === "select" || field.type === "multiselect") && (
                <select
                  className="h-7 cursor-pointer rounded-md border border-input bg-background px-2 text-xs"
                  value={field.catalog_key ?? ""}
                  onChange={(e) =>
                    update(field.key, { catalog_key: e.target.value || null })
                  }
                  aria-label="Catalog"
                >
                  <option value="">Inline options</option>
                  {catalogKeys.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              )}
              <span className="font-mono text-[10px] text-muted-foreground">{field.key}</span>
            </div>
            {(field.type === "select" || field.type === "multiselect") && !field.catalog_key ? (
              <Input
                className="h-8 text-xs"
                placeholder="Options as value:Label;value:Label"
                value={(field.options ?? []).map((o) => `${o.value}:${o.label}`).join(";")}
                onChange={(e) => {
                  const options = e.target.value
                    .split(";")
                    .map((part) => part.trim())
                    .filter(Boolean)
                    .map((part) => {
                      const [value, ...rest] = part.split(":");
                      const label = rest.join(":") || value;
                      return { value: value.trim(), label: label.trim() };
                    });
                  update(field.key, { options });
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
