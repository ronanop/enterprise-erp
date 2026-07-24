"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileStack, RefreshCw } from "lucide-react";

import { CrmErrorBanner, CrmInfoBanner, CrmListPanel, CrmPage } from "@/components/crm/crm-ui";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import { CrmSortableTh, sortRows, useTableSort } from "@/components/crm/sales/crm-table-sort";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  listAttachmentsByCategory,
  listOpportunities,
  openAttachmentInNewTab,
  type Attachment,
  type Opportunity,
} from "@/services/sales-crm-service";

export type DocumentCategory = "oem_quote" | "customer_po" | "boq" | "sow";

type SortKey = "document" | "opportunity" | "stage" | "size";

const META: Record<
  DocumentCategory,
  { title: string; description: string; flag: keyof Opportunity; label: string; subtitle: string }
> = {
  oem_quote: {
    title: "OEM Quote",
    description: "OEM quotations attached on opportunities before customer quote creation.",
    flag: "oem_quote_attached",
    label: "OEM Quote",
    subtitle: "OEM quotation documents",
  },
  customer_po: {
    title: "Purchase Order",
    description: "Customer purchase orders attached after quote acceptance.",
    flag: "customer_po_attached",
    label: "Customer PO",
    subtitle: "Customer purchase orders",
  },
  boq: {
    title: "BOQ",
    description: "Bill of Quantities documents attached on opportunities.",
    flag: "boq_attached",
    label: "BOQ",
    subtitle: "Bill of quantities",
  },
  sow: {
    title: "SOW",
    description: "Statement of Work documents attached on opportunities.",
    flag: "sow_attached",
    label: "SOW",
    subtitle: "Statements of work",
  },
};

export function DocumentRegistryListPage({
  category,
  companyAccountId,
  embedded,
}: {
  category: DocumentCategory;
  companyAccountId?: string;
  embedded?: boolean;
}) {
  const meta = META[category];
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { sortBy, sortDir, onSort } = useTableSort<SortKey>("document");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [files, opps] = await Promise.all([
        listAttachmentsByCategory(category).catch(() => [] as Attachment[]),
        listOpportunities(
          companyAccountId ? { company_account_id: companyAccountId } : undefined,
        ).catch(() => [] as Opportunity[]),
      ]);
      const scopedOpps = companyAccountId
        ? opps.filter((opp) => opp.company_account_id === companyAccountId)
        : opps;
      const oppIds = new Set(scopedOpps.map((opp) => opp.id));
      const scopedFiles = companyAccountId
        ? files.filter(
            (file) =>
              file.entity_type === "opportunity" && oppIds.has(file.entity_id),
          )
        : files;
      setAttachments(scopedFiles);
      setOpportunities(scopedOpps);
    } catch (err) {
      setAttachments([]);
      setOpportunities([]);
      setError(err instanceof ApiClientError ? err.message : `Failed to load ${meta.title}`);
    } finally {
      setLoading(false);
    }
  }, [category, companyAccountId, meta.title]);

  useEffect(() => {
    void load();
  }, [load]);

  const oppById = useMemo(() => {
    const map = new Map<string, Opportunity>();
    for (const opp of opportunities) map.set(opp.id, opp);
    return map;
  }, [opportunities]);

  const flaggedOpps = opportunities.filter((opp) => Boolean(opp[meta.flag]));

  const rows = useMemo(() => {
    if (attachments.length > 0) {
      return attachments.map((file) => {
        const opp = file.entity_type === "opportunity" ? oppById.get(file.entity_id) : undefined;
        return {
          id: file.id,
          attachmentId: file.id as string | null,
          name: file.file_name,
          opportunity: opp,
          opportunityId: file.entity_type === "opportunity" ? file.entity_id : null,
          size: file.size,
        };
      });
    }
    return flaggedOpps.map((opp) => ({
      id: opp.id,
      attachmentId: null as string | null,
      name: `${meta.label} on ${opp.opportunity_name}`,
      opportunity: opp,
      opportunityId: opp.id,
      size: null as number | null,
    }));
  }, [attachments, flaggedOpps, meta.label, oppById]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        (row.opportunity?.opportunity_name ?? "").toLowerCase().includes(q) ||
        (row.opportunity?.opportunity_code ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sortBy, sortDir, {
        document: (r) => r.name,
        opportunity: (r) => r.opportunity?.opportunity_name,
        stage: (r) => r.opportunity?.blueprint_state ?? r.opportunity?.current_stage,
        size: (r) => r.size,
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

      {!embedded ? (
        <CrmInfoBanner>
          {meta.label} files are attached from an Opportunity blueprint step — open the opportunity to
          upload or review.
        </CrmInfoBanner>
      ) : null}

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <CrmListToolbar
          title={meta.title}
          subtitle={meta.subtitle}
          icon={FileStack}
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
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <CrmSortableTh label="Document" sortKey="document" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Opportunity" sortKey="opportunity" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Stage" sortKey="stage" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Size" sortKey="size" activeKey={sortBy} dir={sortDir} onSort={onSort} />
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
                    No {meta.title.toLowerCase()} documents yet.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-medium">
                      {row.attachmentId ? (
                        <button
                          type="button"
                          className="cursor-pointer text-left text-primary transition-opacity duration-200 hover:underline hover:opacity-80"
                          onClick={() => {
                            void openAttachmentInNewTab(row.attachmentId!).catch(() => {
                              window.alert("Could not open this attachment.");
                            });
                          }}
                        >
                          {row.name}
                        </button>
                      ) : (
                        row.name
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.opportunityId ? (
                        <Link
                          href={`/crm/opportunities/${row.opportunityId}`}
                          className="cursor-pointer text-primary hover:underline"
                        >
                          {row.opportunity?.opportunity_name ?? row.opportunityId.slice(0, 8)}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {row.opportunity?.opportunity_code ? (
                        <div className="text-[11px] text-muted-foreground">
                          {row.opportunity.opportunity_code}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground capitalize">
                      {(row.opportunity?.blueprint_state ?? row.opportunity?.current_stage ?? "—").replaceAll(
                        "_",
                        " ",
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {row.size != null ? `${Math.max(1, Math.round(row.size / 1024))} KB` : "—"}
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
