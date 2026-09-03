import { jsPDF } from "jspdf";

import type { ScmOvfPreview, ScmVendorLine } from "@/services/procurement-service";
import {
  scmHoldDayCountDisplay,
  scmHoldSinceDisplay,
} from "@/utils/scm-ovf-hold";
import { dash, formatInrPdf } from "@/utils/purchase-order-amount-words";
import {
  CACHE_LOGO_MM,
  WOMEN_OWNED_LOGO_MM,
  loadLetterheadLogos,
  pdfImageFormat,
} from "@/utils/pdf-letterhead";

const MARGIN = 12;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - MARGIN;

type ScmOvfQueueStatus = "open" | "close" | "hold" | "draft";

function deriveQueueStatus(preview: ScmOvfPreview): ScmOvfQueueStatus {
  const poStatus = (preview.purchase_order_status || "").toLowerCase();
  if (poStatus === "draft" && preview.purchase_order_id && !preview.can_create_po) {
    return "draft";
  }
  if (preview.scm_on_hold || poStatus === "hold" || poStatus === "cancelled") return "hold";
  if (!preview.purchase_order_id || preview.can_create_po) return "open";
  if (poStatus === "submitted" || poStatus === "") return "open";
  return "close";
}

function queueStatusLabel(status: ScmOvfQueueStatus): string {
  if (status === "open") return "Open";
  if (status === "close") return "Close";
  if (status === "draft") return "Draft";
  return "Hold";
}

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(dash(text), maxWidth) as string[];
}

