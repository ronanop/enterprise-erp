"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import {
  CrmErrorBanner,
  CrmListPanel,
  CrmPage,
  CRM_TABLE_HEAD_CELL,
  CRM_TABLE_HEAD_ROW,
} from "@/components/crm/crm-ui";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { RowActionsItem, RowActionsMenu } from "@/components/ui/row-actions-menu";
import { useAuthUser } from "@/hooks/use-auth-user";
import { cn } from "@/lib/utils";
import { formatReportCellTitle, formatReportCellValue } from "@/lib/crm/report-amount";
import { formatApiError } from "@/services/api-client";
import {
  cloneSavedCrmReport,
  exportCrmReportXlsx,
  getSavedCrmReport,
  runSavedCrmReport,
  type CrmReportRunResult,
  type CrmSavedReport,
} from "@/services/crm-reports-service";

export function ReportViewPage({ reportId }: { reportId: string }) {
  const router = useRouter();
  const { user } = useAuthUser();
  const [report, setReport] = useState<CrmSavedReport | null>(null);
  const [run, setRun] = useState<CrmReportRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<"clone" | "export" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [saved, result] = await Promise.all([
        getSavedCrmReport(reportId),
        runSavedCrmReport(reportId),
      ]);
      setReport(saved);
      setRun(result);
    } catch (err) {
      setReport(null);
      setRun(null);
      setError(formatApiError(err, "Failed to load report"));
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onClone() {
    setMenuOpen(false);
    setBusy("clone");
    setError(null);
    try {
      const cloned = await cloneSavedCrmReport(reportId);
      router.push(`/crm/reports/${cloned.id}`);
    } catch (err) {
      setError(formatApiError(err, "Failed to clone report"));
      setBusy(null);
    }
  }

  async function onExport() {
    if (!report || !run) return;
    setMenuOpen(false);
    setBusy("export");
    setError(null);
    try {
      const userName =
        user?.displayName?.trim() || user?.email?.trim() || "User";
      await exportCrmReportXlsx({
        reportName: report.report_name,
        userName,
        run,
      });
    } catch (err) {
      setError(formatApiError(err, "Failed to export Excel"));
    } finally {
      setBusy(null);
    }
  }

  const columns = run?.columns ?? [];

  return (
    <CrmPage>
      <PageHeader
        title={report?.report_name ?? (loading ? "Report" : "Report")}
        backHref="/crm/reports"
        backLabel="Reports"
        actions={
          report ? (
            <div className="flex items-center gap-2">
              <Link
                href={`/crm/reports/${report.id}/edit`}
                className={cn(buttonVariants({ size: "sm" }), "cursor-pointer")}
              >
                <Pencil className="size-3.5" />
                Edit
              </Link>
              <RowActionsMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <RowActionsItem
                  onClick={() => {
                    if (busy) return;
                    void onClone();
                  }}
                >
                  {busy === "clone" ? "Cloning…" : "Clone"}
                </RowActionsItem>
                <RowActionsItem
                  onClick={() => {
                    if (busy) return;
                    void onExport();
                  }}
                >
                  {busy === "export" ? "Exporting…" : "Export to Excel"}
                </RowActionsItem>
              </RowActionsMenu>
            </div>
          ) : null
        }
      />

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className={CRM_TABLE_HEAD_ROW}>
                {columns.length === 0 ? (
                  <th className={CRM_TABLE_HEAD_CELL}>Results</th>
                ) : (
                  columns.map((col) => (
                    <th key={col.key} className={CRM_TABLE_HEAD_CELL}>
                      {col.label}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={Math.max(columns.length, 1)}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Loading report…
                  </td>
                </tr>
              ) : !run || run.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(columns.length, 1)}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No records found.
                  </td>
                </tr>
              ) : (
                run.rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-border/50 transition-colors duration-200 last:border-0 hover:bg-accent/30"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="max-w-[280px] truncate px-4 py-2.5 text-muted-foreground"
                        title={formatReportCellTitle(col.key, row[col.key])}
                      >
                        {formatReportCellValue(col.key, row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {run && !loading ? (
          <p className="border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
            Record Count : {run.record_count}
          </p>
        ) : null}
      </CrmListPanel>
    </CrmPage>
  );
}
