"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useHealthCheck } from "@/hooks/use-health-check";

export function FoundationStatus() {
  const { data, loading, error, refresh } = useHealthCheck();

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Platform status</CardTitle>
          {data?.status === "healthy" ? <Badge variant="success">Healthy</Badge> : null}
          {error ? <Badge variant="destructive">Offline</Badge> : null}
          {loading ? <Badge variant="secondary">Checking</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <p className="text-sm text-muted-foreground">Checking API health…</p> : null}
        {error ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">API unreachable</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : null}
        {data ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ["Application", data.status],
              ["Environment", data.environment],
              ["API version", data.version],
              ["Database", data.database],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
                <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
                <dd className="mt-0.5 text-sm font-medium tracking-tight">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <Button variant="outline" size="sm" className="shadow-none" onClick={() => void refresh()}>
          Refresh status
        </Button>
      </CardContent>
    </Card>
  );
}
