"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Columns3 } from "lucide-react";

import {
  CrmErrorBanner,
  CrmListPanel,
  CrmPage,
  CRM_SECTION_TITLE,
  CRM_TABLE_HEAD_CELL,
  CRM_TABLE_HEAD_ROW,
  CrmIconBadge,
} from "@/components/crm/crm-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError, formatApiError } from "@/services/api-client";
import { formatReportCellTitle, formatReportCellValue } from "@/lib/crm/report-amount";
import {
  createSavedCrmReport,
  getSavedCrmReport,
  listCrmReportColumns,
  listCrmReportModules,
  runCrmReport,
  updateSavedCrmReport,
  type CrmReportColumn,
  type CrmReportRunResult,
} from "@/services/crm-reports-service";

const PREVIEW_LIMIT = 25;
const RUN_DEBOUNCE_MS = 350;

export function ReportBuilderPage({
  mode,
  initialModule,
  initialName,
  reportId,
}: {
  mode: "create" | "edit";
  initialModule?: string;
  initialName?: string;
  reportId?: string;
}) {
  const router = useRouter();
  const [reportName, setReportName] = useState(
    mode === "create" ? (initialName?.trim() || "") : "",
  );
  const [primaryModule, setPrimaryModule] = useState(initialModule ?? "");
  const [moduleLabel, setModuleLabel] = useState("");
  const [availableColumns, setAvailableColumns] = useState<CrmReportColumn[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [columnSearch, setColumnSearch] = useState("");
  const [version, setVersion] = useState<number | undefined>(undefined);

  const [preview, setPreview] = useState<CrmReportRunResult | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSeq = useRef(0);

  const filteredColumns = useMemo(() => {
    const q = columnSearch.trim().toLowerCase();
    if (!q) return availableColumns;
    return availableColumns.filter(
      (c) => c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q),
    );
  }, [availableColumns, columnSearch]);

  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const filteredKeys = useMemo(
    () => filteredColumns.map((c) => c.key),
    [filteredColumns],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingMeta(true);
      setError(null);
      try {
        if (mode === "edit") {
          if (!reportId) throw new Error("Missing report id");
          const report = await getSavedCrmReport(reportId);
          if (cancelled) return;
          setReportName(report.report_name);
          setPrimaryModule(report.primary_module);
          setSelectedKeys(report.definition_json?.columns ?? []);
          setVersion(report.version);

          const [mods, cols] = await Promise.all([
            listCrmReportModules(),
            listCrmReportColumns(report.primary_module),
          ]);
          if (cancelled) return;
          setModuleLabel(
            mods.find((m) => m.key === report.primary_module)?.label ??
              report.primary_module,
          );
          setAvailableColumns(cols);
        } else {
          const moduleKey = initialModule ?? "";
          if (!moduleKey) {
            setError("Select a primary module to create a report.");
            setLoadingMeta(false);
            return;
          }
          if (!initialName?.trim()) {
            setError("Enter a report name after selecting the primary module.");
            setLoadingMeta(false);
            return;
          }
          setPrimaryModule(moduleKey);
          setReportName(initialName.trim());
          const [mods, cols] = await Promise.all([
            listCrmReportModules(),
            listCrmReportColumns(moduleKey),
          ]);
          if (cancelled) return;
          setModuleLabel(mods.find((m) => m.key === moduleKey)?.label ?? moduleKey);
          setAvailableColumns(cols);
          setSelectedKeys([]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err, "Failed to load report builder"));
        }
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [mode, initialModule, initialName, reportId]);

  const executePreview = useCallback(
    async (moduleKey: string, columns: string[]) => {
      if (!moduleKey || columns.length === 0) {
        setPreview(null);
        setRunning(false);
        return;
      }
      const seq = ++runSeq.current;
      setRunning(true);
      try {
        const result = await runCrmReport({
          primary_module: moduleKey,
          columns,
          preview_limit: PREVIEW_LIMIT,
        });
        if (seq !== runSeq.current) return;
        setPreview(result);
        setError(null);
      } catch (err) {
        if (seq !== runSeq.current) return;
        setPreview(null);
        setError(
          err instanceof ApiClientError
            ? err.message
            : formatApiError(err, "Failed to run preview"),
        );
      } finally {
        if (seq === runSeq.current) setRunning(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (loadingMeta || !primaryModule) return;
    const timer = window.setTimeout(() => {
      void executePreview(primaryModule, selectedKeys);
    }, RUN_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [loadingMeta, primaryModule, selectedKeys, executePreview]);

  function toggleColumn(key: string) {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function selectAllVisible() {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const key of filteredKeys) next.add(key);
      return availableColumns.map((c) => c.key).filter((k) => next.has(k));
    });
  }

  function clearAllVisible() {
    if (columnSearch.trim()) {
      const drop = new Set(filteredKeys);
      setSelectedKeys((prev) => prev.filter((k) => !drop.has(k)));
      return;
    }
    setSelectedKeys([]);
  }

  async function onSave() {
    const name = reportName.trim();
    if (!name) {
      setError("Report name is required.");
      return;
    }
    if (!primaryModule) {
      setError("Primary module is required.");
      return;
    }
    if (selectedKeys.length === 0) {
      setError("Select at least one column.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (mode === "edit" && reportId) {
        const updated = await updateSavedCrmReport(reportId, {
          report_name: name,
          columns: selectedKeys,
          version,
        });
        router.push(`/crm/reports/${updated.id}`);
      } else {
        const created = await createSavedCrmReport({
          report_name: name,
          primary_module: primaryModule,
          columns: selectedKeys,
        });
        router.push(`/crm/reports/${created.id}`);
      }
    } catch (err) {
      setError(formatApiError(err, "Failed to save report"));
    } finally {
      setSaving(false);
    }
  }

  const previewColumns =
    preview?.columns ??
    availableColumns.filter((c) => selectedSet.has(c.key));

  return (
    <CrmPage>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-base font-extrabold tracking-tight text-foreground sm:text-lg">
            {reportName.trim() || "Untitled Report"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {moduleLabel || primaryModule || "—"}
            {mode === "edit" ? (
              <button
                type="button"
                className="ml-2 cursor-pointer text-primary underline-offset-2 transition-colors duration-200 hover:underline"
                onClick={() => {
                  const next = window.prompt("Report name", reportName);
                  if (next != null && next.trim()) setReportName(next.trim());
                }}
              >
                Rename
              </button>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() =>
              router.push(reportId ? `/crm/reports/${reportId}` : "/crm/reports")
            }
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            disabled={saving || selectedKeys.length === 0}
            onClick={() => void onSave()}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      {loadingMeta ? (
        <p className="text-sm text-muted-foreground">Loading report builder…</p>
      ) : (
        <div className="flex min-h-[420px] flex-col gap-4 lg:flex-row">
          <aside className="w-full shrink-0 rounded-xl border border-border/80 bg-card shadow-sm lg:w-[320px]">
            <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
              <CrmIconBadge icon={Columns3} />
              <h2 className={CRM_SECTION_TITLE}>Columns</h2>
            </div>
            <div className="space-y-3 p-3">
              <Input
                value={columnSearch}
                onChange={(e) => setColumnSearch(e.target.value)}
                placeholder="Search columns…"
                aria-label="Search columns"
                className="h-8"
              />
              <div className="flex items-center gap-2 px-0.5">
                <button
                  type="button"
                  className="cursor-pointer text-xs font-medium text-primary transition-colors duration-200 hover:underline"
                  onClick={selectAllVisible}
                >
                  Select all
                </button>
                <span className="text-muted-foreground/50" aria-hidden>
                  ·
                </span>
                <button
                  type="button"
                  className="cursor-pointer text-xs font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground hover:underline"
                  onClick={clearAllVisible}
                >
                  Clear all
                </button>
              </div>
              <ul className="erp-scroll max-h-[min(560px,60vh)] space-y-0.5 overflow-y-auto">
                {filteredColumns.length === 0 ? (
                  <li className="px-2 py-6 text-center text-xs text-muted-foreground">
                    No columns match.
                  </li>
                ) : (
                  filteredColumns.map((col) => {
                    const checked = selectedSet.has(col.key);
                    return (
                      <li key={col.key}>
                        <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-200 hover:bg-muted/60">
                          <input
                            type="checkbox"
                            className="mt-0.5 size-3.5 cursor-pointer accent-primary"
                            checked={checked}
                            onChange={() => toggleColumn(col.key)}
                          />
                          <span className="min-w-0 leading-snug">
                            <span className="block font-medium text-foreground">
                              {col.label}
                            </span>
                            <span className="block text-[10px] text-muted-foreground">
                              {col.key}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })
                )}
              </ul>
              <p className="px-1 text-[11px] text-muted-foreground">
                {selectedKeys.length} column{selectedKeys.length === 1 ? "" : "s"} selected
              </p>
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-3">
            <CrmListPanel>
              <div className="erp-scroll overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className={CRM_TABLE_HEAD_ROW}>
                      {previewColumns.length === 0 ? (
                        <th className={CRM_TABLE_HEAD_CELL}>Preview</th>
                      ) : (
                        previewColumns.map((col) => (
                          <th key={col.key} className={CRM_TABLE_HEAD_CELL}>
                            {col.label}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedKeys.length === 0 ? (
                      <tr>
                        <td
                          colSpan={Math.max(previewColumns.length, 1)}
                          className="px-4 py-10 text-center text-muted-foreground"
                        >
                          Select columns to preview data.
                        </td>
                      </tr>
                    ) : running && !preview ? (
                      <tr>
                        <td
                          colSpan={Math.max(previewColumns.length, 1)}
                          className="px-4 py-10 text-center text-muted-foreground"
                        >
                          Loading preview…
                        </td>
                      </tr>
                    ) : !preview || preview.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={Math.max(previewColumns.length, 1)}
                          className="px-4 py-10 text-center text-muted-foreground"
                        >
                          {running ? "Refreshing preview…" : "No rows in preview."}
                        </td>
                      </tr>
                    ) : (
                      preview.rows.map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-border/50 transition-colors duration-200 last:border-0 hover:bg-accent/30"
                        >
                          {previewColumns.map((col) => (
                            <td
                              key={col.key}
                              className="max-w-[240px] truncate px-4 py-2.5 text-muted-foreground"
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
              {preview ? (
                <p className="border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
                  Preview {preview.rows.length} of {preview.record_count} live record
                  {preview.record_count === 1 ? "" : "s"}
                  {running ? " · refreshing…" : ""}
                </p>
              ) : null}
            </CrmListPanel>
          </div>
        </div>
      )}
    </CrmPage>
  );
}
