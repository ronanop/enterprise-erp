/**
 * OVF PDF export matching the Zoho "OVF Module" print preview layout.
 * Prioritizes readability: stacked label/value fields, generous spacing,
 * and landscape charge tables (extra pages are fine).
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  computeOvfMargins,
  formatChargeRowFileNames,
  type CustomerChargeRow,
  type VendorChargeRow,
} from "@/components/crm/sales/ovf-order-lines-section";
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
const PORTRAIT_H = 297;
const LANDSCAPE_W = 297;
const LANDSCAPE_H = 210;
const MARGIN = 14;
const COL_GAP = 10;
const FIELD_GAP = 5.5;
const LINE_H = 5;

const TEXT: [number, number, number] = [0x22, 0x22, 0x22];
const LABEL: [number, number, number] = [0x4a, 0x4a, 0x4a];
const SECTION: [number, number, number] = [0x1a, 0x56, 0xdb];
const BORDER: [number, number, number] = [0xc8, 0xcd, 0xd4];
const HEAD_FILL: [number, number, number] = [0xee, 0xf1, 0xf5];
const BOX_FILL: [number, number, number] = [0xf4, 0xf7, 0xfc];
const ROW_ALT: [number, number, number] = [0xfa, 0xfb, 0xfc];

type PageRef = { n: number; landscape: boolean };

function pageSize(doc: jsPDF): { w: number; h: number } {
  const [w, h] = doc.internal.pageSize.getWidth
    ? [doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight()]
    : [PORTRAIT_W, PORTRAIT_H];
  return { w, h };
}

function contentWidth(doc: jsPDF): number {
  return pageSize(doc).w - MARGIN * 2;
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
  // Only format as a calendar date when the string is clearly a date, not free text.
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

function drawFooter(doc: jsPDF, pageRef: PageRef) {
  const { w, h } = pageSize(doc);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("OVF Module", MARGIN, h - 8);
  doc.text(`Page ${pageRef.n}`, w - MARGIN, h - 8, { align: "right" });
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  const w = contentWidth(doc);
  const h = 9;
  doc.setFillColor(...BOX_FILL);
  doc.rect(MARGIN, y, w, h, "F");
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.35);
  doc.rect(MARGIN, y, w, h, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...SECTION);
  doc.text(title, MARGIN + 3.5, y + 6);
  return y + h + 6;
}

function ensureSpace(doc: jsPDF, y: number, need: number, pageRef: PageRef): number {
  const { h } = pageSize(doc);
  if (y + need < h - 16) return y;
  drawFooter(doc, pageRef);
  if (pageRef.landscape) {
    doc.addPage("a4", "l");
  } else {
    doc.addPage("a4", "p");
  }
  pageRef.n += 1;
  return 16;
}

function addLandscapePage(doc: jsPDF, pageRef: PageRef): number {
  drawFooter(doc, pageRef);
  doc.addPage("a4", "l");
  pageRef.n += 1;
  pageRef.landscape = true;
  return 16;
}

/**
 * Stacked field: label on its own line, value below — never overlaps.
 */
function drawStackedField(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...LABEL);
  const labelLines = doc.splitTextToSize(`${pdfSafe(label)} :`, width) as string[];
  let yy = y;
  for (const line of labelLines) {
    doc.text(line, x, yy);
    yy += LINE_H;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  const valueLines = doc.splitTextToSize(dash(value), width) as string[];
  for (const line of valueLines) {
    doc.text(line, x, yy);
    yy += LINE_H;
  }
  return yy + FIELD_GAP;
}

function measureStackedField(doc: jsPDF, width: number, label: string, value: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const labelLines = doc.splitTextToSize(`${pdfSafe(label)} :`, width) as string[];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const valueLines = doc.splitTextToSize(dash(value), width) as string[];
  return labelLines.length * LINE_H + valueLines.length * LINE_H + FIELD_GAP;
}

