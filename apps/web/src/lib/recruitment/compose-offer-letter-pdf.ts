/**
 * Stamp offer body text onto a single-page PDF letterhead.
 * Extra pages are auto-created by copying the letterhead page.
 * Optional Compensation Sheet table is drawn after the body.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import {
  buildCompensationSheet,
  stripCompensationAppendix,
  type CompensationSheet,
  type CompensationSheetRow,
} from "@/lib/salary-structure-excel";

export type LetterheadMargins = {
  /** Content starts below header (pt from top of page) */
  top: number;
  /** Content stops above footer (pt from bottom) */
  bottom: number;
  left: number;
  right: number;
};

const DEFAULT_MARGINS: LetterheadMargins = {
  top: 110,
  bottom: 72,
  left: 54,
  right: 54,
};

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Helvetica is WinAnsi — replace glyphs it cannot encode (e.g. ₹). */
function pdfSafeText(text: string): string {
  return (text || "")
    .replace(/\u20B9/g, "Rs.") // ₹
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

/** Drop a leading "OFFER LETTER" / "INTERNSHIP OFFER LETTER" heading from body text. */
function stripOfferLetterHeading(text: string): string {
  return (text || "").replace(/^\s*(INTERNSHIP\s+)?OFFER\s+LETTER\s*(\r?\n)+/i, "");
}

function wrapLines(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  const paragraphs = (text || "").replace(/\r\n/g, "\n").split("\n");
  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, fontSize) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function fmtInr(n: number): string {
  return Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

const C_HEADER = rgb(15 / 255, 61 / 255, 110 / 255);
const C_SECTION = rgb(84 / 255, 141 / 255, 212 / 255);
const C_ALT = rgb(220 / 255, 230 / 255, 242 / 255);
const C_WHITE = rgb(1, 1, 1);
const C_BLACK = rgb(0.08, 0.08, 0.08);
const C_GRID = rgb(0.2, 0.3, 0.45);

async function drawCompensationOnPages(
  out: PDFDocument,
  letterheadDoc: PDFDocument,
  sheet: CompensationSheet,
  margins: LetterheadMargins,
  startPageIndex: number,
  startYFromTop: number,
  fonts: { regular: PDFFont; bold: PDFFont },
): Promise<void> {
  const srcPage = letterheadDoc.getPage(0);
  const { width, height } = srcPage.getSize();
  const contentBottom = margins.bottom;
  const tableLeft = margins.left;
  const tableW = Math.max(40, width - margins.left - margins.right);
  const colAmt = 72;
  const colLabel = tableW - colAmt * 2;
  const x1 = tableLeft + colLabel;
  const x2 = tableLeft + colLabel + colAmt;
  const rowH = 16;
  const titleH = 20;

  let page = out.getPage(startPageIndex);
  // pdf-lib y is from bottom
  let yTop = height - startYFromTop;

  const newPage = async () => {
    const [copied] = await out.copyPages(letterheadDoc, [0]);
    out.addPage(copied);
    page = out.getPage(out.getPageCount() - 1);
    yTop = height - margins.top;
  };

  const ensure = async (need: number) => {
    if (yTop - need >= contentBottom) return;
    await newPage();
  };

  const drawRowBg = (
    p: PDFPage,
    yBottom: number,
    h: number,
    color: ReturnType<typeof rgb>,
  ) => {
    p.drawRectangle({
      x: tableLeft,
      y: yBottom,
      width: tableW,
      height: h,
      color,
      borderColor: C_GRID,
      borderWidth: 0.6,
    });
    p.drawLine({
      start: { x: x1, y: yBottom },
      end: { x: x1, y: yBottom + h },
      thickness: 0.6,
      color: C_GRID,
    });
    p.drawLine({
      start: { x: x2, y: yBottom },
      end: { x: x2, y: yBottom + h },
      thickness: 0.6,
      color: C_GRID,
    });
  };

  const paintTextRow = (
    p: PDFPage,
    row: CompensationSheetRow,
    yBottom: number,
    h: number,
    bg: ReturnType<typeof rgb>,
    bold: boolean,
  ) => {
    drawRowBg(p, yBottom, h, bg);
    const font = bold ? fonts.bold : fonts.regular;
    const size = bold ? 9 : 8.5;
    const textY = yBottom + 5;
    p.drawText(pdfSafeText(row.label), {
      x: tableLeft + 4,
      y: textY,
      size,
      font,
      color: C_BLACK,
      maxWidth: colLabel - 8,
    });
    if (row.kind !== "section") {
      const m = fmtInr(row.monthly ?? 0);
      const yr = fmtInr(row.yearly ?? 0);
      p.drawText(m, {
        x: x1 + colAmt - 4 - font.widthOfTextAtSize(m, size),
        y: textY,
        size,
        font,
        color: C_BLACK,
      });
      p.drawText(yr, {
        x: x2 + colAmt - 4 - font.widthOfTextAtSize(yr, size),
        y: textY,
        size,
        font,
        color: C_BLACK,
      });
    }
  };

  await ensure(titleH + rowH * 2);
  // Title
  {
    const yBottom = yTop - titleH;
    page.drawRectangle({
      x: tableLeft,
      y: yBottom,
      width: tableW,
      height: titleH,
      color: C_HEADER,
      borderColor: C_GRID,
      borderWidth: 0.6,
    });
    page.drawText(pdfSafeText(sheet.title), {
      x: tableLeft + 6,
      y: yBottom + 6,
      size: 10,
      font: fonts.bold,
      color: C_WHITE,
      maxWidth: tableW - 12,
    });
    yTop = yBottom;
  }

  // Column headers
  await ensure(rowH);
  {
    const yBottom = yTop - rowH;
    drawRowBg(page, yBottom, rowH, C_SECTION);
    page.drawText("Monthly", {
      x: x1 + (colAmt - fonts.bold.widthOfTextAtSize("Monthly", 9)) / 2,
      y: yBottom + 5,
      size: 9,
      font: fonts.bold,
      color: C_BLACK,
    });
    page.drawText("Yearly", {
      x: x2 + (colAmt - fonts.bold.widthOfTextAtSize("Yearly", 9)) / 2,
      y: yBottom + 5,
      size: 9,
      font: fonts.bold,
      color: C_BLACK,
    });
    yTop = yBottom;
  }

  let alt = false;
  for (const row of sheet.rows) {
    await ensure(rowH);
    const yBottom = yTop - rowH;
    if (row.kind === "section") {
      paintTextRow(page, row, yBottom, rowH, C_SECTION, true);
      alt = false;
    } else if (row.kind === "subtotal" || row.kind === "total") {
      paintTextRow(page, row, yBottom, rowH, C_SECTION, true);
    } else {
      paintTextRow(page, row, yBottom, rowH, alt ? C_ALT : C_WHITE, false);
      alt = !alt;
    }
    yTop = yBottom;
  }
}

/**
 * Build a multi-page PDF: each page is the uploaded letterhead with body text
 * flowing through the content area. Returns a clean data:application/pdf;base64,… URL.
 */
export async function composeOfferLetterPdf(opts: {
  letterheadDataUrl: string;
  body: string;
  margins?: Partial<LetterheadMargins>;
  fontSize?: number;
  lineHeight?: number;
  /** When set, draws Compensation Sheet table after body. */
  annualCtc?: number;
  candidateName?: string;
}): Promise<string> {
  const margins = { ...DEFAULT_MARGINS, ...opts.margins };
  const fontSize = opts.fontSize ?? 10.5;
  const lineHeight = opts.lineHeight ?? 14;

  const letterheadBytes = dataUrlToBytes(opts.letterheadDataUrl);
  const letterheadDoc = await PDFDocument.load(letterheadBytes, {
    ignoreEncryption: true,
  });
  if (letterheadDoc.getPageCount() < 1) {
    throw new Error("Letterhead PDF has no pages");
  }

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const fontBold = await out.embedFont(StandardFonts.HelveticaBold);
  const srcPage = letterheadDoc.getPage(0);
  const { width, height } = srcPage.getSize();

  const maxWidth = Math.max(40, width - margins.left - margins.right);
  const contentTop = height - margins.top;
  const contentBottom = margins.bottom;
  const linesPerPage = Math.max(
    1,
    Math.floor((contentTop - contentBottom) / lineHeight),
  );

  const cleanedBody = stripCompensationAppendix(
    stripOfferLetterHeading(opts.body || ""),
  );
  const lines = wrapLines(pdfSafeText(cleanedBody), font, fontSize, maxWidth);
  const pageChunks: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pageChunks.push(lines.slice(i, i + linesPerPage));
  }
  if (pageChunks.length === 0) pageChunks.push([""]);

  for (const chunk of pageChunks) {
    const [page] = await out.copyPages(letterheadDoc, [0]);
    out.addPage(page);
    let y = contentTop;
    for (const line of chunk) {
      if (line) {
        page.drawText(line, {
          x: margins.left,
          y: y - fontSize * 0.2,
          size: fontSize,
          font,
          color: rgb(0.12, 0.12, 0.12),
          maxWidth,
        });
      }
      y -= lineHeight;
      if (y < contentBottom) break;
    }
  }

  const sheet = buildCompensationSheet(
    Number(opts.annualCtc) || 0,
    opts.candidateName,
  );
  if (sheet) {
    const lastIdx = out.getPageCount() - 1;
    const usedLines = pageChunks[pageChunks.length - 1]?.length ?? 0;
    const startYFromTop = margins.top + usedLines * lineHeight + 18;
    await drawCompensationOnPages(
      out,
      letterheadDoc,
      sheet,
      margins,
      lastIdx,
      startYFromTop,
      { regular: font, bold: fontBold },
    );
  }

  const pdfBytes = await out.save();
  let binary = "";
  for (let i = 0; i < pdfBytes.length; i += 1) {
    binary += String.fromCharCode(pdfBytes[i]!);
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}
