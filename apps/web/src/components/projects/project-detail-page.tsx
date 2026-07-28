"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarRange,
  ClipboardList,
  FileText,
  FolderKanban,
  GitPullRequestArrow,
  Layers,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Scale,
  ShieldAlert,
  Timer,
} from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import {
  HealthDot,
  PriorityBadge,
  RiskLevelBadge,
  SeverityBadge,
} from "@/components/projects/projects-badges";
import {
  billingTypeLabel,
  budgetTypeLabel,
  changeTypeLabel,
  costSourceLabel,
  documentTypeLabel,
  projectTypeLabel,
} from "@/components/projects/projects-domain";
import {
  ProjectsCountBadge,
  ProjectsDetailGrid,
  ProjectsDetailItem,
  ProjectsErrorBanner,
  ProjectsMetric,
  ProjectsMetricStrip,
  ProjectsPage,
  ProjectsSection,
  ProjectsViewAllLink,
} from "@/components/projects/projects-ui";
import { SiteInstallationWorkflow } from "@/components/projects/site-installation-workflow";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  approveProject,
  closeProject,
  formatDate,
  formatHours,
  formatInr,
  getProject,
  listChangeRequests,
  listProjectBudgets,
  listProjectCosts,
  listProjectDocuments,
  listProjectIssues,
  listProjectMilestones,
  listProjectPhases,
  listProjectRisks,
  listProjectTasks,
  listResourceAllocations,
  listTimesheetEntries,
  num,
  submitProject,
  sumBy,
  type ChangeRequest,
  type Project,
  type ProjectBudget,
  type ProjectCost,
  type ProjectDocument,
  type ProjectIssue,
  type ProjectMilestone,
  type ProjectPhase,
  type ProjectRisk,
  type ProjectTask,
  type ResourceAllocation,
  type TimesheetEntry,
} from "@/services/projects-portal-service";

const LOOKUPS = ["employees", "customers", "departments", "phases"] as const;

type Related = {
  phases: ProjectPhase[];
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  entries: TimesheetEntry[];
  allocations: ResourceAllocation[];
  budgets: ProjectBudget[];
  costs: ProjectCost[];
  issues: ProjectIssue[];
  risks: ProjectRisk[];
  changeRequests: ChangeRequest[];
  documents: ProjectDocument[];
};

const EMPTY_RELATED: Related = {
  phases: [],
  milestones: [],
  tasks: [],
  entries: [],
  allocations: [],
  budgets: [],
  costs: [],
  issues: [],
  risks: [],
  changeRequests: [],
  documents: [],
};

/** Compact embedded table used by every related-records panel. */
function MiniTable({
  headers,
  rows,
  empty,
  minWidth = 620,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty: string;
  minWidth?: number;
}) {
  if (rows.length === 0) {
    return <p className="py-2 text-xs text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="erp-scroll overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth: `${minWidth}px` }}>
        <thead>
          <tr className="border-b border-border/70 text-[11px] tracking-wide text-muted-foreground uppercase">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr
              key={i}
              className="border-b border-border/50 transition-colors last:border-0 hover:bg-accent/30"
            >
              {cells.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NewLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium transition-colors duration-200 hover:bg-muted/50"
    >
      <Plus className="size-3" />
      {label}
    </Link>
  );
}

