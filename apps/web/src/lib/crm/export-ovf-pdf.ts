/**
 * OVF PDF export - table-first layout (Zoho-style print).
 * Overview fields and charge lines are rendered as bordered tables, not free text.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  CACHE_LOGO_MM,
  WOMEN_OWNED_LOGO_MM,
  loadLetterheadLogos,
  pdfImageFormat,
} from "@/utils/pdf-letterhead";
import {
  computeOvfMargins,
  formatChargeRowFileNames,
  normalizeDistributorName,
  type CustomerChargeRow,
  type VendorChargeRow,
} from "@/components/crm/sales/ovf-order-lines-section";
import { downloadPdf, openPdfInNewTab } from "@/lib/crm/open-pdf-preview";
import type { Opportunity, Ovf, Quote } from "@/services/sales-crm-service";

export type OvfExportInput = {
  ovf: Ovf;
  quote: Quote | null;
  opportunity: Opportunity | null;
  customerName: string;
  accountName: string;
  quoteName: string;
  ownerName: string;
  billingAddress: string;
  billingState: string;
  billingCountry: string;
  billingContact: string;
  shippingAddress: string;
  shippingState: string;
  shippingCountry: string;
  shippingContact: string;
  customerRows: CustomerChargeRow[];
  vendorRows: VendorChargeRow[];
  createdBy?: string | null;
  modifiedBy?: string | null;
};

const PORTRAIT_W = 210;
const LANDSCAPE_W = 297;
const LANDSCAPE_H = 210;
const MARGIN = 12;

const TEXT: [number, number, number] = [0x22, 0x22, 0x22];
const LABEL: [number, number, number] = [0x3a, 0x3a, 0x3a];
const SECTION: [number, number, number] = [0x1a, 0x56, 0xdb];
const BORDER: [number, number, number] = [0xb8, 0xbe, 0xc8];
const HEAD_FILL: [number, number, number] = [0xe8, 0xee, 0xf6];
const LABEL_FILL: [number, number, number] = [0xf3, 0xf5, 0xf8];
const ROW_ALT: [number, number, number] = [0xfa, 0xfb, 0xfc];

function pageSize(doc: jsPDF): { w: number; h: number } {
  return {
    w: doc.internal.pageSize.getWidth(),
    h: doc.internal.pageSize.getHeight(),
  };
}

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

function formatMoney(value: number | string | null | undefined, digits = 2): string {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatQty(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  if (Math.abs(safe - Math.round(safe)) < 1e-9) return String(Math.round(safe));
  return safe.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return pdfSafe(value);
  return d.toLocaleString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDeliveryPeriod(value: string | null | undefined): string {
  if (!value) return "-";
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) || /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
    }
  }
  return pdfSafe(trimmed);
}

function personWithWhen(name: string | null | undefined, when: string | null | undefined): string {
  const who = dash(name);
  if (!when) return who;
  const stamped = formatDateTime(when);
  if (stamped === "-") return who;
  return who === "-" ? stamped : `${who}\n${stamped}`;
}

function stageLabel(ovf: Ovf): string {
  if (ovf.deal_won) return "Deal Won";
  if (ovf.shared_to_scm) return "OVF sent to SCM team";
  const map: Record<string, string> = {
    draft: "Draft",
    approval: "Pending Approval",
    approved: "Approved",
    shared_scm: "OVF sent to SCM team",
    deal_won: "Deal Won",
  };
  return map[ovf.blueprint_state] || ovf.blueprint_state.replaceAll("_", " ");
}

function lastTableY(doc: jsPDF, fallback: number): number {
  return ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback) + 6;
}

function drawPageFooters(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const isLandscape = doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight();
    const w = isLandscape ? LANDSCAPE_W : PORTRAIT_W;
    const h = isLandscape ? LANDSCAPE_H : doc.internal.pageSize.getHeight();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, h - 12, w, 12, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("OVF Module", MARGIN, h - 5);
    doc.text(`Page ${i} of ${totalPages}`, w - MARGIN, h - 5, { align: "right" });
  }
}

/** Pair left/right fields into Label | Value | Label | Value table rows. */
function toTwoColRows(
  left: Array<[string, string]>,
  right: Array<[string, string]>,
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
  right: Array<[string, string]>,
): number {
  const pageW = pageSize(doc).w;
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
      cellPadding: { top: 2.8, right: 2.4, bottom: 2.8, left: 2.4 },
      textColor: TEXT,
      lineColor: BORDER,
      lineWidth: 0.25,
      overflow: "linebreak",
      valign: "middle",
      minCellHeight: 8,
    },
    headStyles: {
      fillColor: HEAD_FILL,
      textColor: SECTION,
      fontStyle: "bold",
      fontSize: 10,
      cellPadding: { top: 3.5, right: 2.4, bottom: 3.5, left: 2.4 },
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: labelW, fillColor: LABEL_FILL, fontStyle: "bold", textColor: LABEL, fontSize: 8 },
      1: { cellWidth: valueW, fontStyle: "normal", textColor: TEXT },
      2: { cellWidth: labelW, fillColor: LABEL_FILL, fontStyle: "bold", textColor: LABEL, fontSize: 8 },
      3: { cellWidth: valueW, fontStyle: "normal", textColor: TEXT },
    },
    didParseCell: (data) => {
      if (data.section === "head") {
        // Span title across all columns visually by emptying extras.
        if (data.column.index > 0) {
          data.cell.text = [""];
        }
      }
    },
  });

  return lastTableY(doc, startY);
}

