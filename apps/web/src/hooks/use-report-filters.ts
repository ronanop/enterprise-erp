"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "erp.finance.reportFilters.v1";
const BOOKMARKS_KEY = "erp.finance.reportBookmarks.v1";

export type ReportFilters = {
  companyId: string;
  branchId: string;
  fiscalYearId: string;
  periodId: string;
  fromDate: string;
  toDate: string;
  asOf: string;
  currency: string;
  costCenterId: string;
  accountId: string;
  status: string;
  q: string;
};

export type ReportBookmark = {
  id: string;
  name: string;
  filters: ReportFilters;
  createdAt: string;
};

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  companyId: "",
  branchId: "",
  fiscalYearId: "",
  periodId: "",
  fromDate: "",
  toDate: "",
  asOf: new Date().toISOString().slice(0, 10),
  currency: "",
  costCenterId: "",
  accountId: "",
  status: "",
  q: "",
};

function mergeFilters(partial?: Partial<ReportFilters>): ReportFilters {
  return { ...DEFAULT_REPORT_FILTERS, ...partial };
}

export function useReportFilters(initial?: Partial<ReportFilters>) {
  const [filters, setFiltersState] = useState<ReportFilters>(() =>
    mergeFilters(initial),
  );
  const [bookmarks, setBookmarks] = useState<ReportBookmark[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ReportFilters>;
        setFiltersState(mergeFilters({ ...parsed, ...initial }));
      } else if (initial) {
        setFiltersState(mergeFilters(initial));
      }
      const bmRaw = localStorage.getItem(BOOKMARKS_KEY);
      if (bmRaw) {
        setBookmarks(JSON.parse(bmRaw) as ReportBookmark[]);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, [initial]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      /* ignore */
    }
  }, [filters, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    } catch {
      /* ignore */
    }
  }, [bookmarks, ready]);

  const setFilters = useCallback((patch: Partial<ReportFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(mergeFilters(initial));
  }, [initial]);

  const saveBookmark = useCallback(
    (name: string) => {
      const bookmark: ReportBookmark = {
        id: crypto.randomUUID(),
        name: name.trim() || `Filter ${bookmarks.length + 1}`,
        filters: { ...filters },
        createdAt: new Date().toISOString(),
      };
      setBookmarks((prev) => [bookmark, ...prev].slice(0, 20));
      return bookmark;
    },
    [filters, bookmarks.length],
  );

  const applyBookmark = useCallback((id: string) => {
    const bm = bookmarks.find((b) => b.id === id);
    if (bm) setFiltersState({ ...bm.filters });
  }, [bookmarks]);

  const removeBookmark = useCallback((id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return {
    filters,
    setFilters,
    resetFilters,
    bookmarks,
    saveBookmark,
    applyBookmark,
    removeBookmark,
    ready,
  };
}