function formatPoDatePdf(value: string | null | undefined): string {
  if (!value) return "—";
  const raw = String(value).trim();
  if (!raw) return "—";
  const d = new Date(/^\d{4}-\d{2}-\d{2}/.test(raw) ? `${raw.slice(0, 10)}T00:00:00` : raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function pct(value: number): string {
  return `${(Number(value) || 0).toFixed(2)}%`;
}

function vendorLabelFromPreview(preview: ScmOvfPreview): string {
  return preview.distributor_name?.trim() || "—";
}

function computeMarginSummary(preview: ScmOvfPreview) {
  const customerTotal = (preview.customer_lines || []).reduce(
    (sum, row) => sum + (Number(row.line_total) || 0),
    0,
  );
  const vendorTotal = (preview.vendor_lines || []).reduce(
    (sum, row) => sum + (Number(row.line_total) || 0),
    0,
  );
  const freightAmount = Number(preview.freight) || 0;
  const additionalAmount = Number(preview.additional_charges) || 0;
  const financePct = Number(preview.finance_cost_pct) || 0;
  const financeAmount = (vendorTotal * financePct) / 100;
  const margin =
    customerTotal - vendorTotal - freightAmount - additionalAmount - financeAmount;
  const marginPct = customerTotal ? (margin / customerTotal) * 100 : 0;
  return { customerTotal, vendorTotal, margin, marginPct, financeAmount };
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > FOOTER_Y) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function drawSectionTitle(doc: jsPDF, y: number, title: string): number {
  y = ensureSpace(doc, y, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(title, MARGIN, y);
  y += 4;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  return y + 4;
}

function drawFieldGrid(
  doc: jsPDF,
  y: number,
  rows: Array<{ label: string; value: string }>,
  cols = 2,
): number {
  const colW = CONTENT_W / cols;
  const labelW = 38;
  const valueW = colW - labelW - 4;
  let rowY = y;
  for (let i = 0; i < rows.length; i += cols) {
    let maxH = 0;
    for (let c = 0; c < cols; c += 1) {
      const row = rows[i + c];
      if (!row) continue;
      const x = MARGIN + c * colW;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(90, 90, 90);
      doc.text(row.label, x, rowY);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      const lines = wrap(doc, row.value, valueW);
      lines.forEach((line, li) => {
        doc.text(line, x + labelW, rowY + li * 3.5);
      });
      maxH = Math.max(maxH, lines.length * 3.5);
    }
    rowY += maxH + 5;
    rowY = ensureSpace(doc, rowY, 8);
  }
  return rowY + 2;
}

function lineTableTotals(rows: ScmVendorLine[]) {
  return rows.reduce(
    (acc, row) => {
      acc.total += Number(row.line_total) || 0;
      acc.gst += Number(row.gst_amount) || 0;
      acc.withGst += Number(row.total_with_gst) || 0;
      return acc;
    },
    { total: 0, gst: 0, withGst: 0 },
  );
}

function drawLineTable(
  doc: jsPDF,
  y: number,
  rows: ScmVendorLine[],
  emptyLabel: string,
): number {
  const cols = {
    sr: 8,
    product: 26,
    description: 26,
    qty: 12,
    unit: 20,
    total: 22,
    gst: 20,
    withGst: 22,
  };
  const colSum =
    cols.sr +
    cols.product +
    cols.description +
    cols.qty +
    cols.unit +
    cols.total +
    cols.gst +
    cols.withGst;
  const scale = CONTENT_W / colSum;
  const w = {
    sr: cols.sr * scale,
    product: cols.product * scale,
    description: cols.description * scale,
    qty: cols.qty * scale,
    unit: cols.unit * scale,
    total: cols.total * scale,
    gst: cols.gst * scale,
    withGst: cols.withGst * scale,
  };
  const xs = [
    MARGIN,
    MARGIN + w.sr,
    MARGIN + w.sr + w.product,
    MARGIN + w.sr + w.product + w.description,
    MARGIN + w.sr + w.product + w.description + w.qty,
    MARGIN + w.sr + w.product + w.description + w.qty + w.unit,
    MARGIN + w.sr + w.product + w.description + w.qty + w.unit + w.total,
    MARGIN + w.sr + w.product + w.description + w.qty + w.unit + w.total + w.gst,
    MARGIN + CONTENT_W,
  ];

  const headerH = 7;
  y = ensureSpace(doc, y, headerH + 4);
  doc.setFillColor(236, 240, 244);
  doc.setDrawColor(160, 160, 160);
  doc.rect(MARGIN, y, CONTENT_W, headerH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("S No.", xs[0] + 1, y + 4.5);
  doc.text("Product", xs[1] + 1, y + 4.5);
  doc.text("Description", xs[2] + 1, y + 4.5);
  doc.text("Qty", xs[4] - 1, y + 4.5, { align: "right" });
  doc.text("Unit", xs[5] - 1, y + 4.5, { align: "right" });
  doc.text("Total", xs[6] - 1, y + 4.5, { align: "right" });
  doc.text("GST", xs[7] - 1, y + 4.5, { align: "right" });
  doc.text("With GST", xs[8] - 1, y + 4.5, { align: "right" });
  y += headerH;

  if (rows.length === 0) {
    const emptyH = 10;
    y = ensureSpace(doc, y, emptyH);
    doc.setDrawColor(160, 160, 160);
    doc.rect(MARGIN, y, CONTENT_W, emptyH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(emptyLabel, MARGIN + CONTENT_W / 2, y + 6, { align: "center" });
    return y + emptyH + 4;
  }

  rows.forEach((row, index) => {
    const product = dash(row.product_name);
    const desc = dash(row.description || row.product_name);
    const productLines = wrap(doc, product, w.product - 2);
    const descLines = wrap(doc, desc, w.description - 2);
    const lineCount = Math.max(productLines.length, descLines.length, 1);
    const rowH = Math.max(6, lineCount * 3.2 + 2);
    y = ensureSpace(doc, y, rowH);
    doc.setDrawColor(200, 200, 200);
    doc.rect(MARGIN, y, CONTENT_W, rowH);
    for (let i = 1; i < xs.length - 1; i += 1) {
      doc.line(xs[i], y, xs[i], y + rowH);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(String(index + 1), xs[0] + 1, y + 4);
    productLines.forEach((line, li) => {
      doc.text(line, xs[1] + 1, y + 3.5 + li * 3.2);
    });
    descLines.forEach((line, li) => {
      doc.text(line, xs[2] + 1, y + 3.5 + li * 3.2);
    });
    doc.text(String(row.qty), xs[4] - 1, y + 4, { align: "right" });
    doc.text(formatInrPdf(row.unit_price), xs[5] - 1, y + 4, { align: "right" });
    doc.text(formatInrPdf(row.line_total), xs[6] - 1, y + 4, { align: "right" });
    doc.text(formatInrPdf(row.gst_amount ?? 0), xs[7] - 1, y + 4, { align: "right" });
    doc.text(formatInrPdf(row.total_with_gst ?? 0), xs[8] - 1, y + 4, { align: "right" });
    y += rowH;
  });

  const totals = lineTableTotals(rows);
  const footH = 7;
  y = ensureSpace(doc, y, footH);
  doc.setFillColor(245, 247, 250);
  doc.rect(MARGIN, y, CONTENT_W, footH, "F");
  doc.setDrawColor(160, 160, 160);
  doc.rect(MARGIN, y, CONTENT_W, footH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("Totals", xs[5] - 1, y + 4.5, { align: "right" });
  doc.text(formatInrPdf(totals.total), xs[6] - 1, y + 4.5, { align: "right" });
  doc.text(formatInrPdf(totals.gst), xs[7] - 1, y + 4.5, { align: "right" });
  doc.text(formatInrPdf(totals.withGst), xs[8] - 1, y + 4.5, { align: "right" });
  return y + footH + 6;
}

export async function downloadScmOvfPdf(
  preview: ScmOvfPreview,
  fileName?: string,
): Promise<void> {
  const { cache: cacheLogo, womenOwned: womenLogo } = await loadLetterheadLogos();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
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
      PAGE_W - MARGIN - WOMEN_OWNED_LOGO_MM.w,
      y + (CACHE_LOGO_MM.h - WOMEN_OWNED_LOGO_MM.h) / 2,
      WOMEN_OWNED_LOGO_MM.w,
      WOMEN_OWNED_LOGO_MM.h,
    );
  }
  y += CACHE_LOGO_MM.h + 4;

  const queueStatus = deriveQueueStatus(preview);
  const marginSummary = computeMarginSummary(preview);
  const vendorLabel = vendorLabelFromPreview(preview);

  const headerCenterX = MARGIN + CONTENT_W / 2;
  doc.setFillColor(3, 105, 161);
  doc.rect(MARGIN, y, CONTENT_W, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("OVF Summary", headerCenterX, y + 6, { align: "center" });
  doc.setFontSize(9);
  doc.text(dash(preview.ovf_no), headerCenterX, y + 11, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 18;

  const overviewRows: Array<{ label: string; value: string }> = [
    {
      label: "Customer",
      value: dash(preview.customer_name || preview.account_name),
    },
    {
      label: "Project title",
      value: dash(preview.project_title),
    },
    {
      label: "Customer pay",
      value: preview.customer_payment_days
        ? `Net ${preview.customer_payment_days} days`
        : "—",
    },
    { label: "Vendor name", value: vendorLabel },
    {
      label: "Vendor pay",
      value: preview.vendor_payment_days ? `Net ${preview.vendor_payment_days} days` : "—",
    },
    { label: "Approved by", value: dash(preview.ovf_approver) },
    { label: "Approval", value: dash(preview.approval_status) },
    { label: "Margin (total)", value: formatInrPdf(preview.total_margin_amount) },
    { label: "Margin %", value: pct(preview.total_margin_pct) },
    { label: "OVF status", value: queueStatusLabel(queueStatus) },
    { label: "Quote no.", value: dash(preview.quote_no) },
  ];
  if (preview.scm_on_hold || queueStatus === "hold") {
    overviewRows.push({
      label: "Hold duration",
      value: scmHoldDayCountDisplay(preview.scm_on_hold_at),
    });
    overviewRows.push({
      label: "Hold since",
      value: scmHoldSinceDisplay(preview.scm_on_hold_at),
    });
  }
  if (preview.purchase_order_number) {
    overviewRows.push({
      label: "Vendor PO",
      value: dash(preview.purchase_order_number),
    });
  }
  if (preview.company_po_number) {
    overviewRows.push({
      label: "Company PO",
      value: dash(preview.company_po_number),
    });
  }

  y = drawSectionTitle(doc, y, "OVF overview");
  y = drawFieldGrid(doc, y, overviewRows);

  y = drawSectionTitle(doc, y, "Customer details");
  y = drawFieldGrid(doc, y, [
    { label: "Customer PO", value: dash(preview.po_number) },
    { label: "PO date", value: formatPoDatePdf(preview.po_date) },
    {
      label: "Delivery",
      value: dash(preview.delivery_period),
    },
    { label: "Customer GST", value: dash(preview.customer_gst) },
    {
      label: "Billing",
      value: dash(preview.billing_address),
    },
    { label: "Billing state", value: dash(preview.billing_state) },
    {
      label: "Shipping",
      value: dash(preview.shipping_address),
    },
    { label: "Shipping state", value: dash(preview.shipping_state) },
  ]);
  y = drawLineTable(
    doc,
    y,
    preview.customer_lines || [],
    "No customer charge lines on this OVF.",
  );

  y = drawSectionTitle(doc, y, "Vendor purchase");
  y = drawLineTable(
    doc,
    y,
    preview.vendor_lines || [],
    "No vendor purchase lines on this OVF.",
  );

  y = drawSectionTitle(doc, y, "Margin");
  y = drawFieldGrid(doc, y, [
    { label: "Customer total", value: formatInrPdf(marginSummary.customerTotal) },
    { label: "Vendor total", value: formatInrPdf(marginSummary.vendorTotal) },
    { label: "Margin", value: formatInrPdf(marginSummary.margin) },
    { label: "Margin %", value: pct(marginSummary.marginPct) },
  ]);

  y = drawSectionTitle(doc, y, "Freight & finance");
  y = drawFieldGrid(doc, y, [
    { label: "Freight", value: formatInrPdf(preview.freight) },
    { label: "Finance %", value: pct(preview.finance_cost_pct) },
  ]);

  const safeName =
    fileName ||
    `OVF-${(preview.ovf_no || preview.ovf_id).replace(/[^\w.-]+/g, "_")}.pdf`;
  doc.save(safeName);
}
