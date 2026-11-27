"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Cable,
  Check,
  CheckCircle2,
  ClipboardCheck,
  CloudUpload,
  MapPin,
  Package,
  PieChart,
  RefreshCw,
  Server,
  ShoppingCart,
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
  ProjectsPageHeader,
  ProjectsSection,
  ProjectsViewAllLink,
  ProjectsWarnBanner,
} from "@/components/projects/projects-ui";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  formatDate,
  listProjectPoQueue,
  loadProjectsOverview,
  type Project,
  type ProjectPoQueueItem,
  type ProjectsOverview,
  type SiteInstallation,
} from "@/services/projects-portal-service";

/**
 * Current delivery flow (Project Tracking / site workflow).
 * Assignment is no longer a standalone stage — Survey owner is set from Tracking.
 */
const FLOW_STAGES = [
  { key: "intake", label: "Intake", short: "Intake", href: "/projects/projects", icon: ClipboardCheck },
  { key: "survey", label: "Survey", short: "Survey", href: "/projects/survey", icon: MapPin },
  { key: "scm", label: "SCM / Logistics", short: "SCM", href: "/projects/scm", icon: Package },
  {
    key: "onsite_delivery",
    label: "Onsite Delivery",
    short: "Onsite",
    href: "/projects/onsite_delivery",
    icon: CloudUpload,
  },
  {
    key: "material_handover",
    label: "Material Handover",
    short: "Handover",
    href: "/projects/material_handover",
    icon: Package,
  },
  {
    key: "installation",
    label: "Installation",
    short: "Install",
    href: "/projects/installation",
    icon: Server,
  },
  {
    key: "acceptance",
    label: "Acceptance",
    short: "Accept",
    href: "/projects/acceptance",
    icon: CheckCircle2,
  },
  {
    key: "completed",
    label: "Completed",
    short: "Done",
    href: "/projects/completed",
    icon: CheckCircle2,
  },
] as const;

const STAGE_COLORS = [
  PROJECTS_CHART_COLORS.sky,
  PROJECTS_CHART_COLORS.skyDark,
  PROJECTS_CHART_COLORS.teal,
  PROJECTS_CHART_COLORS.emerald,
  PROJECTS_CHART_COLORS.slate,
  PROJECTS_CHART_COLORS.amber,
  PROJECTS_CHART_COLORS.emerald,
  PROJECTS_CHART_COLORS.slate,
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
  if (stage === "configuration") return "installation";
  if (stage === "assignment") return "survey";
  if (stage === "onsite") return "onsite_delivery";
  return stage;
}

function needsSurveyOwner(site: SiteInstallation): boolean {
  if (normalizeStage(site.workflow_stage) === "completed") return false;
  return !site.survey_assignee_employee_id;
}

function newestSites(rows: SiteInstallation[], limit = 8): SiteInstallation[] {
  return [...rows]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, limit);
}

