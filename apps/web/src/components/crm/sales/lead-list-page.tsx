"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import { formatInr, fullName, listSalesLeads, type SalesLead } from "@/services/sales-crm-service";

export function LeadListPage() {
  const [rows, setRows] = useState<SalesLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listSalesLeads());
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return fullName(r).toLowerCase().includes(q) || r.lead_code.toLowerCase().includes(q) || r.mobile.includes(q);
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leads"
        description="Sales-blueprint leads created from a Company account. Leads can only be created from Company → Create Lead."
        actions={
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium tracking-tight">Leads</h2>
            <Badge variant="secondary">{filtered.length} shown</Badge>
          </div>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search leads…" className="h-8 max-w-xs" />
        </div>

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5">Lead</th>
                <th className="px-4 py-2.5">Mobile</th>
                <th className="px-4 py-2.5">Expected Amount</th>
                <th className="px-4 py-2.5">Blueprint State</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Loading leads…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No leads yet. Open a Company and use “Create Lead”.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <Link href={`/crm/leads/${row.id}`} className="cursor-pointer hover:underline">
                        {fullName(row)} · {row.lead_code}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.mobile}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {row.expected_amount ? formatInr(row.expected_amount) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="capitalize">
                        {row.blueprint_state.replaceAll("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <FinanceStatusBadge status={row.status} />
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
