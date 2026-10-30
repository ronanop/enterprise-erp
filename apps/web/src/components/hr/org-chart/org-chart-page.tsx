"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Minus, Plus, RotateCcw, Search, UserRound, Users } from "lucide-react";

import { HrAuthBanner, HrEmptyState } from "@/components/hr/hr-primitives";
import { EmsAvatar, EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import { looksLikeManagerRole } from "@/lib/hr/reporting-managers";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import { listPeopleRoles, type PeopleRoleRow } from "@/services/people-role-service";

const MAX_CHILDREN_SHOWN = 12;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.75;
const ZOOM_STEP = 0.15;
const ZOOM_DEFAULT = 1;

/** Left rail: leaders only — managers with reports, heads, C-suite, hiring managers. */
function isTopLeader(
  row: PeopleRoleRow,
  childrenByManager: Map<string, PeopleRoleRow[]>,
  referencedAsManager: Set<string>,
): boolean {
  if ((childrenByManager.get(row.id)?.length ?? 0) > 0) return true;
  if (Number(row.reports_count ?? 0) > 0) return true;
  if (referencedAsManager.has(row.id)) return true;
  if (row.is_hiring_manager) return true;
  if (!row.reporting_manager_id) return true; // org roots (often CEO)
  return looksLikeManagerRole({
    id: row.id,
    employee_code: row.employee_code,
    first_name: row.first_name,
    last_name: row.last_name,
    display_name: row.display_name,
    designation: row.designation,
    reporting_manager_id: row.reporting_manager_id,
    is_hiring_manager: row.is_hiring_manager,
  });
}

function personName(row: PeopleRoleRow): string {
  const full = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return full || row.display_name || row.employee_code || "Employee";
}

function personMeta(row: PeopleRoleRow): string {
  const bits = [row.designation, row.employee_code].filter(Boolean);
  return bits.join(" · ");
}

function OrgPersonCard({
  row,
  active,
  compact,
  reportCount,
  onSelect,
}: {
  row: PeopleRoleRow;
  active?: boolean;
  compact?: boolean;
  reportCount?: number;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(row.id)}
      className={cn(
        "group relative z-[1] flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border bg-card px-3 py-3 text-center shadow-sm transition-all duration-200",
        "hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        active ? "border-primary ring-2 ring-primary/25" : "border-border",
        compact ? "w-[140px] px-2.5 py-2.5" : "w-[168px]",
      )}
    >
      <EmsAvatar name={personName(row)} size={compact ? "sm" : "md"} />
      <span className="w-full truncate text-[12px] font-semibold text-foreground">
        {personName(row)}
      </span>
      <span className="line-clamp-2 min-h-[2rem] w-full text-[10px] leading-tight text-muted-foreground">
        {row.designation || row.employee_code || "—"}
      </span>
      {typeof reportCount === "number" && reportCount > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          <Users className="size-2.5" aria-hidden />
          {reportCount}
        </span>
      ) : null}
    </button>
  );
}

function OrgStem() {
  return (
    <div className="relative flex h-7 w-px items-end justify-center bg-border" aria-hidden>
      <ChevronDown className="absolute -bottom-1.5 size-3.5 text-muted-foreground" />
    </div>
  );
}

function OrgChildrenRow({
  children,
  childrenByManager,
  activeId,
  onSelect,
  expandGrandchildren,
}: {
  children: PeopleRoleRow[];
  childrenByManager: Map<string, PeopleRoleRow[]>;
  activeId: string | null;
  onSelect: (id: string) => void;
  expandGrandchildren: boolean;
}) {
  const shown = children.slice(0, MAX_CHILDREN_SHOWN);
  const hidden = children.length - shown.length;
  const multi = shown.length > 1;

  return (
    <div className="flex flex-col items-center">
      <ul className="flex flex-wrap justify-center">
        {shown.map((child, index) => {
          const grand = childrenByManager.get(child.id) ?? [];
          const isFirst = index === 0;
          const isLast = index === shown.length - 1;
          return (
            <li
              key={child.id}
              className="relative flex flex-col items-center px-2.5 pt-4"
            >
              {/* Vertical drop from horizontal rail */}
              <span
                className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-border"
                aria-hidden
              />
              {/* Horizontal rail segments */}
              {multi ? (
                <>
                  <span
                    className={cn(
                      "absolute top-0 h-px bg-border",
                      isFirst ? "left-1/2 right-0" : isLast ? "left-0 right-1/2" : "left-0 right-0",
                    )}
                    aria-hidden
                  />
                </>
              ) : null}

              {expandGrandchildren && grand.length > 0 ? (
                <div className="flex flex-col items-center">
                  <OrgPersonCard
                    row={child}
                    active={child.id === activeId}
                    compact
                    reportCount={grand.length}
                    onSelect={onSelect}
                  />
                  <OrgStem />
                  <OrgChildrenRow
                    children={grand}
                    childrenByManager={childrenByManager}
                    activeId={activeId}
                    onSelect={onSelect}
                    expandGrandchildren={false}
                  />
                </div>
              ) : (
                <OrgPersonCard
                  row={child}
                  active={child.id === activeId}
                  compact
                  reportCount={grand.length}
                  onSelect={onSelect}
                />
              )}
            </li>
          );
        })}
      </ul>
      {hidden > 0 ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          +{hidden} more — select them from the list to focus
        </p>
      ) : null}
    </div>
  );
}

