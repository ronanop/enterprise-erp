"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "erp.finance.ar.tablePrefs.v1";

export type ArTablePrefs = {
  visibleColumns: string[];
  pageSize: number;
};

const DEFAULTS: ArTablePrefs = {
  visibleColumns: [
    "invoice_no",
    "customer",
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

export function useArTablePrefs() {
  const [prefs, setPrefs] = useState<ArTablePrefs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ArTablePrefs>;
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
