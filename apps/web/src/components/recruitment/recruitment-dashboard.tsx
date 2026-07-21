"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  FileCheck2,
  RefreshCw,
  UserRoundSearch,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { RecruitmentPipelineFunnel } from "@/components/recruitment/recruitment-pipeline-funnel";
import { Badge } from "@/components/ui/badge";
import {
  recruitmentQuickLinks,
  recruitmentWorkspaceGroups,
  resolveRecruitmentGroupResources,
} from "@/config/recruitment";
import { isAuthenticated } from "@/lib/auth";
import {
  asNumber,
  asStatus,
  candidateDisplayName,
  countByStatus,
  countOpenDocs,
  formatInr,
  loadRecruitmentOverview,
  sumField,
  type RecruitmentOverview,
  type RecruitmentRow,
} from "@/services/recruitment-service";

function recentApplications(rows: RecruitmentRow[], limit = 6): RecruitmentRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.applied_at ?? b.document_number ?? "").localeCompare(
        String(a.applied_at ?? a.document_number ?? ""),
      ),
    )
    .slice(0, limit);
}

export function RecruitmentDashboard() {
  const [data, setData] = useState<RecruitmentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadRecruitmentOverview());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const candidateById = useMemo(() => {
    const map = new Map<string, RecruitmentRow>();
    for (const row of data?.candidates ?? []) {
      if (row.id != null) map.set(String(row.id), row);
    }
    return map;
  }, [data]);

  const kpis = useMemo(() => {
    if (!data) {
      return {
        openRequisitions: 0,
        pipelineApps: 0,
        scheduledInterviews: 0,
        openOffers: 0,
        openings: 0,
        offerCtc: 0,
      };
    }
    return {
      openRequisitions: countByStatus(data.requisitions, [
        "open",
        "approved",
        "submitted",
      ]),
      pipelineApps: countByStatus(data.applications, [
        "applied",
        "screening",
        "interview",
        "selected",
        "offer",
        "on_hold",
      ]),
      scheduledInterviews: countByStatus(data.interviews, ["scheduled"]),
      openOffers: countOpenDocs(data.offers, [
        "accepted",
        "rejected",
        "expired",
        "withdrawn",
        "cancelled",
      ]),
      openings: sumField(data.requisitions, "openings_count"),
      offerCtc: sumField(data.offers, "offered_ctc"),
    };
  }, [data]);

  const pipelineCounts = useMemo(
    () => ({
      "job-requisitions": data?.requisitions.length ?? 0,
      "job-postings": data?.postings.length ?? 0,
      applications: data?.applications.length ?? 0,
      interviews: data?.interviews.length ?? 0,
      offers: data?.offers.length ?? 0,
      onboarding: data?.onboarding.length ?? 0,
    }),
    [data],
  );

  const recent = useMemo(
    () => recentApplications(data?.applications ?? []),
    [data],
  );

  const interviewWatch = useMemo(() => {
    const rows = data?.interviews ?? [];
    return [...rows]
      .sort((a, b) =>
        String(b.scheduled_at ?? "").localeCompare(String(a.scheduled_at ?? "")),
      )
      .slice(0, 5);
  }, [data]);

  const applicationStatusMix = useMemo(() => {
    const rows = data?.applications ?? [];
    const stages = [
      { key: "applied", label: "Applied", barClass: "bg-slate-400" },
      { key: "screening", label: "Screening", barClass: "bg-sky-600" },
      { key: "interview", label: "Interview", barClass: "bg-teal-600" },
      { key: "selected", label: "Selected", barClass: "bg-emerald-600" },
      { key: "offer", label: "Offer", barClass: "bg-amber-500" },
      { key: "hired", label: "Hired", barClass: "bg-slate-600" },
    ] as const;
    const total = rows.length || 1;
    return stages.map((s) => {
      const count = countByStatus(rows, [s.key]);
      return { ...s, count, pct: Math.round((count / total) * 100) };
    });
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recruitment"
        description="Talent acquisition — requisitions, candidates, applications, interviews, offers, verification, and onboarding."
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
              href="/recruitment/candidates"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <UserRoundSearch className="size-3.5" />
              Candidates
            </Link>
            <Link
              href="/recruitment/interviews"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Interviews
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live recruitment data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some recruitment endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Open requisitions"
          value={loading ? "—" : String(kpis.openRequisitions)}
          hint={`${kpis.openings} openings · ${data?.requisitions.length ?? 0} total`}
          icon={BriefcaseBusiness}
          tone={kpis.openRequisitions > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Pipeline applications"
          value={loading ? "—" : String(kpis.pipelineApps)}
          hint={`${data?.candidates.length ?? 0} candidates · ${data?.applications.length ?? 0} apps`}
          icon={UserRoundSearch}
          tone={kpis.pipelineApps > 0 ? "default" : "success"}
        />
        <FinanceKpiCard
          label="Scheduled interviews"
          value={loading ? "—" : String(kpis.scheduledInterviews)}
          hint={`${countByStatus(data?.interviews ?? [], ["completed"])} completed · ${data?.interviews.length ?? 0} total`}
          icon={CalendarClock}
          tone={kpis.scheduledInterviews > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Open offers"
          value={loading ? "—" : String(kpis.openOffers)}
          hint={`${formatInr(kpis.offerCtc)} CTC · ${countOpenDocs(data?.onboarding ?? [], ["completed", "cancelled", "failed"])} onboarding`}
          icon={FileCheck2}
          tone={kpis.openOffers > 0 ? "warning" : "success"}
        />
      </div>

      <RecruitmentPipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {recruitmentQuickLinks.map((link) => {
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
                <span className="block text-[11px] text-muted-foreground">
                  {link.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium tracking-tight">Workspace</h2>
          <Badge variant="secondary">{recruitmentWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {recruitmentWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveRecruitmentGroupResources(group);
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
                        href={`/recruitment/${resource.key}`}
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
              <h2 className="text-sm font-medium tracking-tight">Recent applications</h2>
              <p className="text-[11px] text-muted-foreground">Pipeline intake</p>
            </div>
            <Link
              href="/recruitment/applications"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Application</th>
                  <th className="px-4 py-2.5 font-medium">Candidate</th>
                  <th className="px-4 py-2.5 font-medium">Stage</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No applications yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((row, idx) => {
                    const candidate = candidateById.get(String(row.candidate_id ?? ""));
                    return (
                      <tr
                        key={String(row.id ?? idx)}
                        className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                      >
                        <td className="max-w-[160px] truncate px-4 py-2.5">
                          <p className="font-medium text-foreground">
                            {String(row.document_number ?? "—")}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {String(row.applied_at ?? "").slice(0, 10)}
                          </p>
                        </td>
                        <td className="max-w-[140px] truncate px-4 py-2.5 text-xs text-foreground">
                          {candidate ? candidateDisplayName(candidate) : "—"}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {String(row.current_stage_code ?? "—")}
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
              <h2 className="text-sm font-medium tracking-tight">Interview watch</h2>
              <p className="text-[11px] text-muted-foreground">Upcoming / recent</p>
            </div>
            <Link
              href="/recruitment/interviews"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : interviewWatch.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No interviews yet.
              </li>
            ) : (
              interviewWatch.map((row, idx) => {
                const candidate = candidateById.get(String(row.candidate_id ?? ""));
                return (
                  <li
                    key={String(row.id ?? idx)}
                    className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">
                        {String(row.document_number ?? "—")}
                      </p>
                      <FinanceStatusBadge
                        status={asStatus(row.status) || String(row.status ?? "")}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {candidate ? candidateDisplayName(candidate) : "Candidate"} ·{" "}
                      {String(row.interview_type ?? "")} ·{" "}
                      {String(row.scheduled_at ?? "").slice(0, 16).replace("T", " ")}
                    </p>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-medium tracking-tight">Application status mix</h2>
            <p className="text-[11px] text-muted-foreground">Pipeline stages</p>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              {applicationStatusMix.map((s) => (
                <div key={s.key}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">{s.label}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {s.count} · {s.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${s.barClass}`}
                      style={{ width: `${Math.max(4, s.pct)}%` }}
                      role="presentation"
                    />
                  </div>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-muted-foreground">
                Published postings {countByStatus(data?.postings ?? [], ["published"])} · BGV
                open{" "}
                {countOpenDocs(data?.bgv ?? [], [
                  "cleared",
                  "failed",
                  "waived",
                  "cancelled",
                ])}{" "}
                · Talent pool {countByStatus(data?.talentPools ?? [], ["active"])}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
