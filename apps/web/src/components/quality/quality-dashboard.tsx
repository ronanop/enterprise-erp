"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ClipboardCheck,
  FileWarning,
  RefreshCw,
  ShieldAlert,
  Siren,
  TriangleAlert,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import {
  QualityPipelineFunnel,
  QualityPpapPipeline,
  QualitySpcOocTrend,
} from "@/components/quality/quality-pipeline-funnel";
import { inspectionDetailHref, tagInspections, type TaggedInspection } from "@/components/quality/quality-routes";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  qualityQuickLinks,
  qualityWorkspaceGroups,
  resolveQualityGroupResources,
} from "@/config/quality";
import { isAuthenticated } from "@/lib/auth";
import {
  asStatus,
  countBySeverity,
  countByStatus,
  countOpenDocs,
  countRejectedResults,
  loadQualityOverview,
  type QualityOverview,
  type QualityRow,
} from "@/services/quality-service";

function recentDocs(rows: QualityRow[], limit = 6): QualityRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.created_at ?? b.document_number ?? "").localeCompare(
        String(a.created_at ?? a.document_number ?? ""),
      ),
    )
    .slice(0, limit);
}

export function QualityDashboard() {
  const router = useRouter();
  const [data, setData] = useState<QualityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadQualityOverview());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allInspections = useMemo(
    () => [
      ...tagInspections(data?.incoming ?? [], "incoming"),
      ...tagInspections(data?.inprocess ?? [], "inprocess"),
      ...tagInspections(data?.final ?? [], "final"),
    ],
    [data],
  );

  const kpis = useMemo(() => {
    if (!data) {
      return {
        openInspections: 0,
        rejectedInspections: 0,
        openNcrs: 0,
        openCapas: 0,
        criticalDefects: 0,
        openDefects: 0,
      };
    }
    return {
      openInspections: countOpenDocs(allInspections, ["completed", "cancelled", "approved"]),
      rejectedInspections: countRejectedResults(allInspections),
      openNcrs: countOpenDocs(data.ncrs, ["closed", "cancelled"]),
      openCapas: countOpenDocs(data.capas, ["closed", "cancelled", "verified"]),
      criticalDefects: countBySeverity(data.defects, ["critical"]),
      openDefects: countOpenDocs(data.defects, ["closed"]),
    };
  }, [data, allInspections]);

  const pipelineCounts = useMemo(
    () => ({
      "incoming-inspections": data?.incoming.length ?? 0,
      "inprocess-inspections": data?.inprocess.length ?? 0,
      "final-inspections": data?.final.length ?? 0,
      ncrs: data?.ncrs.length ?? 0,
      capas: data?.capas.length ?? 0,
    }),
    [data],
  );

  const recentInspections = useMemo(
    () => recentDocs(allInspections) as TaggedInspection[],
    [allInspections],
  );

  const ncrWatch = useMemo(() => {
    const rows = data?.ncrs ?? [];
    return [...rows]
      .sort((a, b) => {
        const sev = severityRank(asStatus(b.severity)) - severityRank(asStatus(a.severity));
        if (sev !== 0) return sev;
        return String(b.document_number ?? "").localeCompare(String(a.document_number ?? ""));
      })
      .slice(0, 5);
  }, [data]);

  const severityMix = useMemo(() => {
    const rows = data?.defects ?? [];
    const critical = countBySeverity(rows, ["critical"]);
    const major = countBySeverity(rows, ["major"]);
    const minor = countBySeverity(rows, ["minor"]);
    const total = critical + major + minor || 1;
    return {
      critical,
      major,
      minor,
      criticalPct: Math.round((critical / total) * 100),
      majorPct: Math.round((major / total) * 100),
      minorPct: Math.round((minor / total) * 100),
    };
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quality"
        description="Quality workspace — inspection plans, IQC/IPQC/FQC, defects, NCRs, CAPA, supplier quality, complaints, and audits."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/quality/incoming-inspections/new"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              <ClipboardCheck className="size-3.5" />
              New IQC
            </Link>
            <Link
              href="/quality/ncrs"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <FileWarning className="size-3.5" />
              NCRs
            </Link>
            <Link
              href="/quality/capas"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              CAPAs
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live quality data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some quality endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/quality/incoming-inspections" className="block cursor-pointer">
          <FinanceKpiCard
            label="Open inspections"
            value={loading ? "—" : String(kpis.openInspections)}
            hint={`${allInspections.length} total · ${kpis.rejectedInspections} rejected/rework`}
            icon={ClipboardCheck}
            tone={kpis.openInspections > 0 ? "warning" : "success"}
          />
        </Link>
        <Link href="/quality/ncrs" className="block cursor-pointer">
          <FinanceKpiCard
            label="Open NCRs"
            value={loading ? "—" : String(kpis.openNcrs)}
            hint={`${data?.ncrs.length ?? 0} NCRs · ${countByStatus(data?.ncrs ?? [], ["submitted", "approved"])} in review`}
            icon={FileWarning}
            tone={kpis.openNcrs > 0 ? "warning" : "success"}
          />
        </Link>
        <Link href="/quality/capas" className="block cursor-pointer">
          <FinanceKpiCard
            label="Open CAPAs"
            value={loading ? "—" : String(kpis.openCapas)}
            hint={`${data?.capas.length ?? 0} CAPAs · ${countByStatus(data?.capas ?? [], ["in_progress"])} in progress`}
            icon={ShieldAlert}
            tone={kpis.openCapas > 0 ? "default" : "success"}
          />
        </Link>
        <Link href="/quality/defects" className="block cursor-pointer">
          <FinanceKpiCard
            label="Critical defects"
            value={loading ? "—" : String(kpis.criticalDefects)}
            hint={`${kpis.openDefects} open · ${data?.defects.length ?? 0} defect records`}
            icon={TriangleAlert}
            tone={kpis.criticalDefects > 0 ? "danger" : "success"}
          />
        </Link>
      </div>

      <QualityPipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <QualityPpapPipeline
          counts={{
            draft: countByStatus(data?.ppaps ?? [], ["draft"]),
            submitted: countByStatus(data?.ppaps ?? [], ["submitted"]),
            approved: countByStatus(data?.ppaps ?? [], ["approved"]),
          }}
          openCount={data?.openPpaps}
          loading={loading}
        />
        <QualitySpcOocTrend readings={data?.spcReadings ?? []} loading={loading} />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/quality/scars" className="block cursor-pointer">
          <FinanceKpiCard
            label="Open SCARs"
            value={loading ? "—" : String(data?.openScars ?? 0)}
            hint={`${data?.scars.length ?? 0} SCARs · ${countByStatus(data?.scars ?? [], ["issued", "responded"])} awaiting response`}
            icon={FileWarning}
            tone={(data?.openScars ?? 0) > 0 ? "warning" : "success"}
          />
        </Link>
        <Link
          href="/quality/recalls"
          className="block cursor-pointer rounded-xl border-2 border-[#DC2626] bg-[#FEF2F2] p-0.5 shadow-sm transition-[box-shadow,border-color] duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
        >
          <FinanceKpiCard
            label="Active recalls"
            value={loading ? "—" : String(data?.activeRecalls ?? 0)}
            hint={`${data?.recalls.length ?? 0} campaigns · announced / in progress`}
            icon={Siren}
            tone="danger"
          />
        </Link>
        <Link href="/quality/warranty-claims" className="block cursor-pointer">
          <FinanceKpiCard
            label="Recent warranty claims"
            value={loading ? "—" : String(data?.recentWarrantyClaims.length ?? 0)}
            hint={`${data?.warrantyClaims.length ?? 0} claims total`}
            icon={ShieldAlert}
            tone="default"
          />
        </Link>
        <Link href="/quality/pfmeas" className="block cursor-pointer">
          <FinanceKpiCard
            label="PFMEA by status"
            value={loading ? "—" : String(data?.pfmeas.length ?? 0)}
            hint={`Active ${data?.pfmeaByStatus.active ?? 0} · draft ${data?.pfmeaByStatus.draft ?? 0} · obsolete ${data?.pfmeaByStatus.obsolete ?? 0}`}
            icon={ClipboardCheck}
            tone="default"
          />
        </Link>
      </div>

      {(data?.recentWarrantyClaims.length ?? 0) > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Recent warranty claims</h2>
              <p className="text-[11px] text-muted-foreground">Latest field claims</p>
            </div>
            <Link
              href="/quality/warranty-claims"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {(data?.recentWarrantyClaims ?? []).slice(0, 5).map((row, idx) => (
              <li key={String(row.id ?? idx)}>
                <Link
                  href={`/quality/warranty-claims/${String(row.id)}`}
                  className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-sm transition-colors duration-200 hover:bg-accent/30"
                >
                  <span className="font-medium text-primary">{String(row.document_number ?? "—")}</span>
                  <FinanceStatusBadge status={asStatus(row.status) || String(row.status ?? "")} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {qualityQuickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-card px-3.5 py-3 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-md"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-medium tracking-tight">
                  {link.title}
                  <ArrowUpRight className="size-3 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </span>
                <span className="block text-[11px] text-muted-foreground">{link.description}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium tracking-tight">Workspace</h2>
          <Badge variant="secondary">{qualityWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {qualityWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveQualityGroupResources(group);
            return (
              <div
                key={group.key}
                className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium tracking-tight">{group.title}</h3>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {group.description}
                    </p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {resources.map((resource) => (
                    <li key={resource.key}>
                      <Link
                        href={`/quality/${resource.key}`}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors duration-200 hover:bg-accent/50"
                      >
                        <span className="font-medium text-foreground">{resource.title}</span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {resource.description}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Recent inspections</h2>
              <p className="text-[11px] text-muted-foreground">Incoming · in-process · final</p>
            </div>
            <Link
              href="/quality/incoming-inspections"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[440px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Document</th>
                  <th className="px-4 py-2.5 font-medium">Result</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : recentInspections.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                      No inspections yet.
                    </td>
                  </tr>
                ) : (
                  recentInspections.map((row, idx) => {
                    const href = inspectionDetailHref(row._inspectionKind, String(row.id));
                    return (
                    <tr
                      key={String(row.id ?? idx)}
                      className="cursor-pointer border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                      onClick={() => router.push(href)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") router.push(href);
                      }}
                      tabIndex={0}
                      role="link"
                    >
                      <td className="max-w-[200px] truncate px-4 py-2.5">
                        <p className="font-medium text-primary">
                          {String(row.document_number ?? "—")}
                        </p>
                      </td>
                      <td className="px-4 py-2.5">
                        <FinanceStatusBadge
                          status={asStatus(row.result) || String(row.result ?? "pending")}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <FinanceStatusBadge
                          status={asStatus(row.status) || String(row.status ?? "")}
                        />
                      </td>
                    </tr>
                  );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">NCR watch</h2>
              <p className="text-[11px] text-muted-foreground">Highest severity first</p>
            </div>
            <Link
              href="/quality/ncrs"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : ncrWatch.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">No NCRs yet.</li>
            ) : (
              ncrWatch.map((row, idx) => {
                const ncrId = row.id != null ? String(row.id) : null;
                const href = ncrId ? `/quality/ncrs/${ncrId}` : null;
                return (
                <li
                  key={String(row.id ?? idx)}
                  className={`px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30 ${
                    href ? "cursor-pointer" : ""
                  }`}
                  onClick={href ? () => router.push(href) : undefined}
                  onKeyDown={
                    href
                      ? (e) => {
                          if (e.key === "Enter") router.push(href);
                        }
                      : undefined
                  }
                  tabIndex={href ? 0 : undefined}
                  role={href ? "link" : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-primary">
                      {String(row.document_number ?? "—")}
                    </p>
                    <FinanceStatusBadge status={String(row.status ?? "draft")} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Severity {String(row.severity ?? "minor").replaceAll("_", " ")}
                  </p>
                </li>
              );
              })
            )}
          </ul>
        </div>

        <Link href="/quality/defects" className="block cursor-pointer rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-md">
          <div className="mb-3">
            <h2 className="text-sm font-medium tracking-tight">Defect severity mix</h2>
            <p className="text-[11px] text-muted-foreground">Critical / major / minor — click to view defects</p>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              <SeverityBar
                label="Critical"
                count={severityMix.critical}
                pct={severityMix.criticalPct}
                barClass="bg-red-600"
              />
              <SeverityBar
                label="Major"
                count={severityMix.major}
                pct={severityMix.majorPct}
                barClass="bg-amber-500"
              />
              <SeverityBar
                label="Minor"
                count={severityMix.minor}
                pct={severityMix.minorPct}
                barClass="bg-slate-500"
              />
              <p className="pt-1 text-[11px] text-muted-foreground">
                Open complaints{" "}
                {countOpenDocs(data?.complaints ?? [], ["closed", "cancelled"])} · Audits{" "}
                {data?.audits.length ?? 0} · Plans {countByStatus(data?.plans ?? [], ["active"])}{" "}
                active
              </p>
            </div>
          )}
        </Link>
      </div>
    </div>
  );
}

function severityRank(severity: string): number {
  if (severity === "critical") return 3;
  if (severity === "major") return 2;
  if (severity === "minor") return 1;
  return 0;
}

function SeverityBar({
  label,
  count,
  pct,
  barClass,
}: {
  label: string;
  count: number;
  pct: number;
  barClass: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {count} · {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${barClass}`}
          style={{ width: `${Math.max(4, pct)}%` }}
          role="presentation"
        />
      </div>
    </div>
  );
}
