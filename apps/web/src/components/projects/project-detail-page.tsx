"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FolderKanban,
  Pencil,
  RefreshCw,
} from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import {
  HealthDot,
} from "@/components/projects/projects-badges";
import {
  billingTypeLabel,
  projectTypeLabel,
} from "@/components/projects/projects-domain";
import {
  ProjectsDetailGrid,
  ProjectsDetailItem,
  ProjectsErrorBanner,
  ProjectsPage,
  ProjectsSection,
} from "@/components/projects/projects-ui";
import {
  SiteInstallationTrackingSummary,
  SiteInstallationWorkflow,
} from "@/components/projects/site-installation-workflow";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  approveProject,
  closeProject,
  formatDate,
  formatInr,
  getProject,
  submitProject,
  type Project,
} from "@/services/projects-portal-service";

const LOOKUPS = ["employees", "customers", "departments"] as const;

export function ProjectDetailPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
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

      <SiteInstallationWorkflow projectId={project.id} />

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

      <SiteInstallationTrackingSummary projectId={project.id} />

    </ProjectsPage>
  );
}
