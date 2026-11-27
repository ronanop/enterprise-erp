import { jsPDF } from "jspdf";

import {
  buildCompensationSheet,
  stripCompensationAppendix,
  type CompensationSheet,
} from "@/lib/salary-structure-excel";

/** Helvetica is WinAnsi — replace glyphs it cannot encode (e.g. ₹). */
function pdfSafeText(text: string): string {
  return (text || "")
    .replace(/\u20B9/g, "Rs.")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function fmtInr(n: number): string {
  return Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

const HEADER_RGB: [number, number, number] = [15, 61, 110];
const SECTION_RGB: [number, number, number] = [84, 141, 212];
const ALT_RGB: [number, number, number] = [220, 230, 242];
const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [20, 20, 20];

/**
 * Draw Compensation Sheet table (Fixed / Statutory / Monthly / Yearly).
 * Returns the Y position after the table.
 */
export function drawCompensationSheetTable(
  doc: jsPDF,
  sheet: CompensationSheet,
  opts: { marginX: number; startY: number; pageW: number; pageH: number },
): number {
  const { marginX, pageW, pageH } = opts;
  let y = opts.startY;
  const tableW = pageW - marginX * 2;
  const colAmt = 32;
  const colLabel = tableW - colAmt * 2;
  const x0 = marginX;
  const x1 = marginX + colLabel;
  const x2 = marginX + colLabel + colAmt;
  const rowH = 7;
  const titleH = 9;

  const ensureSpace = (need: number) => {
    if (y + need <= pageH - 16) return;
    doc.addPage();
    y = 20;
  };

  const fillRect = (
    x: number,
    top: number,
    w: number,
    h: number,
    rgb: [number, number, number],
  ) => {
    doc.setFillColor(...rgb);
    doc.rect(x, top, w, h, "F");
  };

  const strokeGrid = (top: number, h: number) => {
    doc.setDrawColor(40, 70, 120);
    doc.setLineWidth(0.25);
    doc.rect(x0, top, tableW, h);
    doc.line(x1, top, x1, top + h);
    doc.line(x2, top, x2, top + h);
  };

  ensureSpace(titleH + rowH * 3);
  // Title bar
  fillRect(x0, y, tableW, titleH, HEADER_RGB);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(pdfSafeText(sheet.title), x0 + 2, y + 6);
  y += titleH;

  // Column headers
  fillRect(x0, y, tableW, rowH, SECTION_RGB);
  strokeGrid(y, rowH);
  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Monthly", x1 + colAmt / 2, y + 4.8, { align: "center" });
  doc.text("Yearly", x2 + colAmt / 2, y + 4.8, { align: "center" });
  y += rowH;

  let alt = false;
  for (const row of sheet.rows) {
    ensureSpace(rowH + 2);
    if (row.kind === "section") {
      fillRect(x0, y, tableW, rowH, SECTION_RGB);
      strokeGrid(y, rowH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...BLACK);
      doc.text(pdfSafeText(row.label), x0 + 2, y + 4.8);
      y += rowH;
      alt = false;
      continue;
    }

    const bg =
      row.kind === "subtotal" || row.kind === "total"
        ? SECTION_RGB
        : alt
          ? ALT_RGB
          : WHITE;
    fillRect(x0, y, tableW, rowH, bg);
    strokeGrid(y, rowH);
    doc.setFont(
      "helvetica",
      row.kind === "subtotal" || row.kind === "total" ? "bold" : "normal",
    );
    doc.setFontSize(row.kind === "total" ? 9 : 8.5);
    doc.setTextColor(...BLACK);
    doc.text(pdfSafeText(row.label), x0 + 2, y + 4.8);
    doc.text(fmtInr(row.monthly ?? 0), x1 + colAmt - 2, y + 4.8, {
      align: "right",
    });
    doc.text(fmtInr(row.yearly ?? 0), x2 + colAmt - 2, y + 4.8, {
      align: "right",
    });
    y += rowH;
    if (row.kind === "line") alt = !alt;
  }

  doc.setTextColor(...BLACK);
  return y + 2;
}

/** Build a simple A4 PDF data URL from offer letter plain text. */
export function buildOfferLetterPdfDataUrl(opts: {
  title?: string;
  offerCode?: string;
  body: string;
  /** Annual CTC — when set, appends Compensation Sheet table. */
  annualCtc?: number;
  candidateName?: string;
}): string {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const marginX = 18;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - marginX * 2;
  let y = 22;

  const title = (opts.title || "").trim();
  if (title && !/^offer\s+letter$/i.test(title)) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(pdfSafeText(title), marginX, y);
    y += 8;
  }

  if (opts.offerCode) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(pdfSafeText(opts.offerCode), marginX, y);
    doc.setTextColor(0);
    y += 10;
  } else if (title) {
    y += 4;
  }

  if (title || opts.offerCode) {
    doc.setDrawColor(220);
    doc.line(marginX, y, pageW - marginX, y);
    y += 8;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const bodyText = stripCompensationAppendix(opts.body || "").replace(
    /^\s*(INTERNSHIP\s+)?OFFER\s+LETTER\s*(\r?\n)+/i,
    "",
  );
  const lines = doc.splitTextToSize(pdfSafeText(bodyText), maxW) as string[];
  for (const line of lines) {
    if (y > pageH - 20) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, marginX, y);
    y += 6;
  }

  const sheet = buildCompensationSheet(Number(opts.annualCtc) || 0, opts.candidateName);
  if (sheet) {
    y += 6;
    if (y > pageH - 70) {
      doc.addPage();
      y = 20;
    }
    drawCompensationSheetTable(doc, sheet, {
      marginX,
      startY: y,
      pageW,
      pageH,
    });
  }

  const raw = doc.output("datauristring");
  const comma = raw.indexOf(",");
  if (comma < 0) return raw;
  return `data:application/pdf;base64,${raw.slice(comma + 1)}`;
}
