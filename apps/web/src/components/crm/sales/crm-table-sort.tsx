"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

export type SortValue = string | number | boolean | null | undefined | Date;

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="size-3 opacity-40" aria-hidden />;
  return dir === "asc" ? (
    <ArrowUp className="size-3" aria-hidden />
  ) : (
    <ArrowDown className="size-3" aria-hidden />
  );
}

export function CrmSortableTh<T extends string>({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
  align = "left",
}: {
  label: string;
  sortKey: T;
  activeKey: T;
  dir: SortDir;
  onSort: (key: T) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const active = activeKey === sortKey;
  return (
    <th className={cn("px-4 py-2.5", className)}>
      <button
        type="button"
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 font-medium tracking-wide uppercase transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          align === "right" && "ml-auto flex-row-reverse",
          active ? "text-foreground" : "text-muted-foreground",
        )}
        onClick={() => onSort(sortKey)}
        aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        <SortIcon active={active} dir={dir} />
      </button>
    </th>
  );
}

function normalizeSortValue(value: SortValue): string | number {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return value.getTime();
  const raw = String(value).trim();
  if (raw === "") return "";
  // ISO / date-like strings
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return t;
  }
  const asNum = Number(raw.replace(/,/g, ""));
  if (raw !== "" && Number.isFinite(asNum) && /^-?\d+(\.\d+)?$/.test(raw.replace(/,/g, ""))) {
    return asNum;
  }
  return raw.toLowerCase();
}

export function compareSortValues(a: SortValue, b: SortValue, dir: SortDir): number {
  const av = normalizeSortValue(a);
  const bv = normalizeSortValue(b);
  let cmp = 0;
  if (typeof av === "number" && typeof bv === "number") {
    cmp = av - bv;
  } else {
    cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
  }
  if (cmp === 0) return 0;
  return dir === "asc" ? cmp : -cmp;
}

export function sortRows<T, K extends string>(
  rows: T[],
  sortBy: K,
  sortDir: SortDir,
  accessors: Record<K, (row: T) => SortValue>,
): T[] {
  const getValue = accessors[sortBy];
  if (!getValue) return rows;
  return [...rows].sort((a, b) => compareSortValues(getValue(a), getValue(b), sortDir));
}

export function useTableSort<K extends string>(defaultKey: K, defaultDir: SortDir = "asc") {
  const [sortBy, setSortBy] = useState<K>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const onSort = useCallback(
    (key: K) => {
      if (key === sortBy) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(key);
        setSortDir("asc");
      }
    },
    [sortBy],
  );

  return { sortBy, sortDir, onSort };
}

export function useSortedRows<T, K extends string>(
  rows: T[],
  sortBy: K,
  sortDir: SortDir,
  accessors: Record<K, (row: T) => SortValue>,
): T[] {
  return useMemo(
    () => sortRows(rows, sortBy, sortDir, accessors),
    [rows, sortBy, sortDir, accessors],
  );
}
