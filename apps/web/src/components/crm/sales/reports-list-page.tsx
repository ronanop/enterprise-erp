"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Plus } from "lucide-react";

import {
  CrmErrorBanner,
  CrmListPanel,
  CrmPage,
  CRM_TABLE_HEAD_CELL,
  CRM_TABLE_HEAD_ROW,
} from "@/components/crm/crm-ui";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import { FinanceField, FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  listCrmReportModules,
  listSavedCrmReports,
  type CrmReportModule,
  type CrmSavedReport,
} from "@/services/crm-reports-service";

function formatLastUpdated(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export function ReportsListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CrmSavedReport[]>([]);
  const [modules, setModules] = useState<CrmReportModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState("");
  const [reportNameDraft, setReportNameDraft] = useState("");

  const moduleLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of modules) map.set(m.key, m.label);
    return map;
  }, [modules]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reports, mods] = await Promise.all([
        listSavedCrmReports(),
        listCrmReportModules().catch(() => [] as CrmReportModule[]),
      ]);
      setRows(reports);
      setModules(mods);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const moduleLabel = moduleLabelByKey.get(r.primary_module) ?? r.primary_module;
      return (
        r.report_name.toLowerCase().includes(q) ||
        (r.folder_name ?? "").toLowerCase().includes(q) ||
        moduleLabel.toLowerCase().includes(q) ||
        r.primary_module.toLowerCase().includes(q)
      );
    });
  }, [rows, query, moduleLabelByKey]);

  function openCreate() {
    setSelectedModule("");
    setReportNameDraft("");
    setCreateOpen(true);
  }

  function continueCreate() {
    const name = reportNameDraft.trim();
    if (!selectedModule || !name) return;
    setCreateOpen(false);
    router.push(
      `/crm/reports/new?module=${encodeURIComponent(selectedModule)}&name=${encodeURIComponent(name)}`,
    );
  }

  return (
    <CrmPage>
      <PageHeader
        title="Reports"
        actions={
          <Button type="button" size="sm" className="cursor-pointer" onClick={openCreate}>
            <Plus className="size-3.5" />
            Create Report
          </Button>
        }
      />

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <CrmListToolbar
          title="Reports"
          icon={BarChart3}
          count={filtered.length}
          search={{
            value: query,
            onChange: setQuery,
            placeholder: "Search reports…",
          }}
        />

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className={CRM_TABLE_HEAD_ROW}>
                <th className={CRM_TABLE_HEAD_CELL}>Report Name</th>
                <th className={CRM_TABLE_HEAD_CELL}>Folder</th>
                <th className={CRM_TABLE_HEAD_CELL}>Primary Module</th>
                <th className={CRM_TABLE_HEAD_CELL}>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    Loading reports…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    No reports yet. Use “Create Report” to build one.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/50 transition-colors duration-200 last:border-0 hover:bg-accent/30"
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <Link
                        href={`/crm/reports/${row.id}`}
                        className="cursor-pointer transition-colors duration-200 hover:underline"
                      >
                        {row.report_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {row.folder_name?.trim() || "-"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {moduleLabelByKey.get(row.primary_module) ?? row.primary_module}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {formatLastUpdated(row.updated_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CrmListPanel>

      {createOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setCreateOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-report-title"
            className="w-full max-w-md rounded-xl border border-border/80 bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="create-report-title" className="text-base font-extrabold tracking-tight">
              Create New Report
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Select a primary module, then enter a report name.
            </p>

            <div className="mt-4 space-y-3">
              <FinanceField label="Primary Module *">
                <FinanceSelect
                  value={selectedModule}
                  onChange={(e) => {
                    setSelectedModule(e.target.value);
                    setReportNameDraft("");
                  }}
                >
                  <option value="">Select module</option>
                  {modules.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </FinanceSelect>
              </FinanceField>

              {selectedModule ? (
                <FinanceField label="Report Name *">
                  <Input
                    value={reportNameDraft}
                    onChange={(e) => setReportNameDraft(e.target.value)}
                    placeholder="e.g. Open Opportunities - Q3"
                    aria-label="Report name"
                    className="h-9 cursor-text"
                    autoFocus
                  />
                </FinanceField>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="cursor-pointer"
                disabled={!selectedModule || !reportNameDraft.trim()}
                onClick={continueCreate}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </CrmPage>
  );
}
