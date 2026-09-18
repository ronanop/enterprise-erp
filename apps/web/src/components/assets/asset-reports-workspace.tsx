"use client";

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
import { Loader2, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isAuthenticated } from "@/lib/auth";
import { type ReportDashboard, reportService } from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";

export function AssetReportsWorkspace() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<ReportDashboard | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const dash = await reportService.dashboard();
      setDashboard(dash);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadDashboard();
    });
  }, [loadDashboard]);

  const kpis = dashboard?.kpis ?? {};
  const categoryChart = (dashboard?.by_category ?? []).map((row) => ({
    name: String(row.category_code || row.category_name || "—"),
    count: Number(row.count ?? 0),
  }));

  return (
    <div className="space-y-4 p-4 md:p-6" data-testid="asset-reports-workspace">
      <PageHeader
        title="Asset Reports"
        description="Operational dashboards and read-only analytics."
        actions={
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            onClick={() => void loadDashboard()}
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
    </div>
  );
}
