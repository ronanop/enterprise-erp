"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "erp.finance.fiscal.tablePrefs.v1";

export type FiscalTablePrefs = {
  visibleColumns: string[];
  pageSize: number;
};

const DEFAULTS: FiscalTablePrefs = {
  visibleColumns: [
    "select",
    "code",
    "name",
    "start",
    "end",
    "status",
    "closed",
    "created_by",
    "updated",
  ],
  pageSize: 25,
};

export function useFiscalTablePrefs() {
  const [prefs, setPrefs] = useState<FiscalTablePrefs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FiscalTablePrefs>;
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
