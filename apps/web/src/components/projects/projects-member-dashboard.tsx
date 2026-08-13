"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Briefcase,
  CheckCircle2,
  FolderKanban,
  Lock,
  MapPin,
  Package,
  RefreshCw,
  Server,
  CloudUpload,
} from "lucide-react";

import { MyJobOpenStepButton } from "@/components/projects/my-job-open-step-button";
import { WorkflowStepBlockedDialog } from "@/components/projects/workflow-step-blocked-dialog";
import { siteDeliveryTypeLabel } from "@/components/projects/projects-domain";
import {
  PROJECTS_CHART_COLORS,
  ProjectsCountBarChart,
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
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth";
import {
  formatDate,
  listPortfolioFollowUps,
  listProjectCompletedJobs,
  listProjectMyJobs,
  type ProjectMyJob,
  type ProjectPortfolioFollowUp,
} from "@/services/projects-portal-service";

const STAGE_ORDER = ["survey", "scm", "onsite", "installation", "acceptance"] as const;

const STAGE_ICONS = {
  survey: MapPin,
  scm: Package,
  onsite: MapPin,
  installation: Server,
  acceptance: CloudUpload,
} as const;

const STAGE_COLORS = [
  PROJECTS_CHART_COLORS.sky,
  PROJECTS_CHART_COLORS.teal,
  PROJECTS_CHART_COLORS.amber,
  PROJECTS_CHART_COLORS.emerald,
  PROJECTS_CHART_COLORS.slate,
] as const;

function normalizeAssignedStage(stage: string): string {
  return stage === "configuration" ? "installation" : stage;
}

export function ProjectsMemberDashboard() {
  const [openJobs, setOpenJobs] = useState<ProjectMyJob[]>([]);
  const [completedJobs, setCompletedJobs] = useState<ProjectMyJob[]>([]);
  const [followUps, setFollowUps] = useState<ProjectPortfolioFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [open, completed, fus] = await Promise.all([
        listProjectMyJobs().catch(() => [] as ProjectMyJob[]),
        listProjectCompletedJobs().catch(() => [] as ProjectMyJob[]),
        listPortfolioFollowUps().catch(() => [] as ProjectPortfolioFollowUp[]),
      ]);
      setOpenJobs(Array.isArray(open) ? open : []);
      setCompletedJobs(Array.isArray(completed) ? completed : []);
      setFollowUps(Array.isArray(fus) ? fus : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const readyJobs = useMemo(
    () => openJobs.filter((j) => j.can_open_form !== false),
    [openJobs],
  );
  const waitingJobs = useMemo(
    () => openJobs.filter((j) => j.can_open_form === false),
    [openJobs],
  );
  const openFollowUps = useMemo(
    () => followUps.filter((f) => !f.has_reply).length,
    [followUps],
  );

  const stageFunnel = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const job of openJobs) {
      const key = normalizeAssignedStage(job.assigned_stage);
      const prev = counts.get(key);
      counts.set(key, {
        label: job.stage_label || key,
        count: (prev?.count ?? 0) + 1,
      });
    }
    return STAGE_ORDER.filter((key) => counts.has(key)).map((key) => ({
      name: counts.get(key)!.label,
      count: counts.get(key)!.count,
    }));
  }, [openJobs]);

  const recentOpen = useMemo(
    () =>
      [...openJobs]
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .slice(0, 8),
    [openJobs],
  );

  const recentCompleted = useMemo(
    () =>
      [...completedJobs]
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .slice(0, 6),
    [completedJobs],
  );

  return (
    <ProjectsPage>
      <PageHeader
        title="My Delivery Dashboard"
        description="Your assigned site steps — open work, waiting steps, completed jobs, and follow-ups."
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
            <Link
              href="/projects/my-jobs"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <Briefcase className="size-3.5" />
              My Jobs
            </Link>
            <Link
              href="/projects/completed-jobs"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Completed Jobs
            </Link>
          </div>
        }
      />

      {!authenticated ? (
        <ProjectsWarnBanner>
          Sign in to load your assigned work.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </ProjectsWarnBanner>
      ) : null}

      <ProjectsHeadlineBand>
        <div className="grid divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <ProjectsHeadlineStat
            label="Open jobs"
            value={String(openJobs.length)}
            sub="Assigned to you"
            loading={loading}
          />
          <ProjectsHeadlineStat
            label="Ready to open"
            value={String(readyJobs.length)}
            sub="Can work now"
            loading={loading}
          />
          <ProjectsHeadlineStat
            label="Waiting"
            value={String(waitingJobs.length)}
            sub="Prior step not done"
            loading={loading}
          />
          <ProjectsHeadlineStat
            label="Completed"
            value={String(completedJobs.length)}
            sub="Finished steps"
            loading={loading}
          />
        </div>
      </ProjectsHeadlineBand>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <ProjectsKpiCard
          label="My Jobs"
          value={String(openJobs.length)}
          hint="Active assigned steps"
          icon={Briefcase}
          href="/projects/my-jobs"
          loading={loading}
        />
        <ProjectsKpiCard
          label="Ready now"
          value={String(readyJobs.length)}
          hint="Open these first"
          icon={MapPin}
          href="/projects/my-jobs"
          tone={readyJobs.length > 0 ? "success" : "default"}
          loading={loading}
        />
        <ProjectsKpiCard
          label="Follow-ups"
          value={String(openFollowUps)}
          hint="Awaiting your reply"
          icon={Bell}
          href="/projects/follow-ups"
          tone={openFollowUps > 0 ? "warning" : "default"}
          loading={loading}
        />
        <ProjectsKpiCard
          label="My projects"
          value={String(
            new Set([...openJobs, ...completedJobs].map((j) => j.project_id)).size,
          )}
          hint="Projects you touch"
          icon={FolderKanban}
          href="/projects/projects"
          loading={loading}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <ProjectsSection
          title="My pipeline"
          subtitle="Open jobs by your assigned step"
          icon={Briefcase}
          badge={<Badge variant="secondary">Counts</Badge>}
          className="xl:col-span-2"
        >
          <ProjectsCountBarChart data={stageFunnel} loading={loading} />
          <ol className="mt-1 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-2">
            {STAGE_ORDER.map((key, i) => {
              const Icon = STAGE_ICONS[key];
              const row = stageFunnel.find(
                (s) => s.name.toLowerCase().includes(key) || normalizeAssignedStage(key) === key,
              );
              const count =
                openJobs.filter((j) => normalizeAssignedStage(j.assigned_stage) === key)
                  .length;
              if (count === 0 && !row) return null;
              return (
                <li key={key}>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }}
                    />
                    <Icon className="size-3" aria-hidden />
                    {key === "scm"
                      ? "SCM"
                      : key === "onsite"
                        ? "On-site"
                        : key.charAt(0).toUpperCase() + key.slice(1)}
                    <span className="font-medium tabular-nums text-foreground">{count}</span>
                  </span>
                </li>
              );
            })}
            {!loading && openJobs.length === 0 ? (
              <li className="text-[11px] text-muted-foreground">No open jobs assigned yet.</li>
            ) : null}
          </ol>
        </ProjectsSection>

        <ProjectsSection
          title="Quick links"
          subtitle="Jump to your workspace"
          icon={FolderKanban}
        >
          <div className="grid gap-2">
            {[
              { href: "/projects/my-jobs", label: "My Jobs", icon: Briefcase },
              { href: "/projects/completed-jobs", label: "Completed Jobs", icon: CheckCircle2 },
              { href: "/projects/follow-ups", label: "Follow ups", icon: Bell },
              { href: "/projects/projects", label: "My Projects", icon: FolderKanban },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/70 px-3 py-2.5 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-muted/60"
              >
                <item.icon className="size-4 text-muted-foreground" aria-hidden />
                {item.label}
              </Link>
            ))}
          </div>
        </ProjectsSection>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <ProjectsListPanel>
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <ProjectsIconBadge icon={Briefcase} />
              <div>
                <h2 className="text-base font-extrabold tracking-tight">Open jobs</h2>
                <p className="text-[11px] text-muted-foreground">Steps assigned to you</p>
              </div>
            </div>
            <ProjectsViewAllLink href="/projects/my-jobs" />
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-110 text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Step</th>
                  <th className="px-4 py-2.5 font-medium">Project / Site</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3">
                        <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  ))
                ) : recentOpen.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No open jobs. When a stage is assigned to you, it appears here.
                    </td>
                  </tr>
                ) : (
                  recentOpen.map((job) => (
                    <tr
                      key={`${job.site_installation_id}:${job.assigned_stage}`}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {job.stage_label}
                      </td>
                      <td className="max-w-50 truncate px-4 py-2.5">
                        <Link
                          href={`/projects/projects/${job.project_id}`}
                          className="cursor-pointer font-medium text-foreground hover:underline"
                        >
                          {job.project_name}
                        </Link>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {job.site_name || job.document_number}
                          {" · "}
                          {siteDeliveryTypeLabel(job.delivery_type)}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {job.can_open_form === false ? (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <Lock className="size-3" aria-hidden />
                            Waiting
                          </span>
                        ) : (
                          <span className="text-emerald-700">Ready</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <MyJobOpenStepButton job={job} onBlocked={setBlockedMessage} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ProjectsListPanel>

        <ProjectsListPanel>
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <ProjectsIconBadge icon={CheckCircle2} />
              <div>
                <h2 className="text-base font-extrabold tracking-tight">Recently completed</h2>
                <p className="text-[11px] text-muted-foreground">Steps you finished</p>
              </div>
            </div>
            <ProjectsViewAllLink href="/projects/completed-jobs" />
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-110 text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Step</th>
                  <th className="px-4 py-2.5 font-medium">Project / Site</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                  <th className="px-4 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3">
                        <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  ))
                ) : recentCompleted.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No completed steps yet.
                    </td>
                  </tr>
                ) : (
                  recentCompleted.map((job) => (
                    <tr
                      key={`${job.site_installation_id}:${job.assigned_stage}:done`}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {job.stage_label}
                      </td>
                      <td className="max-w-50 truncate px-4 py-2.5">
                        <Link
                          href={`/projects/projects/${job.project_id}`}
                          className="cursor-pointer font-medium text-foreground hover:underline"
                        >
                          {job.project_name}
                        </Link>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {job.site_name || job.document_number}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {formatDate(job.created_at)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <MyJobOpenStepButton job={job} completed />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ProjectsListPanel>
      </div>

      <WorkflowStepBlockedDialog
        open={blockedMessage !== null}
        message={blockedMessage ?? ""}
        onClose={() => setBlockedMessage(null)}
      />
    </ProjectsPage>
  );
}
