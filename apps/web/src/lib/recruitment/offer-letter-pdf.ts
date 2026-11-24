import { jsPDF } from "jspdf";

import {
  computeSplitFromAnnualCtc,
  salaryBreakdownLines,
  type CtcSplit,
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
  return `Rs.${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** Build a simple A4 PDF data URL from offer letter plain text. */
export function buildOfferLetterPdfDataUrl(opts: {
  title?: string;
  offerCode?: string;
  body: string;
  /** Annual CTC — when set, appends monthly Excel 60/50 salary structure table. */
  annualCtc?: number;
  salarySplit?: CtcSplit | null;
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
  // Strip a duplicated salary-structure appendix if body already contains one —
  // we render a proper table below from annualCtc.
  const bodyText = (opts.body || "")
    .replace(/^\s*(INTERNSHIP\s+)?OFFER\s+LETTER\s*(\r?\n)+/i, "")
    .replace(/\n*Salary structure \(monthly[\s\S]*$/i, "")
    .trimEnd();
  const lines = doc.splitTextToSize(pdfSafeText(bodyText), maxW) as string[];
  for (const line of lines) {
    if (y > pageH - 20) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, marginX, y);
    y += 6;
  }

  const annual = Number(opts.annualCtc) || 0;
  const split =
    opts.salarySplit ??
    (annual > 0 ? computeSplitFromAnnualCtc(annual) : null);
  if (split && split.valid && annual > 0) {
    y += 4;
    if (y > pageH - 60) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Salary structure (monthly)", marginX, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(
      pdfSafeText(`Annual CTC ${fmtInr(Math.round(annual))}  ·  Excel 60/50 split`),
      marginX,
      y,
    );
    doc.setTextColor(0);
    y += 5;

    const colLabel = marginX;
    const colAmt = pageW - marginX;
    const rows = salaryBreakdownLines(split).filter(
      (r) => r.label !== "Structure CTC" || r.amount !== split.monthlyCtc,
    );
    for (const row of rows) {
      if (y > pageH - 16) {
        doc.addPage();
        y = 20;
      }
      const emphasize = row.label === "Monthly CTC" || row.label === "Employee gross";
      doc.setFont("helvetica", emphasize ? "bold" : "normal");
      doc.setFontSize(10);
      doc.text(pdfSafeText(row.label), colLabel, y);
      doc.text(pdfSafeText(fmtInr(row.amount)), colAmt, y, { align: "right" });
      y += 5;
      if (row.hint) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(pdfSafeText(row.hint), colLabel, y);
        doc.setTextColor(0);
        y += 4;
      }
    }
  }

  // Clean data URL — avoid `;filename=…` which breaks Chrome iframe PDF preview
  const raw = doc.output("datauristring");
  const comma = raw.indexOf(",");
  if (comma < 0) return raw;
  return `data:application/pdf;base64,${raw.slice(comma + 1)}`;
}
