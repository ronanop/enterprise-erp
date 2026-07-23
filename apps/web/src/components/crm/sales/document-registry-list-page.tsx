"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Info, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  listAttachmentsByCategory,
  listOpportunities,
  openAttachmentInNewTab,
  type Attachment,
  type Opportunity,
} from "@/services/sales-crm-service";

export type DocumentCategory = "oem_quote" | "customer_po" | "boq" | "sow";

const META: Record<
  DocumentCategory,
  { title: string; description: string; flag: keyof Opportunity; label: string }
> = {
  oem_quote: {
    title: "OEM Quote",
    description: "OEM quotations attached on opportunities before customer quote creation.",
    flag: "oem_quote_attached",
    label: "OEM Quote",
  },
  customer_po: {
    title: "Purchase Order",
    description: "Customer purchase orders attached after quote acceptance.",
    flag: "customer_po_attached",
    label: "Customer PO",
  },
  boq: {
    title: "BOQ",
    description: "Bill of Quantities documents attached on opportunities.",
    flag: "boq_attached",
    label: "BOQ",
  },
  sow: {
    title: "SOW",
    description: "Statement of Work documents attached on opportunities.",
    flag: "sow_attached",
    label: "SOW",
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

  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      row.name.toLowerCase().includes(q) ||
      (row.opportunity?.opportunity_name ?? "").toLowerCase().includes(q) ||
      (row.opportunity?.opportunity_code ?? "").toLowerCase().includes(q)
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

      {!embedded ? (
        <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-900">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          {meta.label} files are attached from an Opportunity blueprint step — open the opportunity to
          upload or review.
        </div>
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
                <th className="px-4 py-2.5">Document</th>
                <th className="px-4 py-2.5">Opportunity</th>
                <th className="px-4 py-2.5">Stage</th>
                <th className="px-4 py-2.5">Size</th>
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
                    No {meta.title.toLowerCase()} documents yet.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
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
      </div>
    </div>
  );
}
