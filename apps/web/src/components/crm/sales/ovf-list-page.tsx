"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, RefreshCw } from "lucide-react";

import { CrmErrorBanner, CrmInfoBanner, CrmListPanel, CrmPage } from "@/components/crm/crm-ui";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import { CrmSortableTh, sortRows, useTableSort } from "@/components/crm/sales/crm-table-sort";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import { formatInr, listOvfs, type Ovf } from "@/services/sales-crm-service";

type SortKey =
  | "ovf_no"
  | "blueprint_state"
  | "po_number"
  | "total_margin_pct"
  | "deal_won"
  | "shared_to_scm"
  | "created_at";

function formatCreatedDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function OvfListPage({
  companyAccountId,
  embedded,
}: {
  companyAccountId?: string;
  embedded?: boolean;
} = {}) {
  const [rows, setRows] = useState<Ovf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { sortBy, sortDir, onSort } = useTableSort<SortKey>("ovf_no");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listOvfs(
        companyAccountId ? { company_account_id: companyAccountId } : undefined,
      );
      setRows(
        companyAccountId
          ? data.filter((row) => row.company_account_id === companyAccountId)
          : data,
      );
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load OVFs");
    } finally {
      setLoading(false);
    }
  }, [companyAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.ovf_no.toLowerCase().includes(q));
  }, [rows, query]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sortBy, sortDir, {
        ovf_no: (r) => r.ovf_no,
        blueprint_state: (r) => r.blueprint_state,
        po_number: (r) => r.po_number,
        total_margin_pct: (r) => r.total_margin_pct,
        deal_won: (r) => (r.deal_won ? (r.deal_won_amount ?? 1) : 0),
        shared_to_scm: (r) => r.shared_to_scm,
        created_at: (r) => r.created_at,
      }),
    [filtered, sortBy, sortDir],
  );

  return (
    <CrmPage>
      {!embedded ? (
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
      ) : null}

      {!embedded ? (
        <CrmInfoBanner>
          OVFs are created only from an Opportunity after the customer PO is approved — open the
          opportunity to create one.
        </CrmInfoBanner>
      ) : null}

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <CrmListToolbar
          title="OVFs"
          subtitle="Order value forms"
          icon={ClipboardCheck}
          count={sorted.length}
          actions={
            embedded ? (
              <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            ) : null
          }
          search={{
            value: query,
            onChange: setQuery,
            placeholder: "Search OVF no…",
          }}
        />

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <CrmSortableTh label="OVF No." sortKey="ovf_no" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="State" sortKey="blueprint_state" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="PO Number" sortKey="po_number" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Margin" sortKey="total_margin_pct" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Deal Won" sortKey="deal_won" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Shared to SCM" sortKey="shared_to_scm" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Date Created" sortKey="created_at" activeKey={sortBy} dir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Loading OVFs…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No OVFs yet.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
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
                    <td className="px-4 py-2.5 text-muted-foreground">{formatCreatedDate(row.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CrmListPanel>
    </CrmPage>
  );
}
