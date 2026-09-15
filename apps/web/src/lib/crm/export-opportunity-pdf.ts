/**
 * Opportunity PDF — table sections matching the detail page LeadDetailsCard.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { formatCrmCode } from "@/lib/crm/format-crm-code";
import { downloadPdf, openPdfInNewTab } from "@/lib/crm/open-pdf-preview";
import {
  formatInr,
  type Company,
  type Opportunity,
  type SalesLead,
} from "@/services/sales-crm-service";

export type OpportunityExportInput = {
  opportunity: Opportunity;
  lead?: SalesLead | null;
  company?: Company | null;
  leadOwnerName?: string | null;
  presalesOwnerName?: string | null;
  leadSourceName?: string | null;
};

const PORTRAIT_W = 210;
const MARGIN = 12;

const TEXT: [number, number, number] = [0x22, 0x22, 0x22];
const LABEL: [number, number, number] = [0x3a, 0x3a, 0x3a];
const SECTION: [number, number, number] = [0x1a, 0x56, 0xdb];
const BORDER: [number, number, number] = [0xb8, 0xbe, 0xc8];
const HEAD_FILL: [number, number, number] = [0xe8, 0xee, 0xf6];
const LABEL_FILL: [number, number, number] = [0xf3, 0xf5, 0xf8];

function pdfSafe(text: string): string {
  return text
    .replace(/\u20B9/g, "Rs.")
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text ? pdfSafe(text) : "-";
}

function formatLeadStatus(lead: SalesLead): string {
  if (
    lead.status === "converted" ||
    lead.blueprint_state === "converted" ||
    Boolean(lead.converted_opportunity_id)
  ) {
    return "Converted to Opportunity";
  }
  if (lead.status === "new") return "New";
  return lead.status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function lastTableY(doc: jsPDF, fallback: number): number {
  return ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback) + 6;
}

function toTwoColRows(
  left: Array<[string, string]>,
  right: Array<[string, string]> = [],
): string[][] {
  const rows: string[][] = [];
  const n = Math.max(left.length, right.length);
  for (let i = 0; i < n; i++) {
    const [ll, lv] = left[i] ?? ["", ""];
    const [rl, rv] = right[i] ?? ["", ""];
    rows.push([pdfSafe(ll), dash(lv), pdfSafe(rl), dash(rv)]);
  }
  return rows;
}

function drawSectionTable(
  doc: jsPDF,
  startY: number,
  title: string,
  left: Array<[string, string]>,
  right: Array<[string, string]> = [],
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const usable = pageW - MARGIN * 2;
  const labelW = usable * 0.18;
  const valueW = usable * 0.32;

  autoTable(doc, {
    startY,
    margin: { left: MARGIN, right: MARGIN, top: 14, bottom: 14 },
    head: [[title, "", "", ""]],
    body: toTwoColRows(left, right),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: { top: 2.6, right: 2.2, bottom: 2.6, left: 2.2 },
      textColor: TEXT,
      lineColor: BORDER,
      lineWidth: 0.25,
      overflow: "linebreak",
      valign: "middle",
      minCellHeight: 7.5,
    },
    headStyles: {
      fillColor: HEAD_FILL,
      textColor: SECTION,
      fontStyle: "bold",
      fontSize: 10,
      cellPadding: { top: 3.2, right: 2.2, bottom: 3.2, left: 2.2 },
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: labelW, fillColor: LABEL_FILL, fontStyle: "bold", textColor: LABEL, fontSize: 8 },
      1: { cellWidth: valueW, fontStyle: "normal", textColor: TEXT },
      2: { cellWidth: labelW, fillColor: LABEL_FILL, fontStyle: "bold", textColor: LABEL, fontSize: 8 },
      3: { cellWidth: valueW, fontStyle: "normal", textColor: TEXT },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index > 0) {
        data.cell.text = [""];
      }
    },
  });

  return lastTableY(doc, startY);
}

function drawRemarksTable(doc: jsPDF, startY: number, remarks: string): number {
  const pageW = doc.internal.pageSize.getWidth();
  const usable = pageW - MARGIN * 2;

  autoTable(doc, {
    startY,
    margin: { left: MARGIN, right: MARGIN, top: 14, bottom: 14 },
    head: [["Lead Remarks", ""]],
    body: [["Remarks", dash(remarks)]],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: { top: 3, right: 2.4, bottom: 3, left: 2.4 },
      textColor: TEXT,
      lineColor: BORDER,
      lineWidth: 0.25,
      overflow: "linebreak",
      valign: "top",
      minCellHeight: 18,
    },
    headStyles: {
      fillColor: HEAD_FILL,
      textColor: SECTION,
      fontStyle: "bold",
      fontSize: 10,
    },
    columnStyles: {
      0: {
        cellWidth: usable * 0.22,
        fillColor: LABEL_FILL,
        fontStyle: "bold",
        textColor: LABEL,
        fontSize: 8,
      },
      1: { cellWidth: usable * 0.78, fontStyle: "normal", textColor: TEXT },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index > 0) {
        data.cell.text = [""];
      }
    },
  });

  return lastTableY(doc, startY);
}

function drawPageFooters(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, h - 12, w, 12, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Opportunity", MARGIN, h - 5);
    doc.text(`Page ${i} of ${totalPages}`, w - MARGIN, h - 5, { align: "right" });
  }
}

export function buildOpportunityExportFilename(opportunity: Opportunity): string {
  return `${formatCrmCode(opportunity.opportunity_code) || opportunity.opportunity_code || "opportunity"}.pdf`;
}

export function buildOpportunityPdfDocument(input: OpportunityExportInput): jsPDF {
  const { opportunity, lead, company } = input;
  const companyName = company?.customer_name ?? "-";
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  let y = MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...TEXT);
  doc.text(
    pdfSafe(`Opportunity ${formatCrmCode(opportunity.opportunity_code) || opportunity.opportunity_code || ""}`),
    MARGIN,
    y,
  );
  y += 5;
  doc.setDrawColor(...SECTION);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, PORTRAIT_W - MARGIN, y);
  y += 5;

  y = drawSectionTable(
    doc,
    y,
    "Opportunity Summary",
    [
      ["Opportunity Name", opportunity.opportunity_name],
      ["Opportunity Code", formatCrmCode(opportunity.opportunity_code) || opportunity.opportunity_code],
      ["Stage", opportunity.current_stage],
      ["Status", opportunity.status],
    ],
    [
      ["Expected Revenue", formatInr(opportunity.expected_revenue)],
      ["Probability", `${opportunity.probability_percent ?? 0}%`],
      ["Product Type", opportunity.product_type],
      ["Project Title", opportunity.project_title || lead?.project_title],
    ],
  );

  if (lead) {
    const firstName = [lead.salutation, lead.first_name].filter(Boolean).join(" ").trim() || lead.first_name;
    y = drawSectionTable(
      doc,
      y,
      "Opportunity Information",
      [
        ["Company", companyName],
        ["Project Title *", lead.project_title],
        ["First Name *", firstName],
        ["Last Name *", lead.last_name],
        ["Email *", lead.email],
        ["Mobile *", lead.mobile],
        ["Designation *", lead.designation],
        ["Lead Source *", input.leadSourceName || "-"],
        ["Product Type *", lead.product_type],
        ["Sub Product Category *", lead.sub_product_category],
        ["Requirement Type *", lead.requirement_type],
        ["Sub Product", lead.sub_product],
        ["Purchase Model *", lead.purchase_model],
      ],
      [
        [
          "Engagement Score",
          lead.engagement_score != null ? `${lead.engagement_score}%` : "-",
        ],
        ["DR Number", lead.dr_number],
        ["Sourcing Channel", lead.deal_type],
        ["Lead Owner *", input.leadOwnerName || "-"],
        [
          "Expected Order Value *",
          lead.expected_amount != null ? formatInr(lead.expected_amount) : "-",
        ],
        [
          "Committed Amount",
          lead.committed_amount != null ? formatInr(lead.committed_amount) : "-",
        ],
        ["Status", formatLeadStatus(lead)],
        ["Expected Closure Date *", lead.expected_closure_date],
        ["Presales Owner", input.presalesOwnerName || "-"],
      ],
    );

    y = drawSectionTable(
      doc,
      y,
      "Customer Address Information",
      [
        ["Street", lead.street],
        ["City", lead.city],
        ["State", lead.state],
      ],
      [
        ["Zip Code", lead.zip],
        ["Country", lead.country],
      ],
    );

    y = drawSectionTable(
      doc,
      y,
      "OEM Information",
      [
        ["OEM Name *", lead.oem_name],
        ["OEM Contact Person", lead.oem_contact_person],
      ],
      [
        ["OEM Contact Number", lead.oem_contact_number],
        ["OEM Contact Email", lead.oem_contact_email],
      ],
    );

    y = drawSectionTable(
      doc,
      y,
      "Distributor Information",
      [
        ["Distributor Name", lead.distributor_name],
        ["Distributor Contact Person", lead.distributor_contact_person],
      ],
      [
        ["Distributor Contact Number", lead.distributor_contact],
        ["Distributor Contact Email", lead.distributor_contact_email],
      ],
    );

    y = drawSectionTable(
      doc,
      y,
      "End Customer Detail",
      [["End Customer *", lead.end_customer_name]],
      [["Industry", lead.industry || "None"]],
    );

    y = drawSectionTable(
      doc,
      y,
      "Entity Information",
      [
        ["Entity Name *", lead.entity_name],
        ["Entity Email", lead.entity_email],
        ["Entity Address *", lead.entity_address],
      ],
      [
        ["Organization", companyName],
        ["Entity GST No.", lead.entity_gst],
        ["Entity Contact Number", lead.entity_contact],
      ],
    );

    y = drawRemarksTable(doc, y, lead.notes || "-");
  } else if (opportunity.notes) {
    y = drawRemarksTable(doc, y, opportunity.notes);
  }

  drawPageFooters(doc);
  return doc;
}

/** Open opportunity PDF in a new tab (print preview). */
export function exportOpportunityPdf(input: OpportunityExportInput | Opportunity): void {
  const payload: OpportunityExportInput =
    "opportunity" in input && input.opportunity
      ? input
      : { opportunity: input as Opportunity };
  const doc = buildOpportunityPdfDocument(payload);
  openPdfInNewTab(doc, buildOpportunityExportFilename(payload.opportunity));
}

/** Download opportunity PDF. */
export function downloadOpportunityPdf(input: OpportunityExportInput | Opportunity): void {
  const payload: OpportunityExportInput =
    "opportunity" in input && input.opportunity
      ? input
      : { opportunity: input as Opportunity };
  const doc = buildOpportunityPdfDocument(payload);
  downloadPdf(doc, buildOpportunityExportFilename(payload.opportunity));
}
