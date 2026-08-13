"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { EmailWorkspaceNav } from "@/components/email/email-workspace-nav";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  listEmailDeliveries,
  type EmailDeliveryRow,
} from "@/services/email-notification-service";
import { ApiClientError } from "@/services/api-client";

export function EmailDeliveriesPage() {
  const [rows, setRows] = useState<EmailDeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listEmailDeliveries(200));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <EmailWorkspaceNav />
      <PageHeader
        title="Email deliveries"
        description="Per-attempt delivery log from Microsoft Graph."
        actions={
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
        }
      />

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Recipient</th>
              <th className="px-3 py-2.5 font-medium">Subject</th>
              <th className="px-3 py-2.5 font-medium">Event</th>
              <th className="px-3 py-2.5 font-medium">Delivered</th>
              <th className="px-3 py-2.5 font-medium">Provider</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/50 align-top last:border-0">
                <td className="px-3 py-2.5">
                  <Badge variant="outline">{row.status}</Badge>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">{row.recipient_address ?? "—"}</td>
                <td className="max-w-[220px] truncate px-3 py-2.5">{row.subject ?? "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{row.event_type ?? "—"}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                  {row.delivered_at ?? "—"}
                </td>
                <td className="max-w-[240px] truncate px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                  {row.provider_response ?? "—"}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No email deliveries yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