function drawKvTable(
  doc: jsPDF,
  startY: number,
  title: string,
  rows: Array<[string, string]>,
): number {
  const pageW = pageSize(doc).w;
  const usable = pageW - MARGIN * 2;

  autoTable(doc, {
    startY,
    margin: { left: MARGIN, right: MARGIN, top: 14, bottom: 14 },
    head: [[title, ""]],
    body: rows.map(([label, value]) => [pdfSafe(label), dash(value)]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: { top: 2.8, right: 2.4, bottom: 2.8, left: 2.4 },
      textColor: TEXT,
      lineColor: BORDER,
      lineWidth: 0.25,
      overflow: "linebreak",
      valign: "middle",
      minCellHeight: 8,
    },
    headStyles: {
      fillColor: HEAD_FILL,
      textColor: SECTION,
      fontStyle: "bold",
      fontSize: 10,
      cellPadding: { top: 3.5, right: 2.4, bottom: 3.5, left: 2.4 },
    },
    columnStyles: {
      0: {
        cellWidth: usable * 0.36,
        fillColor: LABEL_FILL,
        fontStyle: "bold",
        textColor: LABEL,
        fontSize: 8,
      },
      1: { cellWidth: usable * 0.64, fontStyle: "normal", textColor: TEXT },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index > 0) {
        data.cell.text = [""];
      }
    },
  });

  return lastTableY(doc, startY);
}

function chargeTableStyles() {
  return {
    font: "helvetica" as const,
    fontSize: 8,
    cellPadding: { top: 2.6, right: 2, bottom: 2.6, left: 2 },
    textColor: TEXT,
    lineColor: BORDER,
    lineWidth: 0.25,
    overflow: "linebreak" as const,
    valign: "middle" as const,
    minCellHeight: 8,
  };
}

function chargeHeadStyles() {
  return {
    fillColor: HEAD_FILL,
    textColor: TEXT,
    fontStyle: "bold" as const,
    fontSize: 7.5,
    cellPadding: { top: 3, right: 2, bottom: 3, left: 2 },
    valign: "middle" as const,
    overflow: "linebreak" as const,
  };
}

export function buildOvfExportFilename(ovf: Ovf, quoteName?: string | null): string {
  const base = (quoteName || ovf.quote_name || ovf.ovf_no || "OVF")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return `OVF_${base || ovf.ovf_no}.pdf`;
}

