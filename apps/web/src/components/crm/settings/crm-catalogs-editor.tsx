"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CrmCatalogConfig, CrmCatalogOption } from "@/services/crm-settings-service";

export function CrmCatalogsEditor({
  catalogs,
  onChange,
}: {
  catalogs: Record<string, CrmCatalogConfig>;
  onChange: (next: Record<string, CrmCatalogConfig>) => void;
}) {
  const keys = useMemo(() => Object.keys(catalogs).sort(), [catalogs]);
  const [active, setActive] = useState(keys[0] ?? "");
  const catalog = catalogs[active];
  const options = [...(catalog?.options ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const parents = useMemo(() => {
    const set = new Set<string>();
    for (const o of options) {
      const p = o.meta?.parent_value;
      if (p) set.add(String(p));
    }
    return [...set].sort();
  }, [options]);
  const [parentFilter, setParentFilter] = useState<string>("");

  const visible = parentFilter
    ? options.filter((o) => String(o.meta?.parent_value ?? "") === parentFilter)
    : options;

  function setOptions(next: CrmCatalogOption[]) {
    onChange({
      ...catalogs,
      [active]: { ...(catalog ?? { label: active }), options: next },
    });
  }

  function updateOption(value: string, patch: Partial<CrmCatalogOption>) {
    setOptions(options.map((o) => (o.value === value ? { ...o, ...patch } : o)));
  }

  function addOption() {
    const base = `cf_option_${options.length + 1}`;
    let value = base;
    let n = 1;
    const existing = new Set(options.map((o) => o.value));
    while (existing.has(value)) {
      n += 1;
      value = `${base}_${n}`;
    }
    setOptions([
      ...options,
      {
        value,
        label: "New option",
        enabled: true,
        order: options.length,
        source: "custom",
        ...(parentFilter ? { meta: { parent_value: parentFilter } } : {}),
      },
    ]);
  }

  if (!keys.length) {
    return <p className="text-sm text-muted-foreground">No catalogs configured.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
      <div className="space-y-1 rounded-lg border border-border/70 p-2">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            className={`flex w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 ${
              active === key ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/40"
            }`}
            onClick={() => {
              setActive(key);
              setParentFilter("");
            }}
          >
            {catalogs[key]?.label || key}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">{catalog?.label || active}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{active}</p>
          </div>
          <Button type="button" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={addOption}>
            <Plus className="size-3.5" />
            Add option
          </Button>
        </div>
        {parents.length > 0 ? (
          <select
            className="h-8 cursor-pointer rounded-md border border-input bg-background px-2 text-sm"
            value={parentFilter}
            onChange={(e) => setParentFilter(e.target.value)}
          >
            <option value="">All parents</option>
            {parents.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        ) : null}
        <div className="space-y-2">
          {visible.map((opt, idx) => {
            const isCustom = opt.source === "custom" || String(opt.value).startsWith("cf_");
            return (
              <div
                key={opt.value}
                className="grid gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 md:grid-cols-[minmax(0,1.4fr)_5rem_auto_auto]"
              >
                <Input
                  className="h-8"
                  value={opt.label}
                  onChange={(e) => updateOption(opt.value, { label: e.target.value })}
                />
                <Input
                  type="number"
                  className="h-8"
                  value={opt.order ?? idx}
                  onChange={(e) =>
                    updateOption(opt.value, {
                      order: Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0,
                    })
                  }
                />
                <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={opt.enabled !== false}
                    onChange={(e) => updateOption(opt.value, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>
                {isCustom ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 cursor-pointer text-destructive"
                    onClick={() => setOptions(options.filter((o) => o.value !== opt.value))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : (
                  <span className="self-center text-[11px] text-muted-foreground">Stock</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