function drawTwoColumnFields(
  doc: jsPDF,
  y: number,
  left: Array<[string, string]>,
  right: Array<[string, string]>,
  pageRef: PageRef,
): number {
  const colW = (contentWidth(doc) - COL_GAP) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colW + COL_GAP;
  let ly = y;
  let ry = y;
  const rows = Math.max(left.length, right.length);

  for (let i = 0; i < rows; i++) {
    const leftH = left[i] ? measureStackedField(doc, colW, left[i][0], left[i][1]) : 0;
    const rightH = right[i] ? measureStackedField(doc, colW, right[i][0], right[i][1]) : 0;
    const need = Math.max(leftH, rightH, 14);
    const top = Math.max(ly, ry);
    const startY = ensureSpace(doc, top, need + 2, pageRef);
    if (startY !== top) {
      ly = startY;
      ry = startY;
    }
    if (left[i]) ly = drawStackedField(doc, leftX, ly, colW, left[i][0], left[i][1]);
    if (right[i]) ry = drawStackedField(doc, rightX, ry, colW, right[i][0], right[i][1]);
    // Keep columns aligned at the taller field so pairs stay readable.
    const synced = Math.max(ly, ry);
    ly = synced;
    ry = synced;
  }
  return Math.max(ly, ry) + 4;
}

function tableBaseStyles() {
  return {
    font: "helvetica" as const,
    fontSize: 9.5,
    cellPadding: { top: 3.2, right: 2.8, bottom: 3.2, left: 2.8 },
    textColor: TEXT,
    lineColor: BORDER,
    lineWidth: 0.25,
    overflow: "linebreak" as const,
    valign: "middle" as const,
    minCellHeight: 10,
  };
}

function tableHeadStyles() {
  return {
    fillColor: HEAD_FILL,
    textColor: TEXT,
    fontStyle: "bold" as const,
    fontSize: 9,
    cellPadding: { top: 3.5, right: 2.8, bottom: 3.5, left: 2.8 },
    valign: "middle" as const,
  };
}

export function buildOvfExportFilename(ovf: Ovf, quoteName?: string | null): string {
  const base = (quoteName || ovf.quote_name || ovf.ovf_no || "OVF")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return `OVF_${base || ovf.ovf_no}.pdf`;
}

