"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "erp.finance.ap.tablePrefs.v1";

export type ApTablePrefs = {
  visibleColumns: string[];
  pageSize: number;
};

const DEFAULTS: ApTablePrefs = {
  visibleColumns: [
    "invoice_no",
    "vendor",
    "invoice_date",
    "due_date",
    "status",
    "currency",
    "outstanding",
    "paid",
    "balance",
    "created_by",
  ],
  pageSize: 25,
};

export function useApTablePrefs() {
  const [prefs, setPrefs] = useState<ApTablePrefs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ApTablePrefs>;
        setPrefs({
          visibleColumns: parsed.visibleColumns ?? DEFAULTS.visibleColumns,
          pageSize: parsed.pageSize ?? DEFAULTS.pageSize,
        });
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs, ready]);

  return { prefs, setPrefs, ready };
}
