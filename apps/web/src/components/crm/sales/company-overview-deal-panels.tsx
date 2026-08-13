"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  FileStack,
  FileText,
  Handshake,
  Users,
  type LucideIcon,
} from "lucide-react";

import { AttachmentDocumentCell } from "@/components/crm/sales/attachment-document-cell";
import {
  CrmCountBadge,
  CrmIconBadge,
  CrmListPanel,
  CrmViewAllLink,
  CRM_TABLE_HEAD_CELL,
  CRM_TABLE_HEAD_ROW,
} from "@/components/crm/crm-ui";
import { Badge } from "@/components/ui/badge";
import {
  formatInr,
  listOvfLines,
  type Attachment,
  type Contact,
  type Opportunity,
  type Ovf,
  type Quote,
} from "@/services/sales-crm-service";
import {
  customerRowsFromOvfLines,
  sumLineTotals,
  vendorRowsFromOvfLines,
} from "@/components/crm/sales/ovf-order-lines-section";

const PREVIEW_LIMIT = 5;

export type CompanyOvfOverviewRow = Ovf & {
  totalSaleValue: number;
  totalPurchaseValue: number;
};

export async function enrichCompanyOvfsWithTotals(ovfs: Ovf[]): Promise<CompanyOvfOverviewRow[]> {
  return Promise.all(
    ovfs.map(async (ovf) => {
      const lines = await listOvfLines(ovf.id).catch(() => []);
      return {
        ...ovf,
        totalSaleValue: sumLineTotals(customerRowsFromOvfLines(lines)),
        totalPurchaseValue: sumLineTotals(vendorRowsFromOvfLines(lines)),
      };
    }),
  );
}

export type DocPreviewRow = {
  id: string;
  attachmentId: string | null;
  name: string;
  opportunityId: string | null;
  opportunityName: string | null;
  opportunityCode: string | null;
  stage: string | null;
  size: number | null;
};

export function buildCompanyDocumentPreviewRows(
  attachments: Attachment[],
  opportunities: Opportunity[],
  flag: keyof Opportunity,
  label: string,
): DocPreviewRow[] {
  const oppById = new Map(opportunities.map((opp) => [opp.id, opp]));
  const oppIds = new Set(opportunities.map((opp) => opp.id));
  const scopedFiles = attachments.filter(
    (file) => file.entity_type === "opportunity" && oppIds.has(file.entity_id),
  );

  if (scopedFiles.length > 0) {
    return scopedFiles.map((file) => {
      const opp = file.entity_type === "opportunity" ? oppById.get(file.entity_id) : undefined;
      return {
        id: file.id,
        attachmentId: file.id,
        name: file.file_name,
        opportunityId: file.entity_type === "opportunity" ? file.entity_id : null,
        opportunityName: opp?.opportunity_name ?? null,
        opportunityCode: opp?.opportunity_code ?? null,
        stage: opp?.blueprint_state ?? opp?.current_stage ?? null,
        size: file.size,
      };
    });
  }

  return opportunities
    .filter((opp) => Boolean(opp[flag]))
    .map((opp) => ({
      id: opp.id,
      attachmentId: null,
      name: `${label} on ${opp.opportunity_name}`,
      opportunityId: opp.id,
      opportunityName: opp.opportunity_name,
      opportunityCode: opp.opportunity_code,
      stage: opp.blueprint_state ?? opp.current_stage,
      size: null,
    }));
}

