/**
 * Quotation PDF export matching `QT_USB-RJ45 Adaptor.docx` / Cache letterhead:
 * CACHE logo left, Women Owned logo right, seller address under CACHE,
 * Validity / Ref / Date stacked on the right, gray Grand Total + Terms boxes.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { Quote, QuoteLine } from "@/services/sales-crm-service";

export type QuoteExportSeller = {
  companyName: string;
  companyCode?: string;
  address: string;
  gst: string;
  orderToName: string;
};

export type QuoteExportInput = {
  quote: Quote;
  lines: QuoteLine[];
  seller: QuoteExportSeller;
  customerName: string;
  customerAddress: string;
  subject: string;
  ownerName: string;
  coverLetter?: string | null;
  termsOverride?: string | null;
  deliveryPeriod?: string | null;
  paymentTerms?: string | null;
};

/** Fixed Cache Technologies letterhead from the QT template. */
export const CACHE_LETTERHEAD: QuoteExportSeller = {
  companyName: "Cache Technologies",
  companyCode: "CT",
  address: "L-31 Kailash Colony , New Delhi 110048",
  gst: "GST:07AAWPG7418G2ZC",
  orderToName: "Cache technologies",
};

const MARGIN_L = 2.49;
const MARGIN_R = 2.49;
const MARGIN_TOP = 20.46;
const PAGE_W = 210;
const PAGE_H = 297;

const BODY_X = MARGIN_L + 5.6268;
const CONTENT_RIGHT = PAGE_W - MARGIN_R;

const CACHE_LOGO = { path: "/quote-export/cache-logo.png", w: 47.076, h: 17.687 };
const WOMEN_LOGO = { path: "/quote-export/women-owned.jpeg", w: 38.034, h: 16.095 };

const COLS = [13.811, 19.509, 22.49, 69.356, 11.924, 27.64, 28.716];
const TABLE_X = MARGIN_L + 5.98;

const TEXT: [number, number, number] = [0x10, 0x10, 0x10];
const BORDER: [number, number, number] = [0xe2, 0xde, 0xca];
const HEAD_FILL: [number, number, number] = [0xef, 0xef, 0xef];
const BOX_FILL: [number, number, number] = [0xd8, 0xd8, 0xd8];

