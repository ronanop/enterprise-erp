"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { EmailWorkspaceNav } from "@/components/email/email-workspace-nav";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listEmailEvents, type EmailEventRow } from "@/services/email-notification-service";
import { ApiClientError } from "@/services/api-client";

export function EmailEventsPage() {
  const [rows, setRows] = useState<EmailEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listEmailEvents(200));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load events");
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
        title="Notification events"
        description="Queued and processed notification events."
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
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 font-medium">Recipient</th>
              <th className="px-3 py-2.5 font-medium">Created</th>
              <th className="px-3 py-2.5 font-medium">Id</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/50 last:border-0">
                <td className="px-3 py-2.5">
                  <Badge variant="outline">{row.status}</Badge>
                </td>
                <td className="px-3 py-2.5">{row.event_type}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{row.recipient_address ?? "—"}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                  {row.created_at ?? "—"}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{row.id}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No notification events yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
