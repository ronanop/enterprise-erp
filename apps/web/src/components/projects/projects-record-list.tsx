"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  ProjectsErrorBanner,
  ProjectsListPanel,
  ProjectsListToolbar,
  ProjectsPage,
  ProjectsSortableTh,
  sortRows,
  useTableSort,
  type SortDir,
  type SortValue,
} from "@/components/projects/projects-ui";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import { cn } from "@/lib/utils";

export type RecordColumn<T> = {
  /** Sort key — must be unique within the table. */
  key: string;
  label: string;
  cell: (row: T) => ReactNode;
  sort: (row: T) => SortValue;
  /** When false, render a plain header (no sort control). Default true. */
  sortable?: boolean;
  /** Extra classes for the body cell. */
  className?: string;
  align?: "left" | "center" | "right";
};

export function ProjectsRecordList<T extends { id: string }>({
  title,
  description,
  panelTitle,
  panelSubtitle,
  icon,
  newHref,
  newLabel,
  headerActions,
  searchPlaceholder,
  emptyMessage,
  loadingMessage,
  errorMessage,
  minWidth = 900,
  columns,
  defaultSortKey,
  defaultSortDir = "asc",
  load,
  matches,
  banner,
}: {
  title: string;
  description?: string;
  panelTitle: string;
  panelSubtitle?: string;
  icon?: LucideIcon;
  newHref?: string;
  newLabel?: string;
  headerActions?: ReactNode | ((ctx: { rows: T[]; loading: boolean }) => ReactNode);
  searchPlaceholder?: string;
  emptyMessage: string;
  loadingMessage?: string;
  errorMessage: string;
  minWidth?: number;
  columns: RecordColumn<T>[];
  defaultSortKey: string;
  defaultSortDir?: SortDir;
  load: () => Promise<T[]>;
  matches: (row: T, query: string) => boolean;
  banner?: ReactNode;
}) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { sortBy, sortDir, onSort } = useTableSort<string>(defaultSortKey, defaultSortDir);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await load());
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : errorMessage);
    } finally {
      setLoading(false);
    }
  }, [load, errorMessage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => matches(row, q));
  }, [rows, query, matches]);

  const accessors = useMemo(() => {
    const map: Record<string, (row: T) => SortValue> = {};
    for (const col of columns) {
      if (col.sortable === false) continue;
      map[col.key] = col.sort;
    }
    return map;
  }, [columns]);

  const sorted = useMemo(
    () => sortRows(filtered, sortBy, sortDir, accessors),
    [filtered, sortBy, sortDir, accessors],
  );

  const resolvedHeaderActions =
    typeof headerActions === "function"
      ? headerActions({ rows: sorted, loading })
      : headerActions;

  return (
    <ProjectsPage>
      <PageHeader
        title={title}
        description={description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {resolvedHeaderActions}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
            {newHref ? (
              <Link
                href={newHref}
                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
              >
                <Plus className="size-3.5" />
                {newLabel ?? "New"}
              </Link>
            ) : null}
          </div>
        }
      />

      {error ? <ProjectsErrorBanner>{error}</ProjectsErrorBanner> : null}
      {banner}

      <ProjectsListPanel>
        <ProjectsListToolbar
          title={panelTitle}
          subtitle={panelSubtitle}
          icon={icon}
          count={sorted.length}
          search={
            searchPlaceholder
              ? { value: query, onChange: setQuery, placeholder: searchPlaceholder }
              : undefined
          }
        />

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full text-left text-sm" style={{ minWidth: `${minWidth}px` }}>
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                {columns.map((col) =>
                  col.sortable === false ? (
                    <th
                      key={col.key}
                      className={cn(
                        "px-4 py-2.5",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                      )}
                    >
                      {col.label ? (
                        <span className="text-xs font-extrabold tracking-wide text-foreground uppercase sm:text-[13px]">
                          {col.label}
                        </span>
                      ) : null}
                    </th>
                  ) : (
                    <ProjectsSortableTh
                      key={col.key}
                      label={col.label}
                      sortKey={col.key}
                      activeKey={sortBy}
                      dir={sortDir}
                      onSort={onSort}
                      align={col.align}
                    />
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    {loadingMessage ?? "Loading…"}
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/50 transition-colors last:border-0 hover:bg-accent/30"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-4 py-2.5",
                          col.align === "right" && "text-right",
                          col.align === "center" && "text-center",
                          col.className ?? "text-muted-foreground",
                        )}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ProjectsListPanel>
    </ProjectsPage>
  );
}
