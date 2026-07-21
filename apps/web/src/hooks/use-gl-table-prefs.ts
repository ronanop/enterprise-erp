"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "erp.finance.gl.tablePrefs.v1";

export type GlTablePrefs = {
  visibleColumns: string[];
  pageSize: number;
};

const DEFAULTS: GlTablePrefs = {
  visibleColumns: [
    "journal",
    "voucher",
    "date",
    "fiscal_year",
    "period",
    "account_code",
    "account_name",
    "debit",
    "credit",
    "running",
    "status",
  ],
  pageSize: 25,
};

export function useGlTablePrefs() {
  const [prefs, setPrefs] = useState<GlTablePrefs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GlTablePrefs>;
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
