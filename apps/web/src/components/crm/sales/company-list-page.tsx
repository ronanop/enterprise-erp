"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";

import { CompanyFormDialog } from "@/components/crm/sales/company-form-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import { listCompanies, type Company } from "@/services/sales-crm-service";

export function CompanyListPage() {
  const [rows, setRows] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listCompanies());
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load companies");
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
    return (
      r.customer_name.toLowerCase().includes(q) ||
      (r.customer_email ?? "").toLowerCase().includes(q) ||
      (r.phone ?? "").toLowerCase().includes(q) ||
      r.account_number.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Company"
        description="Sales accounts — the only entry point for creating leads. Convert a company's lead through Opportunity, Quote, and OVF to Won."
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
            <Button type="button" size="sm" className="cursor-pointer" onClick={() => setDialogOpen(true)}>
              <Plus className="size-3.5" />
              New Company
            </Button>
          </div>
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
            <h2 className="text-sm font-medium tracking-tight">Accounts</h2>
            <Badge variant="secondary">{filtered.length} shown</Badge>
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies…"
            className="h-8 max-w-xs"
          />
        </div>

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5">Customer Name</th>
                <th className="px-4 py-2.5">Account No.</th>
                <th className="px-4 py-2.5">Phone</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Industry</th>
                <th className="px-4 py-2.5">Rating</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Loading companies…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No companies yet. Create one to start the sales blueprint.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <Link href={`/crm/companies/${row.id}`} className="cursor-pointer hover:underline">
                        {row.customer_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{row.account_number}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.phone ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.customer_email ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.industry}</td>
                    <td className="px-4 py-2.5 text-muted-foreground capitalize">{row.rating ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <FinanceStatusBadge status={row.status} />
                      {row.locked ? (
                        <Badge variant="destructive" className="ml-1">
                          Locked
                        </Badge>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CompanyFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}
