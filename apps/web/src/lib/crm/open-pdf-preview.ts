/** Shared helpers for CRM PDF print preview vs download. */

import type { jsPDF } from "jspdf";

/**
 * Open a generated PDF in a new browser tab (Print preview).
 * Does not download and does not open the system print dialog.
 * Falls back to download only if the popup is blocked.
 */
export function openPdfInNewTab(doc: jsPDF, fallbackFilename: string): void {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank");
  if (!opened) {
    doc.save(fallbackFilename);
  } else {
    try {
      opened.opener = null;
    } catch {
      /* ignore */
    }
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

/** @deprecated Alias kept for older callers - opens PDF tab only. */
export function openPdfPrintPreview(doc: jsPDF, fallbackFilename = "preview.pdf"): void {
  openPdfInNewTab(doc, fallbackFilename);
}

/** Force-download a generated PDF (Export). */
export function downloadPdf(doc: jsPDF, filename: string): void {
  doc.save(filename);
}
