"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, RefreshCw, Search } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  CRM_CHART_COLORS,
  CrmPipelineBarChart,
  CrmStageDonutChart,
} from "@/components/crm/crm-dashboard-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  listDealTimelines,
  type DealTimelineListItem,
  type DealTimelinePhase,
} from "@/services/sales-crm-service";

const PHASE_ORDER: DealTimelinePhase[] = [
  "crm",
  "ovf",
  "scm",
  "delivery",
  "project",
  "completed",
];

const PHASE_LABEL: Record<DealTimelinePhase, string> = {
  crm: "Lead / CRM",
  ovf: "OVF",
  scm: "SCM / PO",
  delivery: "Delivery",
  project: "Project",
  completed: "Completed",
  lost: "Lost",
};

function phaseTone(phase: DealTimelinePhase): string {
  switch (phase) {
    case "completed":
      return "border-emerald-300 bg-emerald-50 text-emerald-900";
    case "lost":
      return "border-red-300 bg-red-50 text-red-900";
    case "project":
      return "border-teal-300 bg-teal-50 text-teal-900";
    case "delivery":
      return "border-indigo-300 bg-indigo-50 text-indigo-900";
    case "scm":
      return "border-sky-300 bg-sky-50 text-sky-900";
    case "ovf":
      return "border-amber-300 bg-amber-50 text-amber-900";
    default:
      return "border-slate-300 bg-slate-50 text-slate-900";
  }
}

function humanize(value: string | null | undefined): string {
  if (!value) return "-";
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatWhen(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function DealTimelineListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<DealTimelineListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      setRows(await listDealTimelines());
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load deal timelines");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.opportunity_code,
        row.opportunity_name,
        row.customer_name,
        row.account_name,
        row.stage,
        row.phase,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [query, rows]);

  const phaseData = useMemo(
    () =>
      PHASE_ORDER.map((phase) => ({
        name: PHASE_LABEL[phase],
        count: rows.filter((r) => r.phase === phase).length,
      })),
    [rows],
  );

  const statusData = useMemo(() => {
    const won = rows.filter((r) => r.phase === "completed").length;
    const lost = rows.filter((r) => r.phase === "lost").length;
    const ongoing = rows.length - won - lost;
    return [
      { name: "Ongoing", value: ongoing },
      { name: "Completed", value: won },
      { name: "Lost", value: lost },
    ].filter((d) => d.value > 0);
  }, [rows]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((r) => r.phase === "completed").length;
    const inScmOrLater = rows.filter((r) =>
      ["scm", "delivery", "project", "completed"].includes(r.phase),
    ).length;
    const inProject = rows.filter((r) => ["project", "completed"].includes(r.phase)).length;
    return { total, completed, inScmOrLater, inProject };
  }, [rows]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Deal Timeline"
        description="End-to-end deal journey — lead creation in CRM, OVF shared to SCM, PO and delivery, handoff to Project Management, through project completion."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            disabled={loading || refreshing}
            onClick={() => void load(true)}
          >
            <RefreshCw className={cn("mr-1.5 size-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total deals", value: kpis.total },
          { label: "In SCM or later", value: kpis.inScmOrLater },
          { label: "In Projects", value: kpis.inProject },
          { label: "Completed", value: kpis.completed },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{kpi.label}</p>
            <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-foreground">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm lg:col-span-3">
          <h2 className="mb-2 text-sm font-semibold tracking-tight text-foreground">Deals by lifecycle phase</h2>
          <CrmPipelineBarChart data={phaseData} loading={loading} />
        </div>
        <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold tracking-tight text-foreground">Outcome mix</h2>
          <CrmStageDonutChart data={statusData} loading={loading} />
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search deal, customer, phase…"
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border border-border/70 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-bold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2">Opportunity</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Phase</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    Loading deal timelines…
                  </td>
                </tr>
              ) : null}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No deals to show yet.
                  </td>
                </tr>
              ) : null}
              {filtered.map((row) => (
                <tr
                  key={row.opportunity_id}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`/crm/timeline/${row.opportunity_id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/crm/timeline/${row.opportunity_id}`);
                    }
                  }}
                  className="cursor-pointer border-b border-border/70 transition-colors duration-150 hover:bg-muted/30"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <GitBranch className="size-3.5 shrink-0 text-muted-foreground" style={{ color: CRM_CHART_COLORS.sky }} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {row.opportunity_name || row.opportunity_code || "Opportunity"}
                        </p>
                        {row.opportunity_code ? (
                          <p className="truncate text-[11px] text-muted-foreground">{row.opportunity_code}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.customer_name || row.account_name || "-"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{humanize(row.stage)}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={cn("font-medium", phaseTone(row.phase))}>
                      {PHASE_LABEL[row.phase] ?? humanize(row.phase)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{formatWhen(row.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