export function exportOvfPdf(input: OvfExportInput): void {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageRef: PageRef = { n: 1, landscape: false };
  const { ovf, quote, opportunity, customerRows, vendorRows } = input;
  const { totalMarginAmount, totalMarginPct } = computeOvfMargins({
    customerRows,
    vendorRows,
    freight: ovf.freight,
    financeCostPct: ovf.finance_cost_pct,
  });

  const saleTotal = customerRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  const purchaseTotal = vendorRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);

  let y = 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...TEXT);
  doc.text("OVF Module Information", MARGIN, y);
  y += 7;
  doc.setDrawColor(...SECTION);
  doc.setLineWidth(0.7);
  doc.line(MARGIN, y, PORTRAIT_W - MARGIN, y);
  y += 8;

  y = drawTwoColumnFields(
    doc,
    y,
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
    pageRef,
  );

  y = ensureSpace(doc, y + 2, 36, pageRef);
  y = sectionTitle(doc, "Technology Segment & Sub Technology Segment", y);
  y = drawTwoColumnFields(
    doc,
    y,
    [
      ["Technology Segment", ovf.technology_segment || "-"],
      ["Other Sub Technology Segment", ovf.sub_technology_segment || "-"],
    ],
    [["Sub Technology Segment.", ovf.sub_technology_segment || "-"]],
    pageRef,
  );

  y = ensureSpace(doc, y + 2, 40, pageRef);
  y = sectionTitle(doc, "Charges and Details", y);
  y = drawTwoColumnFields(
    doc,
    y,
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
    pageRef,
  );

  y = ensureSpace(doc, y + 2, 22, pageRef);
  const totalsW = contentWidth(doc);
  doc.setFillColor(...HEAD_FILL);
  doc.roundedRect(MARGIN, y, totalsW, 18, 1.2, 1.2, "F");
  doc.setDrawColor(...BORDER);
  doc.roundedRect(MARGIN, y, totalsW, 18, 1.2, 1.2, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text("Total Sale Value", MARGIN + 4, y + 7);
  doc.text(formatMoney(saleTotal, 0), PORTRAIT_W - MARGIN - 4, y + 7, { align: "right" });
  doc.text("Total Purchase Value", MARGIN + 4, y + 14);
  doc.text(formatMoney(purchaseTotal, 0), PORTRAIT_W - MARGIN - 4, y + 14, { align: "right" });

  // Charge tables on landscape pages so every column stays readable.
  y = addLandscapePage(doc, pageRef);
  y = sectionTitle(doc, "Customer Charges.", y);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: 16, bottom: 16 },
    head: [
      [
        "Product Name",
        "Qty",
        "Unit Amount (Rs.)",
        "Total",
        "GST %",
        "GST Amount",
        "Amount with GST",
        "PO Files",
      ],
    ],
    body: customerRows.map((row) => [
      pdfSafe(row.product_name || "-"),
      formatQty(row.qty),
      formatMoney(row.unit_price),
      formatMoney(row.total, 0),
      `${dash(row.gst_pct)}%`,
      formatMoney(row.total_gst, 0),
      formatMoney(row.total_with_gst, 0),
      pdfSafe(formatChargeRowFileNames(row.poFiles)),
    ]),
    styles: tableBaseStyles(),
    headStyles: tableHeadStyles(),
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { cellWidth: 78, halign: "left" },
      1: { cellWidth: 20, halign: "right" },
      2: { cellWidth: 38, halign: "right" },
      3: { cellWidth: 32, halign: "right" },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 34, halign: "right" },
      6: { cellWidth: 40, halign: "right" },
      7: { cellWidth: 52, halign: "left" },
    },
    didDrawPage: () => {
      // autoTable may add pages; keep page counter approximate via footer redraw
      drawFooter(doc, pageRef);
    },
  });

  const afterCustomer =
    ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;

  // Sync page count after autoTable (it may have added pages).
  pageRef.n = doc.getNumberOfPages();
  pageRef.landscape = true;

  let vendorY = afterCustomer;
  if (vendorY > LANDSCAPE_H - 50) {
    vendorY = addLandscapePage(doc, pageRef);
  } else {
    vendorY = ensureSpace(doc, vendorY, 40, pageRef);
  }

  vendorY = sectionTitle(doc, "Vendor Charges.", vendorY);
  autoTable(doc, {
    startY: vendorY,
    margin: { left: MARGIN, right: MARGIN, top: 16, bottom: 16 },
    head: [
      [
        "Qty",
        "Unit Purchase (Rs.)",
        "Total",
        "GST %",
        "GST Amount",
        "Amount with GST",
        "Vendor Name",
        "Contact Person",
        "Contact No.",
        "Quote Files",
      ],
    ],
    body: vendorRows.map((row) => [
      formatQty(row.qty),
      formatMoney(row.unit_price),
      formatMoney(row.total, 0),
      `${dash(row.gst_pct)}%`,
      formatMoney(row.total_gst, 0),
      formatMoney(row.total_with_gst, 0),
      pdfSafe(row.vendor_name || "-"),
      pdfSafe(row.contact_person || "-"),
      pdfSafe(row.contact_number || "-"),
      pdfSafe(formatChargeRowFileNames(row.quoteFiles)),
    ]),
    styles: tableBaseStyles(),
    headStyles: tableHeadStyles(),
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { cellWidth: 16, halign: "right" },
      1: { cellWidth: 34, halign: "right" },
      2: { cellWidth: 26, halign: "right" },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 34, halign: "right" },
      6: { cellWidth: 52, halign: "left" },
      7: { cellWidth: 36, halign: "left" },
      8: { cellWidth: 32, halign: "left" },
      9: { cellWidth: 52, halign: "left" },
    },
    didDrawPage: () => drawFooter(doc, pageRef),
  });

  // Final page numbers on every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const isLandscape = doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight();
    const w = isLandscape ? LANDSCAPE_W : PORTRAIT_W;
    const h = isLandscape ? LANDSCAPE_H : PORTRAIT_H;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    // Clear prior footer by redrawing (white bar then text)
    doc.setFillColor(255, 255, 255);
    doc.rect(0, h - 12, w, 12, "F");
    doc.text("OVF Module", MARGIN, h - 6);
    doc.text(`Page ${i} of ${totalPages}`, w - MARGIN, h - 6, { align: "right" });
  }

  doc.save(buildOvfExportFilename(ovf, input.quoteName));
}
