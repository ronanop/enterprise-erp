"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookUser, RefreshCw } from "lucide-react";

import { CrmErrorBanner, CrmListPanel, CrmPage } from "@/components/crm/crm-ui";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import { CrmSortableTh, sortRows, useTableSort } from "@/components/crm/sales/crm-table-sort";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  fullName,
  listOems,
  listSalesLeads,
  type Oem,
  type SalesLead,
} from "@/services/sales-crm-service";

export type LeadDirectoryKind = "oem" | "distributor" | "entity" | "end_customer";

type SortKey = "primary" | "secondary" | "lead" | "status";

type DirectoryRow = {
  id: string;
  primary: string;
  secondary: string;
  leadId: string;
  leadLabel: string;
  leadCode: string;
  status: string;
  leadCount: number;
};

const META: Record<
  LeadDirectoryKind,
  {
    title: string;
    description: string;
    subtitle: string;
    primary: (lead: SalesLead) => string | null | undefined;
    secondary: (lead: SalesLead) => string | null | undefined;
    columns: [string, string];
    /** When true, collapse duplicate names into one row (OEM / distributor masters). */
    dedupeByPrimary?: boolean;
  }
> = {
  oem: {
    title: "OEM",
    description: "OEM partner master. Add new OEMs from the lead form (New OEM).",
    subtitle: "OEM partners",
    primary: (l) => l.oem_name,
    secondary: (l) => l.oem_contact_person || l.oem_contact_email || l.oem_contact_number,
    columns: ["OEM", "Contact"],
    dedupeByPrimary: true,
  },
  distributor: {
    title: "Distributor",
    description: "Distributor details captured on sales leads.",
    subtitle: "Distributors from leads",
    primary: (l) => l.distributor_name,
    secondary: (l) =>
      l.distributor_contact_person || l.distributor_contact_email || l.distributor_contact,
    columns: ["Distributor", "Contact"],
    dedupeByPrimary: true,
  },
  entity: {
    title: "Entity",
    description: "Billing / contracting entities captured on sales leads.",
    subtitle: "Billing entities from leads",
    primary: (l) => l.entity_name,
    secondary: (l) => l.entity_gst || l.entity_email || l.entity_contact,
    columns: ["Entity", "Details"],
  },
  end_customer: {
    title: "End Customer",
    description: "End customers linked to sales leads.",
    subtitle: "End customers from leads",
    primary: (l) => l.end_customer_name,
    secondary: (l) => l.end_customer_location,
    columns: ["End Customer", "Location"],
  },
};

function toDirectoryRows(leads: SalesLead[], kind: LeadDirectoryKind): DirectoryRow[] {
  const meta = META[kind];
  const withPrimary = leads.filter((lead) => Boolean(meta.primary(lead)?.trim()));

  if (!meta.dedupeByPrimary) {
    return withPrimary.map((lead) => ({
      id: lead.id,
      primary: meta.primary(lead)?.trim() || "—",
      secondary: meta.secondary(lead)?.trim() || "—",
      leadId: lead.id,
      leadLabel: fullName(lead),
      leadCode: lead.lead_code,
      status: lead.blueprint_state,
      leadCount: 1,
    }));
  }

  const map = new Map<string, DirectoryRow>();
  for (const lead of withPrimary) {
    const primary = meta.primary(lead)?.trim() || "—";
    const key = primary.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.leadCount += 1;
      continue;
    }
    map.set(key, {
      id: key,
      primary,
      secondary: meta.secondary(lead)?.trim() || "—",
      leadId: lead.id,
      leadLabel: fullName(lead),
      leadCode: lead.lead_code,
      status: lead.blueprint_state,
      leadCount: 1,
    });
  }
  return [...map.values()];
}

function oemContactLabel(oem: Oem): string {
  return oem.contact_person || oem.contact_email || oem.contact_number || "—";
}

function toOemDirectoryRows(oems: Oem[], leads: SalesLead[]): DirectoryRow[] {
  const leadCountByName = new Map<string, { count: number; lead?: SalesLead }>();
  for (const lead of leads) {
    const name = lead.oem_name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = leadCountByName.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      leadCountByName.set(key, { count: 1, lead });
    }
  }

  return oems.map((oem) => {
    const usage = leadCountByName.get(oem.oem_name.trim().toLowerCase());
    const sample = usage?.lead;
    return {
      id: oem.id,
      primary: oem.oem_name,
      secondary: oemContactLabel(oem),
      leadId: sample?.id ?? "",
      leadLabel: sample ? fullName(sample) : "—",
      leadCode: sample?.lead_code ?? oem.oem_code,
      status: oem.status,
      leadCount: usage?.count ?? 0,
    };
  });
}

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
  const [oems, setOems] = useState<Oem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { sortBy, sortDir, onSort } = useTableSort<SortKey>("primary");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (kind === "oem") {
        const [oemRows, leadRows] = await Promise.all([
          listOems(),
          listSalesLeads(companyAccountId).catch(() => []),
        ]);
        setOems(oemRows);
        setLeads(leadRows);
      } else {
        setLeads(await listSalesLeads(companyAccountId));
        setOems([]);
      }
    } catch (err) {
      setLeads([]);
      setOems([]);
      setError(err instanceof ApiClientError ? err.message : `Failed to load ${meta.title}`);
    } finally {
      setLoading(false);
    }
  }, [companyAccountId, kind, meta.title]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () => (kind === "oem" ? toOemDirectoryRows(oems, leads) : toDirectoryRows(leads, kind)),
    [kind, leads, oems],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.primary.toLowerCase().includes(q) ||
        row.secondary.toLowerCase().includes(q) ||
        row.leadLabel.toLowerCase().includes(q) ||
        row.leadCode.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sortBy, sortDir, {
        primary: (r) => r.primary,
        secondary: (r) => r.secondary,
        lead: (r) => r.leadLabel,
        status: (r) => r.status,
      }),
    [filtered, sortBy, sortDir],
  );

  return (
    <CrmPage>
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

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <CrmListToolbar
          title={meta.title}
          subtitle={meta.subtitle}
          icon={BookUser}
          count={sorted.length}
          actions={
            embedded ? (
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
            ) : null
          }
          search={{
            value: query,
            onChange: setQuery,
            placeholder: `Search ${meta.title.toLowerCase()}…`,
          }}
        />

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-180 text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <CrmSortableTh label={meta.columns[0]} sortKey="primary" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label={meta.columns[1]} sortKey="secondary" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh
                  label={kind === "oem" ? "Code / Lead" : "Lead"}
                  sortKey="lead"
                  activeKey={sortBy}
                  dir={sortDir}
                  onSort={onSort}
                />
                <CrmSortableTh label="Status" sortKey="status" activeKey={sortBy} dir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {loading && sorted.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No {meta.title.toLowerCase()} records yet
                    {kind === "oem"
                      ? " — add them from a lead form (choose New OEM)."
                      : " — add them when creating a lead."}
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-medium">
                      {row.primary}
                      {row.leadCount > 1 ? (
                        <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                          · {row.leadCount} leads
                        </span>
                      ) : row.leadCount === 1 && kind === "oem" ? (
                        <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                          · 1 lead
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.secondary}</td>
                    <td className="px-4 py-2.5">
                      {row.leadId ? (
                        <>
                          <Link
                            href={`/crm/leads/${row.leadId}`}
                            className="cursor-pointer text-primary hover:underline"
                          >
                            {row.leadLabel}
                          </Link>
                          <div className="text-[11px] text-muted-foreground">{row.leadCode}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">{row.leadCode || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 capitalize text-muted-foreground">
                      {row.status.replaceAll("_", " ")}
                    </td>
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