/** Role-aware Projects home - portfolio for admins, personal for all other users. */
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
  const [poQueue, setPoQueue] = useState<ProjectPoQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overview, queue] = await Promise.all([
        loadProjectsOverview(),
        listProjectPoQueue().catch(() => [] as ProjectPoQueueItem[]),
      ]);
      setData(overview);
      setPoQueue(Array.isArray(queue) ? queue : []);
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

    const active = sites.filter((s) =>
      ACTIVE_STAGES.has(normalizeStage(s.workflow_stage)),
    ).length;
    const completed = byStage("completed");
    const needSurvey = sites.filter(needsSurveyOwner).length;
    const poClouds = new Set(
      poQueue
        .map((row) => (row.cloud_name || "").trim().toLowerCase())
        .filter(Boolean),
    ).size;

    return {
      total: sites.length,
      active,
      completed,
      needSurvey,
      poQueueLines: poQueue.length,
      poClouds,
      projects: data?.projects.length ?? 0,
      byStage,
    };
  }, [data?.projects.length, poQueue, sites]);

  const stageFunnel = useMemo(
    () =>
      FLOW_STAGES.map((stage) => ({
        name: stage.label,
        count: kpis.byStage(stage.key),
      })),
    [kpis],
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
      "intake",
      "survey",
      "acceptance",
      "scm",
      "onsite_delivery",
      "material_handover",
      "installation",
    ];
    return [...sites]
      .filter((s) => ACTIVE_STAGES.has(normalizeStage(s.workflow_stage)))
      .sort((a, b) => {
        const aNeed = needsSurveyOwner(a) ? 0 : 1;
        const bNeed = needsSurveyOwner(b) ? 0 : 1;
        if (aNeed !== bNeed) return aNeed - bNeed;
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
      <ProjectsPageHeader
        title="Projects Dashboard"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              asChild
            >
              <Link href="/projects/po-queue">
                <ShoppingCart className="size-3.5" />
                PO Queue
                {kpis.poQueueLines > 0 ? (
                  <Badge variant="secondary" className="ml-1 tabular-nums">
                    {kpis.poQueueLines}
                  </Badge>
                ) : null}
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              asChild
            >
              <Link href="/projects/projects">
                <Building2 className="size-3.5" />
                Projects
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
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
        <div className="grid divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <ProjectsHeadlineStat
            label="Total sites"
            value={String(kpis.total)}
            sub={`${kpis.projects} projects`}
            loading={loading}
          />
          <ProjectsHeadlineStat
            label="In delivery"
            value={String(kpis.active)}
            sub="Active workflow"
            loading={loading}
          />
          <ProjectsHeadlineStat
            label="Need Survey owner"
            value={String(kpis.needSurvey)}
            sub="Assign from Tracking"
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

      <ProjectsSection title="Delivery flow" icon={Cable} bodyClassName="space-y-3">
        <div className="erp-scroll flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-muted/20 px-2 py-2">
          {FLOW_STAGES.map((stage, idx) => {
            const count = kpis.byStage(stage.key);
            const Icon = stage.icon;
            const isTerminal = stage.key === "completed";
            return (
              <div key={stage.key} className="flex items-center">
                <Link
                  href={stage.href}
                  className={cn(
                    "group inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200",
                    count > 0 && !isTerminal
                      ? "bg-primary/10 text-primary hover:bg-primary/15"
                      : isTerminal && count > 0
                        ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] tabular-nums",
                      count > 0 && !isTerminal
                        ? "border-primary bg-primary text-primary-foreground"
                        : isTerminal && count > 0
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-border/80 bg-background",
                    )}
                  >
                    {isTerminal && count > 0 ? (
                      <Check className="size-3" />
                    ) : (
                      <Icon className="size-3" />
                    )}
                  </span>
                  <span>{stage.short}</span>
                  <span className="tabular-nums text-[11px] opacity-80">{loading ? "—" : count}</span>
                </Link>
                {idx < FLOW_STAGES.length - 1 ? (
                  <span className="mx-0.5 text-muted-foreground/50" aria-hidden>
                    ›
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="sr-only">
          PO Queue, project intake, Survey through Acceptance, then Completed.
        </p>
      </ProjectsSection>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {FLOW_STAGES.filter((s) => s.key !== "intake" && s.key !== "completed").map((stage) => {
          const count = kpis.byStage(stage.key);
          return (
            <ProjectsKpiCard
              key={stage.key}
              variant="hero"
              label={stage.label}
              value={String(count)}
              hint="In this step"
              icon={stage.icon}
              href={stage.href}
              tone={stage.key === "acceptance" && count > 0 ? "warning" : "default"}
              loading={loading}
            />
          );
        })}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <ProjectsActivityTile
          label="PO Queue"
          value={loading ? "-" : String(kpis.poClouds || kpis.poQueueLines)}
          icon={ShoppingCart}
          tint="bg-sky-50 text-sky-800"
          href="/projects/po-queue"
        />
        <ProjectsActivityTile
          label="Projects"
          value={loading ? "-" : String(kpis.projects)}
          icon={Building2}
          tint="bg-teal-50 text-teal-800"
          href="/projects/projects"
        />
        <ProjectsActivityTile
          label="All Sites"
          value={loading ? "-" : String(kpis.total)}
          icon={Cable}
          tint="bg-slate-100 text-slate-800"
          href="/projects/site-installations"
        />
        <ProjectsActivityTile
          label="Need owners"
          value={loading ? "-" : String(kpis.needSurvey)}
          icon={Users}
          tint="bg-amber-50 text-amber-900"
          href="/projects/projects"
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <ProjectsSection
          title="Pipeline by stage"
          icon={Cable}
          badge={<Badge variant="secondary">Counts</Badge>}
          className="xl:col-span-2"
        >
          <ProjectsCountBarChart data={stageFunnel} loading={loading} />
          <ol className="mt-1 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-2">
            {FLOW_STAGES.map((stage, i) => (
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
                  {loading ? "-" : row.value}
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
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                Recent sites
              </h2>
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
                      No sites yet. Start from PO Queue.
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
                            className="cursor-pointer font-medium text-foreground transition-colors duration-200 hover:underline"
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
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                Needs attention
              </h2>
            </div>
            <ProjectsViewAllLink href="/projects/projects" />
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
                      className="min-w-0 cursor-pointer truncate text-sm font-medium text-foreground transition-colors duration-200 hover:underline"
                    >
                      {row.site_name || row.document_number}
                    </Link>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
                      {formatDate(row.created_at)}
                      <ArrowUpRight className="size-3 opacity-50" aria-hidden />
                    </span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{siteWorkflowStageLabel(row.workflow_stage)}</span>
                    <span aria-hidden>·</span>
                    <span>{siteDeliveryTypeLabel(row.delivery_type)}</span>
                    {needsSurveyOwner(row) ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="font-medium text-amber-700">Needs Survey owner</span>
                      </>
                    ) : null}
                  </p>
                </li>
              ))
            )}
          </ul>
        </ProjectsListPanel>
      </div>
    </ProjectsPage>
  );
}
