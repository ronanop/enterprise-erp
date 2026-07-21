"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "erp.finance.coa.tablePrefs.v1";

export type CoaTablePrefs = {
  visibleColumns: string[];
  pageSize: number;
};

const DEFAULTS: CoaTablePrefs = {
  visibleColumns: [
    "select",
    "code",
    "name",
    "parent",
    "type",
    "category",
    "currency",
    "status",
    "posting",
    "balance",
    "created_by",
  ],
  pageSize: 25,
};

export function useCoaTablePrefs() {
  const [prefs, setPrefs] = useState<CoaTablePrefs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CoaTablePrefs>;
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
