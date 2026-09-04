"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Package, Plus, RefreshCw, Tags } from "lucide-react";

import { NonItDashboardSummarySection } from "@/components/assets/non-it/non-it-dashboard-summary";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getNonItDashboardSummary,
  type NonItDashboardSummary,
} from "@/services/nonit-asset-service";

export function NonItDashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<NonItDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await getNonItDashboardSummary());
    } catch (err) {
      setSummary(null);
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function goInventory(status?: string) {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    router.push(`/assets/non-it/inventory${q}`);
  }

  return (
    <div
      className="relative flex w-full flex-col gap-5 px-1 py-2 sm:px-2 md:px-0 md:py-3"
      data-testid="nonit-dashboard-page"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-2 h-44 overflow-hidden rounded-xl"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(3,105,161,0.09),_transparent_55%),radial-gradient(ellipse_at_top_right,_rgba(15,23,42,0.04),_transparent_50%)]" />
      </div>

      <div className="relative space-y-5">
        <PageHeader
          title="Non-IT Assets"
          description="Furniture, facilities, and other non-IT inventory overview."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 cursor-pointer text-muted-foreground transition-colors duration-200"
                aria-label="Refresh dashboard"
                disabled={loading}
                onClick={() => void load()}
              >
                <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer gap-2 transition-colors duration-200"
                onClick={() => router.push("/assets/non-it/new")}
              >
                <Plus className="size-4" aria-hidden />
                Add asset
              </Button>
              <Button
                type="button"
                className="cursor-pointer gap-2 bg-[#0369A1] text-white transition-colors duration-200 hover:bg-[#0369A1]/90"
                onClick={() => goInventory()}
              >
                <Package className="size-4" aria-hidden />
                Open inventory
              </Button>
            </div>
          }
        />

        {error ? (
          <Card className="border-destructive/30 bg-destructive/5 shadow-sm" role="alert">
            <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() => void load()}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <NonItDashboardSummarySection
          summary={summary}
          loading={loading}
          onStatusClick={(status) => goInventory(status || undefined)}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push("/assets/non-it/types")}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 bg-background/95 p-4 text-left shadow-sm transition-all duration-200 hover:border-[#0369A1]/40 hover:shadow-md"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-[rgba(3,105,161,0.1)] text-[#0369A1]">
              <Tags className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">Manage types</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Categories, prefixes, and assignment modes
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/assets/non-it/locations")}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 bg-background/95 p-4 text-left shadow-sm transition-all duration-200 hover:border-emerald-400/50 hover:shadow-md"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <MapPin className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">Manage locations</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Rooms, floors, departments, and common areas
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
