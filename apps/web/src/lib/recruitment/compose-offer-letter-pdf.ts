/**
 * Stamp offer body text onto a single-page PDF letterhead.
 * Extra pages are auto-created by copying the letterhead page.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  font: { widthOfTextAtSize: (t: string, size: number) => number },
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
  const srcPage = letterheadDoc.getPage(0);
  const { width, height } = srcPage.getSize();

  const maxWidth = Math.max(40, width - margins.left - margins.right);
  const contentTop = height - margins.top;
  const contentBottom = margins.bottom;
  const linesPerPage = Math.max(
    1,
    Math.floor((contentTop - contentBottom) / lineHeight),
  );

  const lines = wrapLines(
    pdfSafeText(stripOfferLetterHeading(opts.body || "")),
    font,
    fontSize,
    maxWidth,
  );
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

  const pdfBytes = await out.save();
  let binary = "";
  for (let i = 0; i < pdfBytes.length; i += 1) {
    binary += String.fromCharCode(pdfBytes[i]!);
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}
