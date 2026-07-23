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
import {
  listCompanies,
  listEmployeeOptions,
  type Company,
  type Option,
} from "@/services/sales-crm-service";

export function KycAccountMappingPage({
  companyAccountId,
  embedded,
}: {
  companyAccountId?: string;
  embedded?: boolean;
} = {}) {
  const [rows, setRows] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [companies, employeeOptions] = await Promise.all([
        listCompanies(),
        listEmployeeOptions().catch(() => [] as Option[]),
      ]);
      setRows(
        companyAccountId
          ? companies.filter((company) => company.id === companyAccountId)
          : companies,
      );
      setEmployees(employeeOptions);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load KYC mapping");
    } finally {
      setLoading(false);
    }
  }, [companyAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const employeeName = (id: string | null) =>
    id ? employees.find((employee) => employee.id === id)?.label ?? id.slice(0, 8) : "—";

  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      row.customer_name.toLowerCase().includes(q) ||
      row.account_number.toLowerCase().includes(q) ||
      (row.industry ?? "").toLowerCase().includes(q) ||
      (row.customer_id_ext ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {!embedded ? (
        <PageHeader
          title="KYC - Account Mapping"
          description="Company account KYC profile — ownership, source, industry, and external customer IDs."
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          }
        />
      ) : null}

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/70 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2 className="truncate text-sm font-medium tracking-tight">Account Mapping</h2>
            <Badge variant="secondary">{filtered.length} shown</Badge>
          </div>
          <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
            {embedded ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={loading}
                onClick={() => void load()}
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            ) : null}
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search account…"
              className="h-8 w-52 shrink-0 sm:w-56"
            />
          </div>
        </div>

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Account No.</th>
                <th className="px-4 py-2.5">Owner</th>
                <th className="px-4 py-2.5">Industry</th>
                <th className="px-4 py-2.5">Source</th>
                <th className="px-4 py-2.5">Customer ID</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No company accounts yet.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-medium">
                      <Link
                        href={`/crm/companies/${row.id}`}
                        className="cursor-pointer text-primary hover:underline"
                      >
                        {row.customer_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.account_number}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {employeeName(row.account_owner_id)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.industry || "—"}</td>
                    <td className="px-4 py-2.5 capitalize text-muted-foreground">
                      {(row.source || "—").replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {row.customer_id_ext || "—"}
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
