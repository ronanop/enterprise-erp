"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Columns3 } from "lucide-react";

import { Button } from "@/components/ui/button";

export const COMPANY_LIST_COLUMN_IDS = [
  "customer_name",
  "phone",
  "customer_email",
  "account_owner",
  "created_at",
  "updated_at",
  "source",
] as const;

export type CompanyListColumnId = (typeof COMPANY_LIST_COLUMN_IDS)[number];

export const COMPANY_LIST_COLUMN_LABELS: Record<CompanyListColumnId, string> = {
  customer_name: "Company Name",
  phone: "Phone",
  customer_email: "Email",
  account_owner: "Account Manager Owner",
  created_at: "Created Time",
  updated_at: "Modified Time",
  source: "Source",
};

const STORAGE_KEY = "crm.company-list.visible-columns";

const DEFAULT_VISIBLE = new Set<CompanyListColumnId>(COMPANY_LIST_COLUMN_IDS);

function loadVisibleColumns(): Set<CompanyListColumnId> {
  if (typeof window === "undefined") return new Set(DEFAULT_VISIBLE);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set(DEFAULT_VISIBLE);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set(DEFAULT_VISIBLE);
    const valid = parsed.filter((id): id is CompanyListColumnId =>
      COMPANY_LIST_COLUMN_IDS.includes(id as CompanyListColumnId),
    );
    if (valid.length === 0) return new Set(["customer_name"]);
    return new Set(valid);
  } catch {
    return new Set(DEFAULT_VISIBLE);
  }
}

function saveVisibleColumns(cols: Set<CompanyListColumnId>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...cols]));
  } catch {
    /* ignore */
  }
}

export function CompanyListColumnPicker({
  visible,
  onChange,
}: {
  visible: Set<CompanyListColumnId>;
  onChange: (next: Set<CompanyListColumnId>) => void;
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
    (id: CompanyListColumnId) => {
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
            {COMPANY_LIST_COLUMN_IDS.map((id) => (
              <li key={id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                  <input
                    type="checkbox"
                    className="size-3.5 cursor-pointer rounded border-border"
                    checked={visible.has(id)}
                    onChange={() => toggle(id)}
                  />
                  {COMPANY_LIST_COLUMN_LABELS[id]}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function useCompanyListVisibleColumns() {
  const [visible, setVisible] = useState<Set<CompanyListColumnId>>(() => new Set(DEFAULT_VISIBLE));

  useEffect(() => {
    setVisible(loadVisibleColumns());
  }, []);

  return [visible, setVisible] as const;
}
