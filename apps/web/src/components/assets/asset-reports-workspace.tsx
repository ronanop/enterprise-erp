"use client";

import {
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  exportTabularCsv,
  exportTabularXlsx,
  type ExportColumn,
} from "@/lib/finance/report-export";
import { isAuthenticated } from "@/lib/auth";
import {
  type ReportCatalogItem,
  type ReportDashboard,
  type ReportRunResult,
  type ReportSnapshotRow,
  reportService,
} from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";

const PAGE_SIZE = 25;

type TabKey = "dashboard" | "run" | "snapshots";

export function AssetReportsWorkspace() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<ReportDashboard | null>(null);
  const [catalog, setCatalog] = useState<ReportCatalogItem[]>([]);
  const [reportKey, setReportKey] = useState("asset_inventory");
  const [runResult, setRunResult] = useState<ReportRunResult | null>(null);
  const [page, setPage] = useState(1);

  const [snapshots, setSnapshots] = useState<ReportSnapshotRow[]>([]);
  const [snapTotal, setSnapTotal] = useState(0);
  const [snapPage, setSnapPage] = useState(1);
  const [selectedSnap, setSelectedSnap] = useState<ReportSnapshotRow | null>(null);
  const [snapStatus, setSnapStatus] = useState("");
  const [snapSearch, setSnapSearch] = useState("");

  const loadDashboard = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const [dash, cat] = await Promise.all([
        reportService.dashboard(),
        reportService.catalog(),
      ]);
      setDashboard(dash);
      setCatalog(cat);
      if (cat.length && !cat.find((c) => c.key === reportKey)) {
        setReportKey(cat[0].key);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [reportKey]);

  const loadRun = useCallback(async () => {
    if (!isAuthenticated() || !reportKey) return;
    setLoading(true);
    setError(null);
    try {
      const result = await reportService.run(reportKey, {
        page,
        page_size: PAGE_SIZE,
      });
      setRunResult(result);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to run report");
      setRunResult(null);
    } finally {
      setLoading(false);
    }
  }, [reportKey, page]);

  const loadSnapshots = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await reportService.searchSnapshots({
        page: snapPage,
        page_size: PAGE_SIZE,
        status: snapStatus || undefined,
        q: snapSearch.trim() || undefined,
      });
      setSnapshots(payload.items);
      setSnapTotal(payload.total);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load snapshots");
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  }, [snapPage, snapStatus, snapSearch]);

  useEffect(() => {
    if (tab === "dashboard") void loadDashboard();
    if (tab === "run") void loadRun();
    if (tab === "snapshots") void loadSnapshots();
  }, [tab, loadDashboard, loadRun, loadSnapshots]);

  const handleExport = async (format: "csv" | "xlsx") => {
    setActionLoading(true);
    setError(null);
    try {
      const payload = await reportService.export(reportKey);
      const columns: ExportColumn<Record<string, unknown>>[] = payload.columns.map((c) => ({
        key: c.key,
        label: c.label,
      }));
      const rows = payload.rows as Record<string, unknown>[];
      if (format === "csv") {
        exportTabularCsv(`${reportKey}.csv`, rows, columns);
      } else {
        exportTabularXlsx(`${reportKey}.xlsx`, reportKey, rows, columns);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Export failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerate = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const row = await reportService.generate({ report_key: reportKey });
      setSelectedSnap(row);
      setTab("snapshots");
      setSnapPage(1);
      await loadSnapshots();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Generate failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedSnap || selectedSnap.status !== "draft") return;
    setActionLoading(true);
    setError(null);
    try {
      const row = await reportService.finalize(selectedSnap.id);
      setSelectedSnap(row);
      await loadSnapshots();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Finalize failed");
    } finally {
      setActionLoading(false);
    }
  };

  const kpis = dashboard?.kpis ?? {};
  const categoryChart = (dashboard?.by_category ?? []).map((row) => ({
    name: String(row.category_code || row.category_name || "—"),
    count: Number(row.count ?? 0),
  }));

  const totalPages = Math.max(1, Math.ceil((runResult?.total ?? 0) / PAGE_SIZE));
  const snapPages = Math.max(1, Math.ceil(snapTotal / PAGE_SIZE));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Asset Reports"
        description="Operational dashboards and read-only analytics. Snapshots freeze metrics without changing assets."
        actions={
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            onClick={() => {
              if (tab === "dashboard") void loadDashboard();
              if (tab === "run") void loadRun();
              if (tab === "snapshots") void loadSnapshots();
            }}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        }
      />

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["dashboard", "Dashboard"],
            ["run", "Run report"],
            ["snapshots", "Saved snapshots"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={tab === key ? "default" : "outline"}
            className="cursor-pointer transition-colors duration-200"
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "dashboard" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Assets", kpis.asset_count],
              ["Assigned", kpis.assigned_assets],
              ["Available", kpis.available_assets],
              ["Maintenance due", kpis.maintenance_due],
              ["Warranty expiry", kpis.warranty_expiry],
              ["Insurance expiry", kpis.insurance_expiry],
              ["Disposed", kpis.disposed_assets],
              ["In maintenance", kpis.in_maintenance],
            ].map(([label, value]) => (
              <Card key={String(label)}>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">{value ?? 0}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Assets by category</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {categoryChart.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No category data.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={2} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  In maintenance:{" "}
                  <strong>{String(dashboard?.health?.pct_in_maintenance ?? 0)}%</strong>
                </p>
                <p>
                  Open maintenance:{" "}
                  <strong>{String(dashboard?.health?.open_maintenance ?? 0)}</strong>
                </p>
                <p>
                  Policies expiring:{" "}
                  <strong>{String(dashboard?.health?.policies_expiring ?? 0)}</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Generated {dashboard?.generated_at ?? "—"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "run" ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 pt-4 md:grid-cols-3">
              <div className="space-y-1">
                <Label>Report</Label>
                <Select
                  value={reportKey}
                  onValueChange={(v) => {
                    setPage(1);
                    setReportKey(v);
                  }}
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  type="button"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={actionLoading}
                  onClick={() => void handleExport("csv")}
                >
                  <Download className="mr-1 h-4 w-4" />
                  CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={actionLoading}
                  onClick={() => void handleExport("xlsx")}
                >
                  <FileSpreadsheet className="mr-1 h-4 w-4" />
                  Excel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={actionLoading}
                  onClick={() => void handleGenerate()}
                >
                  <Save className="mr-1 h-4 w-4" />
                  Snapshot
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Results ({runResult?.total ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!runResult?.items?.length ? (
                <p className="text-sm text-muted-foreground">No rows.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className={tableSerialHeaderClassName()} scope="col">
                          {TABLE_SERIAL_HEADER_LABEL}
                        </th>
                        {Object.keys(runResult.items[0]).map((k) => (
                          <th key={k} className="py-2 pr-2 font-medium">
                            {k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {runResult.items.map((row, index) => (
                        <tr key={index} className="border-b">
                          <td className={tableSerialCellClassName()}>{tableRowSerial(page, PAGE_SIZE, index)}</td>
                          {Object.keys(runResult.items[0]).map((k) => (
                            <td key={k} className="py-2 pr-2">
                              {String(row[k] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-3 flex justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "snapshots" ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Saved reports ({snapTotal})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 md:grid-cols-2">
                <Input
                  value={snapSearch}
                  onChange={(e) => {
                    setSnapPage(1);
                    setSnapSearch(e.target.value);
                  }}
                  placeholder="Search code/type…"
                  className="transition-colors duration-200"
                />
                <Select
                  value={snapStatus || "__all__"}
                  onValueChange={(v) => {
                    setSnapPage(1);
                    setSnapStatus(v === "__all__" ? "" : v);
                  }}
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All status</SelectItem>
                    <SelectItem value="draft">draft</SelectItem>
                    <SelectItem value="finalized">finalized</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th className="py-2 pr-2 font-medium">Code</th>
                      <th className="py-2 pr-2 font-medium">Type</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((row, index) => (
                      <tr
                        key={row.id}
                        className={`cursor-pointer border-b transition-colors duration-200 hover:bg-muted/50 ${
                          selectedSnap?.id === row.id ? "bg-muted/60" : ""
                        }`}
                        onClick={() => setSelectedSnap(row)}
                      >
                        <td className={tableSerialCellClassName()}>{tableRowSerial(snapPage, PAGE_SIZE, index)}</td>
                        <td className="py-2 pr-2">{row.report_code}</td>
                        <td className="py-2 pr-2">{row.report_type}</td>
                        <td className="py-2">
                          <Badge variant={row.status === "finalized" ? "secondary" : "default"}>
                            {row.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {snapPage} of {snapPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={snapPage <= 1}
                    onClick={() => setSnapPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={snapPage >= snapPages}
                    onClick={() => setSnapPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Snapshot detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!selectedSnap ? (
                <p className="text-muted-foreground">Select a snapshot.</p>
              ) : (
                <>
                  <p>
                    <span className="text-muted-foreground">Code:</span> {selectedSnap.report_code}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Type:</span> {selectedSnap.report_type}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Generated:</span>{" "}
                    {selectedSnap.generated_at ?? "—"}
                  </p>
                  <pre className="max-h-64 overflow-auto rounded border bg-muted/30 p-2 text-xs">
                    {JSON.stringify(selectedSnap.metrics_json, null, 2)}
                  </pre>
                  {selectedSnap.status === "draft" ? (
                    <Button
                      type="button"
                      size="sm"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading}
                      onClick={() => void handleFinalize()}
                    >
                      <ShieldCheck className="mr-1 h-4 w-4" />
                      Finalize
                    </Button>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
