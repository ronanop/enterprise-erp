"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Cable,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  Package,
  PieChart,
  RefreshCw,
  Server,
  Users,
} from "lucide-react";

import {
  siteDeliveryTypeLabel,
  siteWorkflowStageLabel,
} from "@/components/projects/projects-domain";
import { ProjectsMemberDashboard } from "@/components/projects/projects-member-dashboard";
import {
  PROJECTS_CHART_COLORS,
  ProjectsActivityTile,
  ProjectsCountBarChart,
  ProjectsDonutChart,
  ProjectsHeadlineBand,
  ProjectsHeadlineStat,
  ProjectsIconBadge,
  ProjectsKpiCard,
  ProjectsListPanel,
  ProjectsPage,
  ProjectsSection,
  ProjectsViewAllLink,
  ProjectsWarnBanner,
} from "@/components/projects/projects-ui";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { isAuthenticated } from "@/lib/auth";
import {
  formatDate,
  loadProjectsOverview,
  type Project,
  type ProjectsOverview,
  type SiteInstallation,
} from "@/services/projects-portal-service";

/** Delivery workflow stages shown on the dashboard funnel. */
const DELIVERY_STAGES = [
  { key: "intake", label: "Intake & RFAI", href: "/projects/intake", icon: ClipboardCheck },
  { key: "assignment", label: "Assign owners", href: "/projects/assignment", icon: Users },
  { key: "survey", label: "Survey", href: "/projects/survey", icon: MapPin },
  { key: "scm", label: "SCM / Logistics", href: "/projects/scm", icon: Package },
  {
    key: "onsite_delivery",
    label: "Onsite Delivery",
    href: "/projects/onsite_delivery",
    icon: MapPin,
  },
  {
    key: "material_handover",
    label: "Material Handover",
    href: "/projects/material_handover",
    icon: Package,
  },
  {
    key: "installation",
    label: "Installation & Configuration",
    href: "/projects/installation",
    icon: Server,
  },
  { key: "acceptance", label: "Acceptance", href: "/projects/acceptance", icon: CheckCircle2 },
  { key: "completed", label: "Completed", href: "/projects/completed", icon: CheckCircle2 },
] as const;

const STAGE_COLORS = [
  PROJECTS_CHART_COLORS.sky,
  PROJECTS_CHART_COLORS.skyDark,
  PROJECTS_CHART_COLORS.teal,
  PROJECTS_CHART_COLORS.emerald,
  PROJECTS_CHART_COLORS.slate,
  PROJECTS_CHART_COLORS.amber,
  PROJECTS_CHART_COLORS.emerald,
] as const;

const ACTIVE_STAGES = new Set([
  "intake",
  "assignment",
  "survey",
  "scm",
  "onsite",
  "onsite_delivery",
  "material_handover",
  "installation",
  "configuration",
  "acceptance",
]);

function normalizeStage(stage: string): string {
  return stage === "configuration" ? "installation" : stage;
}

function newestSites(rows: SiteInstallation[], limit = 8): SiteInstallation[] {
  return [...rows]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, limit);
}