export function ProjectDetailPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [related, setRelated] = useState<Related>(EMPTY_RELATED);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [row] = await Promise.all([getProject(projectId), loadLookups()]);
      setProject(row);

      const mine = <T extends { project_id: string }>(rows: T[]) =>
        rows.filter((r) => r.project_id === projectId);

      const [
        phases,
        milestones,
        tasks,
        entries,
        allocations,
        budgets,
        costs,
        issues,
        risks,
        changeRequests,
        documents,
      ] = await Promise.all([
        listProjectPhases().then(mine).catch(() => []),
        listProjectMilestones().then(mine).catch(() => []),
        listProjectTasks().then(mine).catch(() => []),
        listTimesheetEntries().then(mine).catch(() => []),
        listResourceAllocations().then(mine).catch(() => []),
        listProjectBudgets().then(mine).catch(() => []),
        listProjectCosts().then(mine).catch(() => []),
        listProjectIssues().then(mine).catch(() => []),
        listProjectRisks().then(mine).catch(() => []),
        listChangeRequests().then(mine).catch(() => []),
        listProjectDocuments().then(mine).catch(() => []),
      ]);

      setRelated({
        phases,
        milestones,
        tasks,
        entries,
        allocations,
        budgets,
        costs,
        issues,
        risks,
        changeRequests,
        documents,
      });
    } catch (err) {
      setProject(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId, loadLookups]);

  useEffect(() => {
    void load();
  }, [load]);

  const rollup = useMemo(() => {
    const budgetTotal = sumBy(related.budgets, (b) => b.budget_amount);
    const costTotal = sumBy(related.costs, (c) => c.cost_amount);
    const done = related.tasks.filter((t) => t.status === "completed").length;
    return {
      budgetTotal,
      costTotal,
      variance: budgetTotal - costTotal,
      burnPct: budgetTotal > 0 ? Math.round((costTotal / budgetTotal) * 100) : 0,
      hours: sumBy(related.entries, (e) => e.hours_worked),
      taskProgress: related.tasks.length
        ? Math.round((done / related.tasks.length) * 100)
        : 0,
      openIssues: related.issues.filter(
        (i) => !["resolved", "closed", "cancelled"].includes(i.status),
      ).length,
      openRisks: related.risks.filter(
        (r) => !["closed", "cancelled", "accepted"].includes(r.status),
      ).length,
    };
  }, [related]);

  async function runAction(action: "submit" | "approve" | "close") {
    setBusy(true);
    setError(null);
    try {
      const fn =
        action === "submit" ? submitProject : action === "approve" ? approveProject : closeProject;
      setProject(await fn(projectId));
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? `${err.message}${err.errors.length ? `: ${err.errors.join(", ")}` : ""}`
          : `Failed to ${action} project`,
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading && !project) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  if (!project) {
    return (
      <ProjectsPage className="space-y-3">
        <Link
          href="/projects/projects"
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary"
        >
          <ArrowLeft className="size-3.5" /> Projects
        </Link>
        <ProjectsErrorBanner>{error ?? "Project not found."}</ProjectsErrorBanner>
      </ProjectsPage>
    );
  }

  const canSubmit = project.status === "draft";
  const canApprove = project.status === "submitted";
  const canClose = ["approved", "in_progress", "completed"].includes(project.status);

  return (
    <ProjectsPage>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/projects/projects"
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
        >
          <ArrowLeft className="size-3.5" /> Projects
        </Link>
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
            href={`/projects/projects/${project.id}/edit`}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
          >
            <Pencil className="size-3.5" />
            Edit
          </Link>
        </div>
      </div>

      <PageHeader
        title={`${project.project_name} · ${project.project_code}`}
        description={`${projectTypeLabel(project.project_type)} · ${formatDate(
          project.planned_start_date,
        )} → ${formatDate(project.planned_end_date)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FinanceStatusBadge status={project.status} />
            {canSubmit ? (
              <Button
                type="button"
                size="sm"
                className="cursor-pointer"
                disabled={busy}
                onClick={() => void runAction("submit")}
              >
                Submit for approval
              </Button>
            ) : null}
            {canApprove ? (
              <Button
                type="button"
                size="sm"
                className="cursor-pointer"
                disabled={busy}
                onClick={() => void runAction("approve")}
              >
                Approve
              </Button>
            ) : null}
            {canClose ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={busy}
                onClick={() => void runAction("close")}
              >
                Close
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? <ProjectsErrorBanner>{error}</ProjectsErrorBanner> : null}

      <SiteInstallationWorkflow projectId={project.id} onChanged={() => void load()} />

      <ProjectsMetricStrip>
        <ProjectsMetric
          label="Budget"
          value={formatInr(rollup.budgetTotal)}
          hint={`${related.budgets.length} approved lines`}
        />
        <ProjectsMetric
          label="Actual cost"
          value={formatInr(rollup.costTotal)}
          hint={`${rollup.burnPct}% consumed`}
        />
        <ProjectsMetric
          label="Variance"
          value={formatInr(rollup.variance)}
          hint={rollup.variance < 0 ? "Over budget" : "Within budget"}
        />
        <ProjectsMetric
          label="Task progress"
          value={`${rollup.taskProgress}%`}
          hint={`${related.tasks.length} tasks · ${formatHours(rollup.hours)} logged`}
        />
      </ProjectsMetricStrip>

      <ProjectsSection
        title="Project Details"
        subtitle="Ownership, schedule, and commercial terms"
        icon={FolderKanban}
      >
        <ProjectsDetailGrid>
          <ProjectsDetailItem label="Customer">
            {labels.customerName(project.customer_id)}
          </ProjectsDetailItem>
          <ProjectsDetailItem label="Department">
            {labels.departmentName(project.department_id)}
          </ProjectsDetailItem>
          <ProjectsDetailItem label="Project Manager">
            {labels.employeeName(project.project_manager_employee_id)}
          </ProjectsDetailItem>
          <ProjectsDetailItem label="Sponsor">
            {labels.employeeName(project.sponsor_employee_id)}
          </ProjectsDetailItem>
          <ProjectsDetailItem label="Planned Start">
            {formatDate(project.planned_start_date)}
          </ProjectsDetailItem>
          <ProjectsDetailItem label="Planned End">
            {formatDate(project.planned_end_date)}
          </ProjectsDetailItem>
          <ProjectsDetailItem label="Actual Start">
            {formatDate(project.actual_start_date)}
          </ProjectsDetailItem>
          <ProjectsDetailItem label="Actual End">
            {formatDate(project.actual_end_date)}
          </ProjectsDetailItem>
          <ProjectsDetailItem label="Approved Budget">
            {project.budget_amount == null ? "—" : formatInr(project.budget_amount)}
          </ProjectsDetailItem>
          <ProjectsDetailItem label="Currency">{project.currency_code}</ProjectsDetailItem>
          <ProjectsDetailItem label="Billing Type">
            {billingTypeLabel(project.billing_type)}
          </ProjectsDetailItem>
          <ProjectsDetailItem label="Health">
            <HealthDot health={project.health_status} />
          </ProjectsDetailItem>
          {project.description ? (
            <ProjectsDetailItem label="Description">{project.description}</ProjectsDetailItem>
          ) : null}
        </ProjectsDetailGrid>
      </ProjectsSection>

      <div className="grid gap-3 xl:grid-cols-2">
        <ProjectsSection
          title="WBS Phases"
          subtitle="Delivery stages"
          icon={Layers}
          badge={<ProjectsCountBadge count={related.phases.length} />}
          actions={<NewLink href={`/projects/projects/${project.id}/phases/new`} label="New" />}
        >
          <MiniTable
            headers={["Phase", "Seq", "Window", "Status"]}
            empty="No phases yet. Break the project into delivery stages."
            minWidth={520}
            rows={related.phases
              .slice()
              .sort((a, b) => a.sequence_no - b.sequence_no)
              .map((p) => [
                <span key="n" className="font-medium text-foreground">
                  {p.phase_name}
                </span>,
                p.sequence_no,
                `${formatDate(p.planned_start_date)} → ${formatDate(p.planned_end_date)}`,
                <FinanceStatusBadge key="s" status={p.status} />,
              ])}
          />
        </ProjectsSection>

        <ProjectsSection
          title="Milestones"
          subtitle="Contractual checkpoints"
          icon={CalendarRange}
          badge={<ProjectsCountBadge count={related.milestones.length} />}
          actions={<NewLink href={`/projects/projects/${project.id}/milestones/new`} label="New" />}
        >
          <MiniTable
            headers={["Milestone", "Due", "Achieved", "Status"]}
            empty="No milestones yet."
            minWidth={520}
            rows={related.milestones
              .slice()
              .sort((a, b) => a.due_date.localeCompare(b.due_date))
              .map((m) => [
                <span key="n" className="font-medium text-foreground">
                  {m.milestone_name}
                </span>,
                formatDate(m.due_date),
                formatDate(m.achieved_at),
                <FinanceStatusBadge key="s" status={m.status} />,
              ])}
          />
        </ProjectsSection>
      </div>

      <ProjectsSection
        title="Tasks"
        subtitle="Work breakdown items"
        icon={ClipboardList}
        badge={<ProjectsCountBadge count={related.tasks.length} />}
        actions={
          <div className="flex items-center gap-2">
            <ProjectsViewAllLink href="/projects/project-tasks" />
            <NewLink href={`/projects/projects/${project.id}/tasks/new`} label="New Task" />
          </div>
        }
      >
        <MiniTable
          headers={["Task", "Phase", "Priority", "Due", "Est / Act", "Done", "Status"]}
          empty="No tasks yet. Add work items to start tracking delivery."
          minWidth={760}
          rows={related.tasks
            .slice()
            .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
            .map((t) => [
              <span key="n" className="font-medium text-foreground">
                {t.task_name}
              </span>,
              labels.phaseName(t.phase_id),
              <PriorityBadge key="p" value={t.priority} />,
              formatDate(t.due_date),
              `${num(t.estimated_hours)} / ${num(t.actual_hours)} h`,
              `${num(t.percent_complete)}%`,
              <FinanceStatusBadge key="s" status={t.status} />,
            ])}
        />
      </ProjectsSection>

      <div className="grid gap-3 xl:grid-cols-2">
        <ProjectsSection
          title="Budgets"
          subtitle="Approved spend envelope"
          icon={Scale}
          badge={<ProjectsCountBadge count={related.budgets.length} />}
          actions={<ProjectsViewAllLink href="/projects/project-budgets" />}
        >
          <MiniTable
            headers={["Budget No.", "Type", "Amount", "Status"]}
            empty="No budget lines yet."
            minWidth={480}
            rows={related.budgets.map((b) => [
              <span key="n" className="font-mono text-xs text-foreground">
                {b.document_number}
              </span>,
              budgetTypeLabel(b.budget_type),
              <span key="a" className="tabular-nums text-foreground">
                {formatInr(b.budget_amount)}
              </span>,
              <FinanceStatusBadge key="s" status={b.status} />,
            ])}
          />
        </ProjectsSection>

        <ProjectsSection
          title="Costs"
          subtitle="Actual spend booked"
          icon={Receipt}
          badge={<ProjectsCountBadge count={related.costs.length} />}
          actions={<ProjectsViewAllLink href="/projects/project-costs" />}
        >
          <MiniTable
            headers={["Cost No.", "Source", "Amount", "Date", "Status"]}
            empty="No costs booked yet."
            minWidth={520}
            rows={related.costs
              .slice()
              .sort((a, b) => b.cost_date.localeCompare(a.cost_date))
              .map((c) => [
                <span key="n" className="font-mono text-xs text-foreground">
                  {c.document_number}
                </span>,
                costSourceLabel(c.cost_source),
                <span key="a" className="tabular-nums text-foreground">
                  {formatInr(c.cost_amount)}
                </span>,
                formatDate(c.cost_date),
                <FinanceStatusBadge key="s" status={c.status} />,
              ])}
          />
        </ProjectsSection>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <ProjectsSection
          title="Issues"
          subtitle={`${rollup.openIssues} open`}
          icon={AlertTriangle}
          badge={<ProjectsCountBadge count={related.issues.length} />}
          actions={<NewLink href={`/projects/projects/${project.id}/issues/new`} label="New" />}
        >
          <MiniTable
            headers={["Issue", "Severity", "Owner", "Status"]}
            empty="No issues raised."
            minWidth={520}
            rows={related.issues.map((i) => [
              <span key="n" className="font-medium text-foreground">
                {i.issue_title}
              </span>,
              <SeverityBadge key="sv" value={i.severity} />,
              labels.employeeName(i.owner_employee_id),
              <FinanceStatusBadge key="s" status={i.status} />,
            ])}
          />
        </ProjectsSection>

        <ProjectsSection
          title="Risk Register"
          subtitle={`${rollup.openRisks} open`}
          icon={ShieldAlert}
          badge={<ProjectsCountBadge count={related.risks.length} />}
          actions={<NewLink href={`/projects/projects/${project.id}/risks/new`} label="New" />}
        >
          <MiniTable
            headers={["Risk", "Level", "Review", "Status"]}
            empty="No risks identified."
            minWidth={520}
            rows={related.risks.map((r) => [
              <span key="n" className="font-medium text-foreground">
                {r.risk_name}
              </span>,
              <RiskLevelBadge key="l" value={r.risk_level} />,
              formatDate(r.review_date),
              <FinanceStatusBadge key="s" status={r.status} />,
            ])}
          />
        </ProjectsSection>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <ProjectsSection
          title="Change Requests"
          subtitle="Baseline revisions"
          icon={GitPullRequestArrow}
          badge={<ProjectsCountBadge count={related.changeRequests.length} />}
          actions={
            <NewLink href={`/projects/projects/${project.id}/change-requests/new`} label="New" />
          }
        >
          <MiniTable
            headers={["Change", "Type", "Budget Impact", "Days", "Status"]}
            empty="No change requests raised."
            minWidth={560}
            rows={related.changeRequests.map((c) => [
              <span key="n" className="font-medium text-foreground">
                {c.change_title}
              </span>,
              changeTypeLabel(c.change_type),
              c.budget_impact_amount == null ? "—" : formatInr(c.budget_impact_amount),
              c.schedule_impact_days ?? "—",
              <FinanceStatusBadge key="s" status={c.status} />,
            ])}
          />
        </ProjectsSection>

        <ProjectsSection
          title="Documents"
          subtitle="Deliverables and references"
          icon={FileText}
          badge={<ProjectsCountBadge count={related.documents.length} />}
          actions={<NewLink href={`/projects/projects/${project.id}/documents/new`} label="New" />}
        >
          <MiniTable
            headers={["Document", "Type", "Uploaded By", "Status"]}
            empty="No documents attached."
            minWidth={520}
            rows={related.documents.map((d) => [
              <span key="n" className="font-medium text-foreground">
                {d.document_name}
              </span>,
              documentTypeLabel(d.document_type),
              labels.employeeName(d.uploaded_by_employee_id),
              <FinanceStatusBadge key="s" status={d.status} />,
            ])}
          />
        </ProjectsSection>
      </div>

      <ProjectsSection
        title="Resource Allocations"
        subtitle="Who is booked on this project"
        icon={Timer}
        badge={<ProjectsCountBadge count={related.allocations.length} />}
        actions={<ProjectsViewAllLink href="/projects/resource-allocations" />}
      >
        <MiniTable
          headers={["Resource", "Type", "Allocation", "Window", "Status"]}
          empty="No resources allocated yet."
          minWidth={620}
          rows={related.allocations.map((a) => [
            <span key="n" className="font-medium text-foreground">
              {labels.employeeName(a.employee_id)}
            </span>,
            a.resource_type,
            `${num(a.allocation_percent)}%`,
            `${formatDate(a.start_date)} → ${formatDate(a.end_date)}`,
            <FinanceStatusBadge key="s" status={a.status} />,
          ])}
        />
      </ProjectsSection>
    </ProjectsPage>
  );
}
