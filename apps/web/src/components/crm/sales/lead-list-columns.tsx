"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Columns3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCrmSettingsEffective } from "@/hooks/use-crm-settings";
import { visibleTableColumns, type CrmSettingsConfig } from "@/services/crm-settings-service";

export const LEAD_LIST_COLUMN_IDS = [
  "lead",
  "mobile",
  "expected_amount",
  "blueprint_state",
  "status",
] as const;

export type LeadListColumnId = string;

export const LEAD_LIST_COLUMN_LABELS: Record<string, string> = {
  lead: "Lead",
  mobile: "Mobile",
  expected_amount: "Expected Amount",
  blueprint_state: "Stage",
  status: "Status",
};

const STORAGE_KEY = "crm.lead-list.visible-columns";
const DEFAULT_VISIBLE = new Set<string>(LEAD_LIST_COLUMN_IDS);

function loadUserOverride(): Set<string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.map((id) => String(id)).filter(Boolean);
    if (valid.length === 0) return new Set(["lead"]);
    return new Set(valid);
  } catch {
    return null;
  }
}

function saveVisibleColumns(cols: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...cols]));
  } catch {
    /* ignore */
  }
}

function tenantDefaultVisible(settingsColumns: Array<{ key: string; visible?: boolean }>): Set<string> {
  if (!settingsColumns.length) return new Set(DEFAULT_VISIBLE);
  const next = settingsColumns.filter((c) => c.visible !== false).map((c) => c.key);
  return next.length > 0 ? new Set(next) : new Set(["lead"]);
}

export function leadTableColumnDefs(settings: CrmSettingsConfig | null | undefined) {
  const fromSettings = visibleTableColumns(settings, "lead");
  if (fromSettings.length) return fromSettings;
  return LEAD_LIST_COLUMN_IDS.map((key, order) => ({
    key,
    label: LEAD_LIST_COLUMN_LABELS[key] ?? key,
    visible: true,
    order,
  }));
}

export function leadColumnLabel(
  settings: CrmSettingsConfig | null | undefined,
  key: string,
): string {
  const row = leadTableColumnDefs(settings).find((c) => c.key === key);
  return row?.label ?? LEAD_LIST_COLUMN_LABELS[key] ?? key;
}

export function LeadListColumnPicker({
  visible,
  onChange,
  columnKeys,
  settings,
}: {
  visible: Set<string>;
  onChange: (next: Set<string>) => void;
  columnKeys: string[];
  settings: CrmSettingsConfig | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(visible);
      if (next.has(id)) {
        if (next.size <= 1) return;
        next.delete(id);
      } else {
        next.add(id);
      }
      onChange(next);
      saveVisibleColumns(next);
    },
    [visible, onChange],
  );

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="cursor-pointer gap-1.5"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <Columns3 className="size-3.5" />
        Columns
      </Button>
      {open ? (
        <div
          className="absolute top-full right-0 z-20 mt-1 w-52 rounded-lg border border-border/80 bg-card p-2 shadow-md"
          role="menu"
        >
          <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Show columns
          </p>
          <ul className="space-y-0.5">
            {columnKeys.map((id) => (
              <li key={id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                  <input
                    type="checkbox"
                    className="size-3.5 cursor-pointer rounded border-border"
                    checked={visible.has(id)}
                    onChange={() => toggle(id)}
                  />
                  {leadColumnLabel(settings, id)}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function useLeadListVisibleColumns() {
  const { settings } = useCrmSettingsEffective();
  const columnKeys = useMemo(
    () => leadTableColumnDefs(settings).map((c) => c.key),
    [settings],
  );
  const [visible, setVisible] = useState<Set<string>>(() => new Set(DEFAULT_VISIBLE));

  useEffect(() => {
    const override = loadUserOverride();
    if (override) {
      setVisible(override);
      return;
    }
    const tenantCols = visibleTableColumns(settings, "lead");
    setVisible(tenantDefaultVisible(tenantCols.length ? tenantCols : leadTableColumnDefs(settings)));
  }, [settings]);

  return [visible, setVisible, columnKeys] as const;
}