/** Role-aware Projects home — portfolio for admins, personal for all other users. */
export function ProjectsDashboard() {
  const { loading: authLoading, projectModuleAdmin } = useAuthUser();

  if (authLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  if (!projectModuleAdmin) {
    return <ProjectsMemberDashboard />;
  }

  return <ProjectsAdminDashboard />;
}

function ProjectsAdminDashboard() {
  const [data, setData] = useState<ProjectsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadProjectsOverview());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sites = data?.siteInstallations ?? [];

  const kpis = useMemo(() => {
    const byStage = (key: string) =>
      sites.filter((s) => normalizeStage(s.workflow_stage) === key).length;

    const active = sites.filter((s) => ACTIVE_STAGES.has(normalizeStage(s.workflow_stage))).length;
    const completed = byStage("completed");
    const needsOwners = byStage("assignment");
    const inSurvey = byStage("survey");
    const inScm = byStage("scm");
    const inInstall = byStage("installation");
    const inAcceptance = byStage("acceptance");

    return {
      total: sites.length,
      active,
      completed,
      needsOwners,
      inSurvey,
      inScm,
      inInstall,
      inAcceptance,
      projects: data?.projects.length ?? 0,
    };
  }, [data?.projects.length, sites]);

  const stageFunnel = useMemo(
    () =>
      DELIVERY_STAGES.map((stage) => ({
        name: stage.label,
        count: sites.filter((s) => normalizeStage(s.workflow_stage) === stage.key).length,
      })),
    [sites],
  );

  const deliveryTypeMix = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of sites) {
      const key = row.delivery_type || "unknown";
      totals.set(key, (totals.get(key) ?? 0) + 1);
    }
    return [...totals.entries()]
      .map(([type, value]) => ({
        name: siteDeliveryTypeLabel(type),
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [sites]);

  const recentSites = useMemo(() => newestSites(sites), [sites]);

  const attentionQueue = useMemo(() => {
    const priority = [
      "assignment",
      "intake",
      "acceptance",
      "survey",
      "scm",
      "onsite_delivery",
      "material_handover",
      "onsite",
      "installation",
    ];
    return [...sites]
      .filter((s) => ACTIVE_STAGES.has(normalizeStage(s.workflow_stage)))
      .sort((a, b) => {
        const ai = priority.indexOf(normalizeStage(a.workflow_stage));
        const bi = priority.indexOf(normalizeStage(b.workflow_stage));
        if (ai !== bi) return ai - bi;
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      })
      .slice(0, 8);
  }, [sites]);

  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of data?.projects ?? []) map.set(p.id, p);
    return map;
  }, [data?.projects]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) || (!authenticated && Boolean(data?.partial));

  return (
    <ProjectsPage>
      <PageHeader
        title="Site Delivery Dashboard"
        description="Track site installation requests across Intake → Assign → Survey → SCM → Installation & Configuration → Acceptance."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {authBlocked ? (
        <ProjectsWarnBanner>
          Sign in to load live delivery data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </ProjectsWarnBanner>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <ProjectsHeadlineBand>
        <div className="grid divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <ProjectsHeadlineStat
            label="Total sites"
            value={String(kpis.total)}
            sub={`${kpis.projects} projects`}
            loading={loading}
          />
          <ProjectsHeadlineStat
            label="In delivery"
            value={String(kpis.active)}
            sub="Not yet completed"
            loading={loading}
          />
          <ProjectsHeadlineStat
            label="Need owners"
            value={String(kpis.needsOwners)}
            sub="Assign Survey owner"
            loading={loading}
          />
          <ProjectsHeadlineStat
            label="Completed"
            value={String(kpis.completed)}
            sub="Handover finished"
            loading={loading}
          />
        </div>
      </ProjectsHeadlineBand>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <ProjectsKpiCard
          label="Survey queue"
          value={String(kpis.inSurvey)}
          hint="Sites in Survey"
          icon={MapPin}
          href="/projects/survey"
          loading={loading}
        />
        <ProjectsKpiCard
          label="SCM / Logistics"
          value={String(kpis.inScm)}
          hint="Material movement"
          icon={Package}
          href="/projects/scm"
          loading={loading}
        />
        <ProjectsKpiCard
          label="Installation"
          value={String(kpis.inInstall)}
          hint="Install & configure"
          icon={Server}
          href="/projects/installation"
          loading={loading}
        />
        <ProjectsKpiCard
          label="Acceptance"
          value={String(kpis.inAcceptance)}
          hint="Handover / HW-AT"
          icon={CheckCircle2}
          tone={kpis.inAcceptance > 0 ? "warning" : "success"}
          href="/projects/acceptance"
          loading={loading}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <ProjectsSection
          title="Delivery pipeline"
          subtitle="Sites by workflow stage"
          icon={Cable}
          badge={<Badge variant="secondary">Counts</Badge>}
          className="xl:col-span-2"
        >
          <ProjectsCountBarChart data={stageFunnel} loading={loading} />
          <ol className="mt-1 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-2">
            {DELIVERY_STAGES.map((stage, i) => (
              <li key={stage.key}>
                <Link
                  href={stage.href}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }}
                  />
                  {stage.label}
                </Link>
              </li>
            ))}
          </ol>
        </ProjectsSection>

        <ProjectsSection
          title="Delivery scope"
          subtitle="Sites by install type"
          icon={PieChart}
          badge={<Badge variant="secondary">Share</Badge>}
        >
          <ProjectsDonutChart data={deliveryTypeMix} loading={loading} />
          <ul className="mt-1 grid gap-y-1 border-t border-border/60 pt-2">
            {deliveryTypeMix.map((row, i) => (
              <li key={row.name} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }}
                  />
                  {row.name}
                </span>
                <span className="font-medium tabular-nums text-foreground">
                  {loading ? "—" : row.value}
                </span>
              </li>
            ))}
            {!loading && deliveryTypeMix.length === 0 ? (
              <li className="text-[11px] text-muted-foreground">No sites yet.</li>
            ) : null}
          </ul>
        </ProjectsSection>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <ProjectsListPanel>
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <ProjectsIconBadge icon={Cable} />
              <div>
                <h2 className="text-base font-extrabold tracking-tight">Recent sites</h2>
                <p className="text-[11px] text-muted-foreground">Newest installation requests</p>
              </div>
            </div>
            <ProjectsViewAllLink href="/projects/site-installations" />
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-110 text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Site</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Stage</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3">
                        <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                        <div className="mt-1.5 h-2.5 w-16 animate-pulse rounded bg-muted/70" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                      </td>
                    </tr>
                  ))
                ) : recentSites.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No site installations yet. Create a site request to begin.
                    </td>
                  </tr>
                ) : (
                  recentSites.map((row) => {
                    const project = projectById.get(row.project_id);
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                      >
                        <td className="max-w-50 truncate px-4 py-2.5">
                          <Link
                            href={`/projects/projects/${row.project_id}`}
                            className="cursor-pointer font-medium text-foreground hover:underline"
                          >
                            {row.site_name || row.document_number}
                          </Link>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {row.document_number}
                            {project ? ` · ${project.project_code}` : ""}
                            {row.circle ? ` · ${row.circle}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {siteDeliveryTypeLabel(row.delivery_type)}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {siteWorkflowStageLabel(row.workflow_stage)}
                        </td>
                        <td className="px-4 py-2.5">
                          <FinanceStatusBadge status={row.status} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </ProjectsListPanel>

        <ProjectsListPanel>
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <ProjectsIconBadge icon={Users} />
              <div>
                <h2 className="text-base font-extrabold tracking-tight">Needs attention</h2>
                <p className="text-[11px] text-muted-foreground">
                  Active sites by stage priority
                </p>
              </div>
            </div>
            <ProjectsViewAllLink href="/projects/assignment" />
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
                    <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="mt-2 h-2.5 w-28 animate-pulse rounded bg-muted/70" />
                </li>
              ))
            ) : attentionQueue.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No active sites in the pipeline.
              </li>
            ) : (
              attentionQueue.map((row) => (
                <li
                  key={row.id}
                  className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/projects/projects/${row.project_id}`}
                      className="min-w-0 cursor-pointer truncate text-sm font-medium text-foreground hover:underline"
                    >
                      {row.site_name || row.document_number}
                    </Link>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatDate(row.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{siteWorkflowStageLabel(row.workflow_stage)}</span>
                    <span>·</span>
                    <span>{siteDeliveryTypeLabel(row.delivery_type)}</span>
                    {row.rfai_number ? (
                      <>
                        <span>·</span>
                        <span>RFAI {row.rfai_number}</span>
                      </>
                    ) : null}
                  </p>
                </li>
              ))
            )}
          </ul>
        </ProjectsListPanel>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {DELIVERY_STAGES.filter((s) => s.key !== "completed")
          .slice(0, 4)
          .map((stage, i) => {
            const count = sites.filter(
              (s) => normalizeStage(s.workflow_stage) === stage.key,
            ).length;
            const Icon = stage.icon;
            const tints = [
              "bg-sky-50 text-sky-800",
              "bg-indigo-50 text-indigo-800",
              "bg-teal-50 text-teal-800",
              "bg-amber-50 text-amber-900",
            ] as const;
            return (
              <ProjectsActivityTile
                key={stage.key}
                label={stage.label}
                value={loading ? "—" : String(count)}
                icon={Icon}
                tint={tints[i % tints.length]}
                href={stage.href}
              />
            );
          })}
      </div>
    </ProjectsPage>
  );
}