export async function buildOvfPdfDocument(input: OvfExportInput): Promise<jsPDF> {
  const { cache: cacheLogo, womenOwned: womenLogo } = await loadLetterheadLogos();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const { ovf, quote, opportunity, customerRows, vendorRows } = input;
  const { totalMarginAmount, totalMarginPct } = computeOvfMargins({
    customerRows,
    vendorRows,
    freight: ovf.freight,
    financeCostPct: ovf.finance_cost_pct,
  });

  const saleTotal = customerRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  const purchaseTotal = vendorRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);

  let y = MARGIN;
  if (cacheLogo) {
    doc.addImage(
      cacheLogo,
      pdfImageFormat(cacheLogo),
      MARGIN,
      y,
      CACHE_LOGO_MM.w,
      CACHE_LOGO_MM.h,
    );
  }
  if (womenLogo) {
    doc.addImage(
      womenLogo,
      pdfImageFormat(womenLogo),
      PORTRAIT_W - MARGIN - WOMEN_OWNED_LOGO_MM.w,
      y + (CACHE_LOGO_MM.h - WOMEN_OWNED_LOGO_MM.h) / 2,
      WOMEN_OWNED_LOGO_MM.w,
      WOMEN_OWNED_LOGO_MM.h,
    );
  }
  y += CACHE_LOGO_MM.h + 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...TEXT);
  doc.text("OVF Module Information", MARGIN, y);
  y += 5;
  doc.setDrawColor(...SECTION);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, PORTRAIT_W - MARGIN, y);
  y += 5;

  y = drawSectionTable(
    doc,
    y,
    "OVF Module Information",
    [
      ["Customer Name", input.customerName],
      ["Billing Address", input.billingAddress],
      ["Billing State", input.billingState],
      ["Contact Person", input.billingContact],
      ["Country", input.billingCountry],
      ["PO Number", ovf.po_number || "-"],
      ["Delivery Period", formatDeliveryPeriod(ovf.delivery_period)],
      ["Installation/Service Details", ovf.installation_details || "-"],
      ["Created By", personWithWhen(input.createdBy || input.ownerName, ovf.created_at)],
      ["Delivery Follow Up", "No"],
      ["Ovf Rec id1", ovf.id],
      ["Ovf sent to SCM team", ovf.shared_to_scm ? "Yes" : "No"],
    ],
    [
      ["Quote Name", input.quoteName],
      ["Quote No", quote?.quote_no || "-"],
      ["OVF Number", ovf.ovf_no],
      ["OVF Module Owner", input.ownerName],
      ["Shipping Address", input.shippingAddress],
      ["Shipping State", input.shippingState],
      ["Contact Person.", input.shippingContact],
      ["Country.", input.shippingCountry],
      ["Modified By", personWithWhen(input.modifiedBy || input.ownerName, ovf.updated_at || ovf.created_at)],
      ["Account", input.accountName],
      ["Stages", stageLabel(ovf)],
      ["OVF Version", String(ovf.version)],
      ["Tag", "-"],
    ],
  );

  y = drawSectionTable(
    doc,
    y,
    "Technology Segment & Sub Technology Segment",
    [
      ["Technology Segment", ovf.technology_segment || "-"],
      ["Other Sub Technology Segment", ovf.sub_technology_segment || "-"],
    ],
    [["Sub Technology Segment.", ovf.sub_technology_segment || "-"]],
  );

  y = drawSectionTable(
    doc,
    y,
    "Charges and Details",
    [
      ["Total Margin in Amount.", formatMoney(totalMarginAmount)],
      ["Total Margin In Percentage.", `${formatMoney(totalMarginPct)}%`],
      ["Opportunity", opportunity?.opportunity_name || "-"],
      ["Approval Status", ovf.approval_status.replaceAll("_", " ")],
      ["Additional Charges", formatMoney(ovf.additional_charges)],
    ],
    [
      ["Vendor Payments Terms", `${ovf.vendor_payment_days} days`],
      ["Customer Payment Term", `${ovf.customer_payment_days} days`],
      ["Freight Charges", formatMoney(ovf.freight)],
      ["Finance Cost (%)", `${formatMoney(ovf.finance_cost_pct)}%`],
    ],
  );

  y = drawKvTable(doc, y, "Totals", [
    ["Total Sale Value", formatMoney(saleTotal, 0)],
    ["Total Purchase Value", formatMoney(purchaseTotal, 0)],
  ]);

  // Charge tables on landscape so every column fits.
  doc.addPage("a4", "l");
  y = 14;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: 12, bottom: 14 },
    head: [
      [
        {
          content: "Customer Charges.",
          colSpan: 9,
          styles: {
            fillColor: HEAD_FILL,
            textColor: SECTION,
            fontStyle: "bold",
            fontSize: 10,
            halign: "left",
          },
        },
      ],
      [
        "Product Name",
        "Description",
        "Qty",
        "Unit Amount (Rs.)",
        "Total",
        "GST %",
        "GST Amount",
        "Amount with GST",
        "PO Files",
      ],
    ],
    body:
      customerRows.length > 0
        ? customerRows.map((row) => [
            pdfSafe(row.product_name || "-"),
            pdfSafe(row.description || "-"),
            formatQty(row.qty),
            formatMoney(row.unit_price),
            formatMoney(row.total, 0),
            `${dash(row.gst_pct)}%`,
            formatMoney(row.total_gst, 0),
            formatMoney(row.total_with_gst, 0),
            pdfSafe(formatChargeRowFileNames(row.poFiles)),
          ])
        : [["-", "-", "-", "-", "-", "-", "-", "-", "-"]],
    theme: "grid",
    styles: chargeTableStyles(),
    headStyles: chargeHeadStyles(),
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { cellWidth: 42, halign: "left" },
      1: { cellWidth: 40, halign: "left" },
      2: { cellWidth: 16, halign: "right" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 16, halign: "center" },
      6: { cellWidth: 26, halign: "right" },
      7: { cellWidth: 30, halign: "right" },
      8: { cellWidth: 41, halign: "left" },
    },
  });

  y = lastTableY(doc, y) + 4;
  if (y > LANDSCAPE_H - 55) {
    doc.addPage("a4", "l");
    y = 14;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: 12, bottom: 14 },
    head: [
      [
        {
          content: "Vendor Charges.",
          colSpan: 12,
          styles: {
            fillColor: HEAD_FILL,
            textColor: SECTION,
            fontStyle: "bold",
            fontSize: 10,
            halign: "left",
          },
        },
      ],
      [
        "Product Name",
        "Description",
        "Qty",
        "Unit Purchase (Rs.)",
        "Total",
        "GST %",
        "GST Amount",
        "Amount with GST",
        "Distributor Name",
        "Contact Person",
        "Contact No.",
        "Quote Files",
      ],
    ],
    body:
      vendorRows.length > 0
        ? vendorRows.map((row) => [
            pdfSafe(row.product_name || "-"),
            pdfSafe(row.description || "-"),
            formatQty(row.qty),
            formatMoney(row.unit_price),
            formatMoney(row.total, 0),
            `${dash(row.gst_pct)}%`,
            formatMoney(row.total_gst, 0),
            formatMoney(row.total_with_gst, 0),
            pdfSafe(normalizeDistributorName(row.vendor_name) || "-"),
            pdfSafe(row.contact_person || "-"),
            pdfSafe(row.contact_number || "-"),
            pdfSafe(formatChargeRowFileNames(row.quoteFiles)),
          ])
        : [["-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-"]],
    theme: "grid",
    styles: chargeTableStyles(),
    headStyles: chargeHeadStyles(),
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { cellWidth: 30, halign: "left" },
      1: { cellWidth: 28, halign: "left" },
      2: { cellWidth: 12, halign: "right" },
      3: { cellWidth: 24, halign: "right" },
      4: { cellWidth: 18, halign: "right" },
      5: { cellWidth: 14, halign: "center" },
      6: { cellWidth: 20, halign: "right" },
      7: { cellWidth: 24, halign: "right" },
      8: { cellWidth: 32, halign: "left" },
      9: { cellWidth: 24, halign: "left" },
      10: { cellWidth: 22, halign: "left" },
      11: { cellWidth: 25, halign: "left" },
    },
  });

  drawPageFooters(doc);
  return doc;
}

/** Download OVF as PDF. */
export async function exportOvfPdf(input: OvfExportInput): Promise<void> {
  const doc = await buildOvfPdfDocument(input);
  downloadPdf(doc, buildOvfExportFilename(input.ovf, input.quoteName));
}

/** Open OVF PDF in a new tab (print preview - same file Export downloads). */
export async function openOvfPrintPreview(input: OvfExportInput): Promise<void> {
  const doc = await buildOvfPdfDocument(input);
  openPdfInNewTab(doc, buildOvfExportFilename(input.ovf, input.quoteName));
}
