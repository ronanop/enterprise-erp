"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FolderKanban,
  Pencil,
  RefreshCw,
} from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { projectTypeLabel, siteDeliveryTypeLabel } from "@/components/projects/projects-domain";
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
import { ProjectExcelExportButton } from "@/components/projects/site-stage-export-button";
import { useProjectsLookups } from "@/components/projects/use-projects-lookups";
import { useAuthUser } from "@/hooks/use-auth-user";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  approveProject,
  closeProject,
  formatDate,
  getProject,
  getSiteInstallationByProject,
  listBranchOptions,
  submitProject,
  type Project,
  type SiteInstallation,
} from "@/services/projects-portal-service";

const LOOKUPS = ["employees", "customers"] as const;

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function labelOrNull(
  id: string | null | undefined,
  resolve: (id: string | null | undefined) => string,
): string | null {
  if (!id) return null;
  const label = resolve(id);
  return label && label !== "—" ? label : null;
}

function buildIntakeDetailRows(
  project: Project,
  site: SiteInstallation | null,
  branchLabel: string | null,
  labels: ReturnType<typeof useProjectsLookups>["labels"],
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];

  if (hasText(branchLabel)) {
    rows.push({ label: "Circle Name", value: branchLabel! });
  }
  if (site?.delivery_type) {
    rows.push({
      label: "Delivery Type",
      value: siteDeliveryTypeLabel(site.delivery_type),
    });
  }
  const customer = labelOrNull(project.customer_id, labels.customerName);
  if (customer) rows.push({ label: "Customer", value: customer });
  if (hasText(site?.site_name)) {
    rows.push({ label: "Site Name", value: site!.site_name!.trim() });
  }
  const pm = labelOrNull(project.project_manager_employee_id, labels.employeeName);
  if (pm) rows.push({ label: "Project Manager", value: pm });
  if (site) {
    rows.push({
      label: "RFAI Request",
      value: site.rfai_request_done ? "Yes" : "No",
    });
    if (site.rfai_request_done) {
      if (hasText(site.rfai_number)) {
        rows.push({ label: "RFAI Number", value: site.rfai_number!.trim() });
      }
    }
  }

  return rows;
}

export function ProjectDetailPage({ projectId }: { projectId: string }) {
  const { projectModuleAdmin } = useAuthUser();
  const [project, setProject] = useState<Project | null>(null);
  const [site, setSite] = useState<SiteInstallation | null>(null);
  const [branchLabel, setBranchLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loadLookups, labels } = useProjectsLookups(LOOKUPS);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [row, siteRow, branches, _lookups] = await Promise.all([
        getProject(projectId),
        getSiteInstallationByProject(projectId).catch(() => null),
        listBranchOptions().catch(() => []),
        loadLookups(),
      ]);
      setProject(row);
      setSite(siteRow);
      setBranchLabel(branches.find((b) => b.id === row.branch_id)?.label ?? null);
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

  const intakeDetailRows = buildIntakeDetailRows(project, site, branchLabel, labels);

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
          <ProjectExcelExportButton projectId={project.id} />
          {projectModuleAdmin ? (
            <Link
              href={`/projects/projects/${project.id}/edit`}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              <Pencil className="size-3.5" />
              Edit
            </Link>
          ) : null}
        </div>
      </div>

      <PageHeader
        title={`${project.project_name} · ${project.project_code}`}
        description={`${projectTypeLabel(project.project_type)} · ${formatDate(
          project.planned_start_date,
        )} → ${formatDate(project.planned_end_date)}`}
        actions={
          projectModuleAdmin ? (
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
          ) : (
            <FinanceStatusBadge status={project.status} />
          )
        }
      />

      {error ? <ProjectsErrorBanner>{error}</ProjectsErrorBanner> : null}

      <SiteInstallationWorkflow projectId={project.id} />

      <ProjectsSection
        title="Project Details"
        subtitle="Intake fields captured when this site request was created"
        icon={FolderKanban}
      >
        {intakeDetailRows.length > 0 ? (
          <ProjectsDetailGrid>
            {intakeDetailRows.map((row) => (
              <ProjectsDetailItem key={row.label} label={row.label}>
                {row.value}
              </ProjectsDetailItem>
            ))}
          </ProjectsDetailGrid>
        ) : (
          <p className="text-sm text-muted-foreground">No intake details recorded.</p>
        )}
      </ProjectsSection>

      <SiteInstallationTrackingSummary projectId={project.id} />

    </ProjectsPage>
  );
}
