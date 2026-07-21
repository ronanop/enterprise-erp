"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Info, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import { formatInr, listOvfs, type Ovf } from "@/services/sales-crm-service";

export function OvfListPage() {
  const [rows, setRows] = useState<Ovf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listOvfs());
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load OVFs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter((r) => r.ovf_no.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="space-y-4">
      <PageHeader
        title="OVF"
        description="Order Value Forms — approval, SCM share, and deal-won. Created only from an eligible Opportunity once the customer PO is approved."
        actions={
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-900">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        OVFs are created only from an Opportunity after the customer PO is approved — open the
        opportunity to create one.
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium tracking-tight">OVFs</h2>
            <Badge variant="secondary">{filtered.length} shown</Badge>
          </div>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search OVF no…" className="h-8 max-w-xs" />
        </div>

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5">OVF No.</th>
                <th className="px-4 py-2.5">State</th>
                <th className="px-4 py-2.5">PO Number</th>
                <th className="px-4 py-2.5">Margin</th>
                <th className="px-4 py-2.5">Deal Won</th>
                <th className="px-4 py-2.5">Shared to SCM</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Loading OVFs…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No OVFs yet.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <Link href={`/crm/ovf/${row.id}`} className="cursor-pointer hover:underline">
                        {row.ovf_no}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="capitalize">
                        {row.blueprint_state.replaceAll("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.po_number ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.total_margin_pct}%</td>
                    <td className="px-4 py-2.5">
                      {row.deal_won ? (
                        <Badge variant="success">{formatInr(row.deal_won_amount ?? 0)}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.shared_to_scm ? <Badge variant="secondary">Shared</Badge> : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
