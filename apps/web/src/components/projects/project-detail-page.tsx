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
import { projectTypeLabel } from "@/components/projects/projects-domain";
import {
  ProjectsDetailGrid,
  ProjectsDetailItem,
  ProjectsErrorBanner,
  ProjectsPage,
  ProjectsSection,
} from "@/components/projects/projects-ui";
import { intakeAdminDetailRows } from "@/components/projects/site-intake-summary";
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
  completeProject,
  formatDate,
  getProject,
  getSiteInstallationByProject,
  listBranchOptions,
  type Project,
  type SiteInstallation,
} from "@/services/projects-portal-service";
import { getPurchaseOrder } from "@/services/procurement-service";

const LOOKUPS = ["employees", "customers"] as const;

const TERMINAL_PROJECT_STATUSES = new Set(["completed", "closed", "cancelled"]);

export function ProjectDetailPage({ projectId }: { projectId: string }) {
  const { projectModuleAdmin } = useAuthUser();
  const [project, setProject] = useState<Project | null>(null);
  const [site, setSite] = useState<SiteInstallation | null>(null);
  const [branchLabel, setBranchLabel] = useState<string | null>(null);
  const [companyPoNumber, setCompanyPoNumber] = useState<string | null>(null);
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
      if (row.proc_order_id) {
        try {
          const order = await getPurchaseOrder(row.proc_order_id);
          setCompanyPoNumber(order.company_po_number || order.document_number || null);
        } catch {
          setCompanyPoNumber(null);
        }
      } else {
        setCompanyPoNumber(null);
      }
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

  async function runMarkCompleted() {
    setBusy(true);
    setError(null);
    try {
      setProject(await completeProject(projectId));
      await load();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? `${err.message}${err.errors.length ? `: ${err.errors.join(", ")}` : ""}`
          : "Failed to mark project as completed",
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

  const canMarkCompleted = !TERMINAL_PROJECT_STATUSES.has(project.status);

  const intakeDetailRows = intakeAdminDetailRows({
    project,
    site,
    branchLabel,
    customerName: labels.customerName,
    employeeName: labels.employeeName,
    companyPoNumber,
  });

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
              {canMarkCompleted ? (
                <Button
                  type="button"
                  size="sm"
                  className="cursor-pointer"
                  disabled={busy}
                  onClick={() => void runMarkCompleted()}
                >
                  Mark as completed
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
