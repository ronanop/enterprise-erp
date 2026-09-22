/**
 * PDF annotation model and flattening.
 *
 * Annotations are held in PDF user-space coordinates (points, origin at the
 * bottom-left of the page) rather than screen pixels, so they stay correct when
 * the viewer is zoomed or the window is resized. The screen-to-PDF conversion
 * happens once, at the point of click.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type AnnotationKind = "text" | "date" | "signature" | "check";

export type PdfAnnotation = {
  id: string;
  kind: AnnotationKind;
  pageIndex: number;
  /** PDF points from the left edge of the page. */
  x: number;
  /** PDF points from the bottom edge of the page. */
  y: number;
  text: string;
  fontSize: number;
};

export const DEFAULT_FONT_SIZE = 12;
export const SIGNATURE_FONT_SIZE = 18;
export const CHECK_MARK = "X";

const INK = rgb(0.06, 0.09, 0.16);

export function defaultTextFor(kind: AnnotationKind): string {
  if (kind === "date") return new Date().toLocaleDateString("en-IN");
  if (kind === "check") return CHECK_MARK;
  return "";
}

export function fontSizeFor(kind: AnnotationKind): number {
  return kind === "signature" ? SIGNATURE_FONT_SIZE : DEFAULT_FONT_SIZE;
}

/**
 * Convert a click on the rendered canvas into PDF user-space coordinates.
 *
 * Canvas y grows downward from the top; PDF y grows upward from the bottom.
 */
export function canvasPointToPdf(
  canvasX: number,
  canvasY: number,
  scale: number,
  pageHeightPoints: number,
): { x: number; y: number } {
  return {
    x: canvasX / scale,
    y: pageHeightPoints - canvasY / scale,
  };
}

/** Convert a stored PDF point back to a position on the rendered canvas. */
export function pdfPointToCanvas(
  x: number,
  y: number,
  scale: number,
  pageHeightPoints: number,
): { left: number; top: number } {
  return {
    left: x * scale,
    top: (pageHeightPoints - y) * scale,
  };
}

/**
 * Burn the annotations into the PDF and return the new file bytes.
 *
 * Annotations are drawn onto the page content rather than added as PDF
 * comment objects, so the result reads identically in any viewer and cannot be
 * toggled off.
 */
export async function flattenAnnotations(
  sourceBytes: ArrayBuffer,
  annotations: PdfAnnotation[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourceBytes);
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const cursive = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const pages = pdf.getPages();

  for (const annotation of annotations) {
    const page = pages[annotation.pageIndex];
    if (!page || !annotation.text.trim()) continue;

    page.drawText(annotation.text, {
      x: annotation.x,
      // drawText positions the text baseline; nudge down so the glyph sits
      // where the box appeared on screen.
      y: annotation.y - annotation.fontSize,
      size: annotation.fontSize,
      font: annotation.kind === "signature" ? cursive : helvetica,
      color: INK,
    });
  }

  return pdf.save();
}

export function downloadBytes(bytes: Uint8Array, fileName: string): void {
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
