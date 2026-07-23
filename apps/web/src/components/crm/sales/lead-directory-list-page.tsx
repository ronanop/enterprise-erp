"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  fullName,
  listSalesLeads,
  type SalesLead,
} from "@/services/sales-crm-service";

export type LeadDirectoryKind = "oem" | "distributor" | "entity" | "end_customer";

const META: Record<
  LeadDirectoryKind,
  {
    title: string;
    description: string;
    primary: (lead: SalesLead) => string | null | undefined;
    secondary: (lead: SalesLead) => string | null | undefined;
    columns: [string, string];
  }
> = {
  oem: {
    title: "OEM",
    description: "OEM partners captured on sales leads.",
    primary: (l) => l.oem_name,
    secondary: (l) => l.oem_contact_person || l.oem_contact_email || l.oem_contact_number,
    columns: ["OEM", "Contact"],
  },
  distributor: {
    title: "Distributor",
    description: "Distributor details captured on sales leads.",
    primary: (l) => l.distributor_name,
    secondary: (l) =>
      l.distributor_contact_person || l.distributor_contact_email || l.distributor_contact,
    columns: ["Distributor", "Contact"],
  },
  entity: {
    title: "Entity",
    description: "Billing / contracting entities captured on sales leads.",
    primary: (l) => l.entity_name,
    secondary: (l) => l.entity_gst || l.entity_email || l.entity_contact,
    columns: ["Entity", "Details"],
  },
  end_customer: {
    title: "End Customer",
    description: "End customers linked to sales leads.",
    primary: (l) => l.end_customer_name,
    secondary: (l) => l.end_customer_location,
    columns: ["End Customer", "Location"],
  },
};

export function LeadDirectoryListPage({
  kind,
  companyAccountId,
  embedded,
}: {
  kind: LeadDirectoryKind;
  companyAccountId?: string;
  embedded?: boolean;
}) {
  const meta = META[kind];
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLeads(await listSalesLeads(companyAccountId));
    } catch (err) {
      setLeads([]);
      setError(err instanceof ApiClientError ? err.message : `Failed to load ${meta.title}`);
    } finally {
      setLoading(false);
    }
  }, [companyAccountId, meta.title]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () => leads.filter((lead) => Boolean(meta.primary(lead)?.trim())),
    [leads, meta],
  );

  const filtered = rows.filter((lead) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (meta.primary(lead) ?? "").toLowerCase().includes(q) ||
      (meta.secondary(lead) ?? "").toLowerCase().includes(q) ||
      fullName(lead).toLowerCase().includes(q) ||
      lead.lead_code.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {!embedded ? (
        <PageHeader
          title={meta.title}
          description={meta.description}
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
            <h2 className="truncate text-sm font-medium tracking-tight">{meta.title}</h2>
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
              placeholder={`Search ${meta.title.toLowerCase()}…`}
              className="h-8 w-52 shrink-0 sm:w-56"
            />
          </div>
        </div>

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5">{meta.columns[0]}</th>
                <th className="px-4 py-2.5">{meta.columns[1]}</th>
                <th className="px-4 py-2.5">Lead</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No {meta.title.toLowerCase()} records yet — add them when creating a lead.
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => (
                  <tr key={lead.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-medium">{meta.primary(lead)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {meta.secondary(lead) || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/crm/leads/${lead.id}`}
                        className="cursor-pointer text-primary hover:underline"
                      >
                        {fullName(lead)}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">{lead.lead_code}</div>
                    </td>
                    <td className="px-4 py-2.5 capitalize text-muted-foreground">
                      {lead.blueprint_state.replaceAll("_", " ")}
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