function OrgBranch({
  parent,
  children,
  childrenByManager,
  activeId,
  onSelect,
}: {
  parent: PeopleRoleRow;
  children: PeopleRoleRow[];
  childrenByManager: Map<string, PeopleRoleRow[]>;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <OrgPersonCard
        row={parent}
        active={parent.id === activeId}
        reportCount={children.length}
        onSelect={onSelect}
      />

      {children.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
          <p className="text-sm font-medium text-foreground">No direct reports</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Set reporting managers on People roles or employee profiles
          </p>
        </div>
      ) : (
        <>
          <OrgStem />
          <OrgChildrenRow
            children={children}
            childrenByManager={childrenByManager}
            activeId={activeId}
            onSelect={onSelect}
            expandGrandchildren
          />
        </>
      )}
    </div>
  );
}

export function OrgChartPage() {
  const [rows, setRows] = useState<PeopleRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authBlocked, setAuthBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);

  const load = useCallback(async () => {
    if (!isAuthenticated()) {
      setAuthBlocked(true);
      setLoading(false);
      return;
    }
    setAuthBlocked(false);
    setLoading(true);
    setError(null);
    try {
      const data = await listPeopleRoles();
      const active = data.filter((r) => {
        const status = String(r.status ?? "active").toLowerCase();
        return status !== "deleted" && status !== "archived" && status !== "separated";
      });
      setRows(active);
    } catch (err) {
      if (err instanceof ApiClientError && (err.status === 401 || err.status === 403)) {
        setAuthBlocked(true);
      } else {
        setError(err instanceof Error ? err.message : "Could not load org chart");
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  const childrenByManager = useMemo(() => {
    const map = new Map<string, PeopleRoleRow[]>();
    for (const row of rows) {
      const mgr = row.reporting_manager_id;
      if (!mgr) continue;
      const list = map.get(mgr) ?? [];
      list.push(row);
      map.set(mgr, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => personName(a).localeCompare(personName(b)));
    }
    return map;
  }, [rows]);

  const referencedAsManager = useMemo(() => {
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.reporting_manager_id) ids.add(row.reporting_manager_id);
    }
    return ids;
  }, [rows]);

  const topLeaders = useMemo(() => {
    return rows
      .filter((r) => isTopLeader(r, childrenByManager, referencedAsManager))
      .sort((a, b) => {
        const ra = childrenByManager.get(a.id)?.length ?? Number(a.reports_count ?? 0);
        const rb = childrenByManager.get(b.id)?.length ?? Number(b.reports_count ?? 0);
        if (rb !== ra) return rb - ra;
        const rootBias = Number(Boolean(a.reporting_manager_id)) - Number(Boolean(b.reporting_manager_id));
        if (rootBias !== 0) return rootBias;
        return personName(a).localeCompare(personName(b));
      });
  }, [rows, childrenByManager, referencedAsManager]);

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && rows.some((r) => r.id === prev)) return prev;
      return topLeaders[0]?.id ?? rows[0]?.id ?? null;
    });
  }, [rows, topLeaders]);

  const filteredLeaders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return topLeaders;
    return topLeaders.filter((r) => {
      const hay =
        `${personName(r)} ${r.employee_code} ${r.designation} ${r.reporting_manager_name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [topLeaders, query]);

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;
  const directReports = selectedId ? (childrenByManager.get(selectedId) ?? []) : [];
  const manager = selected?.reporting_manager_id
    ? (byId.get(selected.reporting_manager_id) ?? null)
    : null;

  const zoomPct = Math.round(zoom * 100);

  function zoomIn() {
    setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100));
  }
  function zoomOut() {
    setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100));
  }
  function zoomReset() {
    setZoom(ZOOM_DEFAULT);
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[28rem] flex-col gap-3 overflow-hidden pb-2">
      <div className="shrink-0">
        <PageHeader
          title="Org Chart"
          description="Leaders on the left — diagram zooms; click a card to focus their team"
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => void load()}
              disabled={loading}
            >
              Refresh
            </Button>
          }
        />
      </div>

      {authBlocked ? (
        <div className="shrink-0">
          <HrAuthBanner />
        </div>
      ) : null}
      {error ? (
        <p className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <EmsSkeleton rows={10} cards={2} />
        </div>
      ) : rows.length === 0 && !authBlocked ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <HrEmptyState
            title="No employees in scope"
            description="Add employees and set reporting managers under Org Setup → People roles."
          />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="shrink-0 border-b border-border px-3 py-2.5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Top leaders
              </p>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search managers, heads…"
                  className="h-8 pl-8 text-xs"
                  aria-label="Search top leaders"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {filteredLeaders.length} leader{filteredLeaders.length === 1 ? "" : "s"}
              </p>
            </div>
            <ul
              className="erp-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-1.5"
              role="listbox"
              aria-label="Top leaders"
            >
              {filteredLeaders.length === 0 ? (
                <li className="px-2 py-6 text-center text-xs text-muted-foreground">
                  No matching leaders
                </li>
              ) : (
                filteredLeaders.map((row) => {
                  const active = row.id === selectedId;
                  const reports =
                    childrenByManager.get(row.id)?.length ?? Number(row.reports_count ?? 0);
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => setSelectedId(row.id)}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors duration-150",
                          active
                            ? "bg-primary/10 text-foreground"
                            : "text-foreground hover:bg-muted/70",
                        )}
                      >
                        <EmsAvatar name={personName(row)} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">
                            {personName(row)}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {personMeta(row) || "—"}
                          </span>
                        </span>
                        {reports > 0 ? (
                          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {reports}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </aside>

          <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-muted/30 shadow-sm">
            <div className="flex shrink-0 items-center justify-end gap-1 border-b border-border/70 bg-card px-2 py-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 cursor-pointer p-0"
                onClick={zoomOut}
                disabled={zoom <= ZOOM_MIN}
                aria-label="Zoom out"
              >
                <Minus className="size-3.5" />
              </Button>
              <span className="min-w-[3rem] text-center text-xs font-medium tabular-nums text-muted-foreground">
                {zoomPct}%
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 cursor-pointer p-0"
                onClick={zoomIn}
                disabled={zoom >= ZOOM_MAX}
                aria-label="Zoom in"
              >
                <Plus className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 cursor-pointer gap-1 px-2 text-xs"
                onClick={zoomReset}
                disabled={zoom === ZOOM_DEFAULT}
                aria-label="Reset zoom"
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            </div>

            {!selected ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                <UserRound className="size-8 text-muted-foreground/50" aria-hidden />
                <p className="mt-3 text-sm font-medium text-foreground">Select a leader</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Their reporting diagram appears here
                </p>
              </div>
            ) : (
              <div className="erp-scroll min-h-0 flex-1 overflow-x-auto overflow-y-auto">
                <div
                  className="inline-block min-w-full px-6 py-8 transition-transform duration-200 motion-reduce:transition-none"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "top center",
                  }}
                >
                  <div className="flex min-w-max flex-col items-center">
                    {manager ? (
                      <div className="mb-0 flex flex-col items-center">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Reports to
                        </p>
                        <OrgPersonCard
                          row={manager}
                          compact
                          reportCount={childrenByManager.get(manager.id)?.length}
                          onSelect={setSelectedId}
                        />
                        <OrgStem />
                      </div>
                    ) : null}

                    <OrgBranch
                      parent={selected}
                      children={directReports}
                      childrenByManager={childrenByManager}
                      activeId={selectedId}
                      onSelect={setSelectedId}
                    />

                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3 border-t border-border/70 pt-4 text-xs text-muted-foreground">
                      <Link
                        href={`/hr/workforce/${selected.id}`}
                        className="cursor-pointer font-medium text-primary transition-opacity duration-150 hover:opacity-80"
                      >
                        Open {personName(selected).split(" ")[0]}’s profile
                      </Link>
                      <span aria-hidden>·</span>
                      <span>
                        {directReports.length} direct report
                        {directReports.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
