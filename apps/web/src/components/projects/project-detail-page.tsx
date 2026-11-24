"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Cloud,
  FolderKanban,
  Pencil,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { projectTypeLabel } from "@/components/projects/projects-domain";
import {
  ProjectsDetailGrid,
  ProjectsDetailItem,
  ProjectsErrorBanner,
  ProjectsListPanel,
  ProjectsListToolbar,
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
  type CloudPoLine,
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

  const cloudPoLines = useMemo<CloudPoLine[]>(() => {
    const lines = Array.isArray(site?.cloud_po_lines) ? site.cloud_po_lines : [];
    return [...lines].sort((a, b) => {
      const po = (a.customer_po_number || "").localeCompare(b.customer_po_number || "");
      if (po !== 0) return po;
      return (a.line_type || "").localeCompare(b.line_type || "");
    });
  }, [site?.cloud_po_lines]);

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

  const cloudName = (site?.cloud_name || "").trim();
  const showCloudPoTable = Boolean(cloudName) || cloudPoLines.length > 0;

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

      {showCloudPoTable ? (
        <ProjectsListPanel>
          <ProjectsListToolbar
            title={cloudName || project.project_name}
            subtitle={`All POs for this cloud · ${cloudPoLines.length} line${cloudPoLines.length === 1 ? "" : "s"}`}
            icon={cloudName ? Cloud : ShoppingCart}
            count={cloudPoLines.length}
          />
          <div className="erp-scroll overflow-x-auto">
            {cloudPoLines.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No PO lines stored for this cloud yet.
              </p>
            ) : (
              <table className="w-full min-w-[880px] text-left text-[13px]">
                <thead className="border-b border-border/70 bg-muted/80 text-[11px] text-muted-foreground">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">Project</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">Circle</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">Site</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">Type</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">Qty</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">PO</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">PO Date</th>
                  </tr>
                </thead>
                <tbody>
                  {cloudPoLines.map((row, index) => (
                    <tr
                      key={`${row.customer_po_number || "po"}-${row.line_type || ""}-${index}`}
                      className="border-b border-border/40"
                    >
                      <td className="max-w-[180px] truncate px-3 py-2 font-medium">
                        {row.project_name || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{row.circle_name || "—"}</td>
                      <td className="max-w-[160px] truncate px-3 py-2">{row.site_name || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2">{row.line_type || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                        {row.quantity != null && row.quantity > 0 ? row.quantity : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums">
                        {row.customer_po_number || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {formatDate(row.document_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </ProjectsListPanel>
      ) : (
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
      )}

      <SiteInstallationTrackingSummary projectId={project.id} />

    </ProjectsPage>
  );
}
