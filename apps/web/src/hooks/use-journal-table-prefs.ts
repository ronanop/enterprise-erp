"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "erp.finance.journals.tablePrefs.v1";

export type JournalTablePrefs = {
  visibleColumns: string[];
  columnOrder: string[];
  pageSize: number;
};

const DEFAULTS: JournalTablePrefs = {
  visibleColumns: [
    "select",
    "voucher",
    "date",
    "type",
    "period",
    "status",
    "debit",
    "credit",
    "diff",
    "created_by",
    "posted_by",
    "posted_at",
  ],
  columnOrder: [
    "select",
    "voucher",
    "date",
    "type",
    "period",
    "status",
    "workflow",
    "debit",
    "credit",
    "diff",
    "created_by",
    "posted_by",
    "posted_at",
  ],
  pageSize: 25,
};

export function useJournalTablePrefs() {
  const [prefs, setPrefs] = useState<JournalTablePrefs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<JournalTablePrefs>;
        setPrefs({
          visibleColumns: parsed.visibleColumns ?? DEFAULTS.visibleColumns,
          columnOrder: parsed.columnOrder ?? DEFAULTS.columnOrder,
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