/** jsPDF Helvetica is WinAnsi — strip / replace unsupported glyphs. */
function pdfSafe(text: string): string {
  return text
    .replace(/\u20B9/g, "Rs.") // ₹
    .replace(/[\u2013\u2014\u2212]/g, "-") // en/em/minus dashes
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function formatMoney(value: number | string | null | undefined, fractionDigits = 2): string {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatQty(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  if (Math.abs(safe - Math.round(safe)) < 1e-9) return String(Math.round(safe));
  return safe.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatTableTotal(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const fixed = Math.round(safe * 100) / 100;
  if (Math.abs(fixed * 10 - Math.round(fixed * 10)) < 1e-9) {
    return fixed.toLocaleString("en-IN", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }
  return formatMoney(fixed, 2);
}

function formatMoneyLabel(value: number | string | null | undefined): string {
  return `Rs. ${formatMoney(value, 2)}`;
}

function formatDisplayDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return pdfSafe(value);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatDisplayDateTime(value: string | null | undefined): string {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return pdfSafe(value || "");
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function indianFiscalYearLabel(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = month >= 3 ? year : year - 1;
  const end = (start + 1) % 100;
  return `${String(start).slice(-2)}-${String(end).padStart(2, "0")}`;
}

function buildRef(quote: Quote, companyCode?: string): string {
  const prefix =
    (companyCode || "CT").replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "CT";
  const fy = indianFiscalYearLabel(quote.created_at ? new Date(quote.created_at) : new Date());
  const rev = Math.max(1, Number(quote.quote_revision) || 1);
  return `${prefix}/${fy}/V${rev}`;
}

function defaultCoverLetter(): string {
  return (
    "Thank you for your inquiry. As requested, please find our offer below, along with the terms and " +
    "conditions related to the sale. We trust our quotation meets your requirements and look forward to " +
    "receiving your esteemed order. Should you require any further clarification or information, please do " +
    "not hesitate to contact the undersigned. We remain committed to providing you with our best services at all times."
  );
}

function defaultTerms(input: QuoteExportInput): string {
  const orderOn = input.seller.orderToName || input.seller.companyName;
  const delivery = input.deliveryPeriod?.trim() || "1-2 Weeks from the date of PO";
  const payment = input.paymentTerms?.trim() || "30 days from the date of invoice";
  return [
    "Prices: In INR, Exclusive of Taxes. Taxes extra as applicable as per Govt. of India.",
    `Order to be placed on: ${orderOn}`,
    `Delivery Period : ${delivery}`,
    `Payment terms: ${payment}`,
  ].join("\n");
}

async function loadImageDataUrl(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Failed to read ${path}`));
    reader.readAsDataURL(blob);
  });
}

function writeLines(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = doc.splitTextToSize(pdfSafe(text), maxWidth) as string[];
  for (const line of lines) {
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

function drawFilledBox(doc: jsPDF, x: number, y: number, w: number, h: number): void {
  doc.setFillColor(...BOX_FILL);
  doc.rect(x, y, w, h, "F");
}

function drawFooter(doc: jsPDF): void {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT);
  doc.text(
    "This is a system-generated quotation; therefore, no signature is required.",
    PAGE_W / 2,
    PAGE_H - 12.5,
    { align: "center" },
  );
}

/** Always returns the Cache Technologies QT letterhead. */
export async function loadSellerLetterhead(
  _companyId?: string | null,
  _branchId?: string | null,
): Promise<QuoteExportSeller> {
  return { ...CACHE_LETTERHEAD };
}

export function buildQuoteExportFilename(quote: Quote, subject?: string | null): string {
  const base = (subject || quote.subject || quote.quote_no || "Quote")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return `QT_${base || quote.quote_no}.pdf`;
}

export async function exportQuotePdf(input: QuoteExportInput): Promise<void> {
  const [cacheLogo, womenLogo] = await Promise.all([
    loadImageDataUrl(CACHE_LOGO.path),
    loadImageDataUrl(WOMEN_LOGO.path),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { quote, lines } = input;
  const seller = input.seller?.companyName ? input.seller : CACHE_LETTERHEAD;
  const subject = (input.subject || quote.subject || "Quotation").trim();
  const ownerName = (input.ownerName || quote.owner_name || "-").trim();
  const customerName = (input.customerName || quote.entity_name || quote.account_name || "-")
    .trim()
    .toUpperCase();
  const customerAddress = (input.customerAddress || quote.entity_address || "-").trim();
  const termsText = (input.termsOverride || quote.terms || "").trim() || defaultTerms({ ...input, seller });
  const cover = (input.coverLetter || "").trim() || defaultCoverLetter();
  const ref = buildRef(quote, seller.companyCode || "CT");
  const validity = formatDisplayDate(quote.valid_until);
  const quoteDate = formatDisplayDateTime(quote.created_at);

  // ── Logos: CACHE left, Women Owned right (page-right aligned) ───────────
  const logoY = MARGIN_TOP;
  const cacheX = BODY_X;
  const womenX = CONTENT_RIGHT - WOMEN_LOGO.w;
  const womenY = logoY + (CACHE_LOGO.h - WOMEN_LOGO.h) / 2;
  doc.addImage(cacheLogo, "PNG", cacheX, logoY, CACHE_LOGO.w, CACHE_LOGO.h);
  doc.addImage(womenLogo, "JPEG", womenX, womenY, WOMEN_LOGO.w, WOMEN_LOGO.h);

  // ── Left letterhead under CACHE (exact QT address block) ────────────────
  const lineH = 5.0;
  let leftY = logoY + CACHE_LOGO.h + 4.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(pdfSafe(seller.companyName), BODY_X, leftY);
  leftY += lineH;
  doc.text(pdfSafe(seller.address), BODY_X, leftY);
  leftY += lineH;
  doc.text(pdfSafe(seller.gst), BODY_X, leftY);

  // ── Right meta under Women Owned — each field on its own line ───────────
  const metaX = CONTENT_RIGHT;
  let rightY = logoY + CACHE_LOGO.h + 4.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(pdfSafe(`Validity Date: ${validity}`), metaX, rightY, { align: "right" });
  rightY += lineH;
  doc.text(pdfSafe(`Ref.: ${ref}`), metaX, rightY, { align: "right" });
  rightY += lineH;
  doc.text(pdfSafe(`Date: ${quoteDate}`), metaX, rightY, { align: "right" });

  let y = Math.max(leftY, rightY) + 10;

  // ── To / customer / subject ──────────────────────────────────────────────
  const bodyLineH = 5.2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text("To,", BODY_X, y);
  y += bodyLineH;
  doc.text(pdfSafe(customerName), BODY_X, y);
  y += bodyLineH;

  const addrWidth = CONTENT_RIGHT - BODY_X - WOMEN_LOGO.w - 8;
  y = writeLines(doc, customerAddress, BODY_X, y, addrWidth, bodyLineH);
  y += 1.5;
  doc.setFont("helvetica", "bold");
  y = writeLines(doc, `Subject - ${subject}`, BODY_X, y, addrWidth, bodyLineH) + 4;
  doc.setFont("helvetica", "normal");

  doc.text("Dear Sir/Mam,", BODY_X, y);
  y += bodyLineH + 1.5;
  y = writeLines(doc, cover, BODY_X, y, CONTENT_RIGHT - BODY_X - 6, 5.4) + 7;

  // ── Line table ──────────────────────────────────────────────────────────
  const sorted = [...lines].sort((a, b) => (a.line_no ?? 0) - (b.line_no ?? 0));
  const tableWidth = COLS.reduce((a, b) => a + b, 0);

  autoTable(doc, {
    startY: y,
    margin: { left: TABLE_X, right: PAGE_W - TABLE_X - tableWidth },
    tableWidth,
    head: [
      ["S.No", "Product Name", "HSN/SAC\nCode", "Item Description", "Qty", "Unit Price", "Total"],
    ],
    body: sorted.map((line, idx) => [
      String(line.line_no || idx + 1),
      pdfSafe(line.product_name || ""),
      pdfSafe(line.hsn_sac || ""),
      pdfSafe(line.description || ""),
      formatQty(line.qty),
      formatMoney(line.unit_sell, 2),
      formatTableTotal(line.line_total),
    ]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: { top: 2.8, bottom: 2.8, left: 1.4, right: 1.4 },
      valign: "middle",
      textColor: TEXT,
      lineColor: BORDER,
      lineWidth: 0.28,
      overflow: "linebreak",
      minCellHeight: 10,
    },
    headStyles: {
      fillColor: HEAD_FILL,
      textColor: TEXT,
      fontStyle: "bold",
      fontSize: 9,
      halign: "left",
      valign: "middle",
      minCellHeight: 11,
    },
    columnStyles: {
      0: { cellWidth: COLS[0], halign: "center", fontSize: 9 },
      1: { cellWidth: COLS[1] },
      2: { cellWidth: COLS[2] },
      3: { cellWidth: COLS[3] },
      4: { cellWidth: COLS[4], halign: "right", overflow: "ellipsize" },
      5: { cellWidth: COLS[5], halign: "right" },
      6: { cellWidth: COLS[6], halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index === 0) {
        data.cell.styles.fontSize = 9;
      }
    },
    didDrawPage: () => {
      drawFooter(doc);
    },
  });

  const lastTable = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable;
  y = (lastTable?.finalY ?? y) + 5.6;

  // ── Grand Total (gray bar, right side — ASCII-only to avoid stretch) ────
  const gtX = 104.85;
  const gtW = 100.79;
  const gtH = 7.32;
  drawFilledBox(doc, gtX, y, gtW, gtH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(
    pdfSafe(`Grand Total : ${formatMoneyLabel(quote.grand_total)}`),
    gtX + gtW - 4,
    y + 4.9,
    { align: "right" },
  );
  y += gtH + 7;

  // ── Terms boxes ─────────────────────────────────────────────────────────
  const termsX = 4.06;
  const termsW = 100.79;
  const titleH = 7.32;
  drawFilledBox(doc, termsX, y, termsW, titleH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TERMS AND CONDITIONS:", termsX + 4.06, y + 4.9);
  y += titleH;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const termLines = doc.splitTextToSize(pdfSafe(termsText), termsW - 8) as string[];
  const bodyH = Math.max(26, 6 + termLines.length * 4.4);
  drawFilledBox(doc, termsX, y, termsW, bodyH);
  let ty = y + 5.2;
  for (const line of termLines) {
    doc.text(line, termsX + 4.06, ty);
    ty += 4.4;
  }
  y += bodyH + 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text("Thanks and Regards,", BODY_X, y);
  y += 5.2;
  doc.setFont("helvetica", "bold");
  doc.text(pdfSafe(ownerName), BODY_X, y);

  drawFooter(doc);
  doc.save(buildQuoteExportFilename(quote, subject));
}