function OverviewPanelHeader({
  icon: Icon,
  title,
  subtitle,
  count,
  viewAllHref,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  count: number;
  viewAllHref: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <CrmIconBadge icon={Icon} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold tracking-tight text-foreground">{title}</h2>
            <CrmCountBadge count={count} />
          </div>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <CrmViewAllLink href={viewAllHref} />
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className={CRM_TABLE_HEAD_CELL}>{children}</th>;
}

export function CompanyOverviewDealPanels({
  companyAccountId,
  companyCustomerName,
  opportunities,
  oemQuoteRows,
  quotes,
  purchaseOrderRows,
  ovfs,
  contacts,
  onDocumentsChanged,
}: {
  companyAccountId: string;
  companyCustomerName: string;
  opportunities: Opportunity[];
  oemQuoteRows: DocPreviewRow[];
  quotes: Quote[];
  purchaseOrderRows: DocPreviewRow[];
  ovfs: CompanyOvfOverviewRow[];
  contacts: Contact[];
  onDocumentsChanged?: () => void | Promise<void>;
}) {
  const base = `/crm/companies/${companyAccountId}`;
  const opportunityById = useMemo(
    () => new Map(opportunities.map((opp) => [opp.id, opp])),
    [opportunities],
  );

  return (
    <>
      <div id="company-opportunities">
        <CrmListPanel>
          <OverviewPanelHeader
            icon={Handshake}
            title="Opportunities"
            subtitle="Deals converted from leads"
            count={opportunities.length}
            viewAllHref={`${base}/opportunities`}
          />
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className={CRM_TABLE_HEAD_ROW}>
                  <Th>Opportunity</Th>
                  <Th>Customer</Th>
                  <Th>Stage</Th>
                  <Th>Expected Revenue</Th>
                  <Th>Remark</Th>
                </tr>
              </thead>
              <tbody>
                {opportunities.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No opportunities yet.
                    </td>
                  </tr>
                ) : (
                  opportunities.slice(0, PREVIEW_LIMIT).map((row) => (
                    <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        <Link href={`/crm/opportunities/${row.id}`} className="cursor-pointer hover:underline">
                          {row.opportunity_name}
                        </Link>
                        <div className="text-[11px] font-normal text-muted-foreground">{row.opportunity_code}</div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {companyCustomerName.trim() || "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="capitalize">
                          {row.current_stage.replaceAll("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatInr(row.expected_revenue)}</td>
                      <td className="max-w-[240px] px-4 py-2.5 text-muted-foreground">
                        <span className="line-clamp-2">{row.notes?.trim() || "—"}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CrmListPanel>
      </div>

      <div id="company-oem-quotes">
        <CrmListPanel>
          <OverviewPanelHeader
            icon={FileStack}
            title="OEM Quote"
            subtitle="OEM quotation documents"
            count={oemQuoteRows.length}
            viewAllHref={`${base}/oem-quotes`}
          />
          <DocumentPreviewTable
            rows={oemQuoteRows}
            emptyLabel="No OEM quote documents yet."
            onDocumentsChanged={onDocumentsChanged}
          />
        </CrmListPanel>
      </div>

      <div id="company-quotes">
        <CrmListPanel>
          <OverviewPanelHeader
            icon={FileText}
            title="Quotes"
            subtitle="Customer quotations"
            count={quotes.length}
            viewAllHref={`${base}/quotes`}
          />
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className={CRM_TABLE_HEAD_ROW}>
                  <Th>Opportunity Name</Th>
                  <Th>Subject</Th>
                  <Th>Quote Stage</Th>
                  <Th>Total Margin Amount</Th>
                  <Th>Grand Total</Th>
                </tr>
              </thead>
              <tbody>
                {quotes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No quotes yet.
                    </td>
                  </tr>
                ) : (
                  quotes.slice(0, PREVIEW_LIMIT).map((row) => {
                    const opportunity = opportunityById.get(row.opportunity_id);
                    const subject = row.subject?.trim() || row.project_title?.trim() || "—";
                    return (
                      <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          {opportunity ? (
                            <Link
                              href={`/crm/opportunities/${opportunity.id}`}
                              className="cursor-pointer hover:underline"
                            >
                              {opportunity.opportunity_name}
                            </Link>
                          ) : (
                            "—"
                          )}
                          {row.quote_no ? (
                            <div className="text-[11px] font-normal text-muted-foreground">{row.quote_no}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          <Link href={`/crm/quotes/${row.id}`} className="cursor-pointer hover:underline">
                            {subject}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className="capitalize">
                            {row.quote_stage.replaceAll("_", " ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatInr(row.total_margin_amount)}</td>
                        <td className="px-4 py-2.5 font-medium text-foreground">{formatInr(row.grand_total)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CrmListPanel>
      </div>

      <div id="company-purchase-orders">
        <CrmListPanel>
          <OverviewPanelHeader
            icon={FileStack}
            title="Purchase Order"
            subtitle="Customer purchase orders"
            count={purchaseOrderRows.length}
            viewAllHref={`${base}/purchase-orders`}
          />
          <DocumentPreviewTable
            rows={purchaseOrderRows}
            emptyLabel="No purchase order documents yet."
            onDocumentsChanged={onDocumentsChanged}
          />
        </CrmListPanel>
      </div>

      <div id="company-ovf">
        <CrmListPanel>
          <OverviewPanelHeader
            icon={ClipboardCheck}
            title="OVF"
            subtitle="Order value forms"
            count={ovfs.length}
            viewAllHref={`${base}/ovf`}
          />
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className={CRM_TABLE_HEAD_ROW}>
                  <Th>Opportunity Name</Th>
                  <Th>PO Number</Th>
                  <Th>Total Margin Amount</Th>
                  <Th>Total Margin %</Th>
                  <Th>Total Sale Value</Th>
                  <Th>Total Purchase Value</Th>
                </tr>
              </thead>
              <tbody>
                {ovfs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No OVFs yet.
                    </td>
                  </tr>
                ) : (
                  ovfs.slice(0, PREVIEW_LIMIT).map((row) => {
                    const opportunity = opportunityById.get(row.opportunity_id);
                    return (
                      <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          {opportunity ? (
                            <Link
                              href={`/crm/opportunities/${opportunity.id}`}
                              className="cursor-pointer hover:underline"
                            >
                              {opportunity.opportunity_name}
                            </Link>
                          ) : (
                            row.quote_name?.trim() || "—"
                          )}
                          <div className="text-[11px] font-normal text-muted-foreground">
                            <Link href={`/crm/ovf/${row.id}`} className="cursor-pointer hover:underline">
                              {row.ovf_no}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{row.po_number ?? "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {formatInr(row.total_margin_amount)}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{row.total_margin_pct}%</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatInr(row.totalSaleValue)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatInr(row.totalPurchaseValue)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CrmListPanel>
      </div>

      <div id="company-contacts">
        <CrmListPanel>
          <OverviewPanelHeader
            icon={Users}
            title="Contacts"
            subtitle="People linked to this account"
            count={contacts.length}
            viewAllHref={`${base}/contacts`}
          />
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className={CRM_TABLE_HEAD_ROW}>
                  <Th>Customer Name</Th>
                  <Th>Designation</Th>
                  <Th>Mobile</Th>
                  <Th>Email</Th>
                </tr>
              </thead>
              <tbody>
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No contacts yet.
                    </td>
                  </tr>
                ) : (
                  contacts.slice(0, PREVIEW_LIMIT).map((row) => (
                    <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {companyCustomerName.trim() || "—"}
                        <div className="text-[11px] font-normal text-muted-foreground">
                          {[row.first_name, row.last_name].filter(Boolean).join(" ")}
                          {row.is_primary ? " · Primary" : ""}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.title?.trim() || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.mobile ?? row.phone ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.email ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CrmListPanel>
      </div>
    </>
  );
}

function DocumentPreviewTable({
  rows,
  emptyLabel,
  onDocumentsChanged,
}: {
  rows: DocPreviewRow[];
  emptyLabel: string;
  onDocumentsChanged?: () => void | Promise<void>;
}) {
  return (
    <div className="erp-scroll overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className={CRM_TABLE_HEAD_ROW}>
            <Th>Opportunity Name</Th>
            <Th>Document Attached</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.slice(0, PREVIEW_LIMIT).map((row) => (
              <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                <td className="px-4 py-2.5 font-medium text-foreground">
                  {row.opportunityId ? (
                    <Link
                      href={`/crm/opportunities/${row.opportunityId}`}
                      className="cursor-pointer hover:underline"
                    >
                      {row.opportunityName ?? row.opportunityId.slice(0, 8)}
                    </Link>
                  ) : (
                    "—"
                  )}
                  {row.opportunityCode ? (
                    <div className="text-[11px] font-normal text-muted-foreground">{row.opportunityCode}</div>
                  ) : null}
                </td>
                <td className="px-4 py-2.5">
                  <AttachmentDocumentCell row={row} onChanged={onDocumentsChanged} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
