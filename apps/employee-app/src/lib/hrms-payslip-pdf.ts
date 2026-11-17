/**
 * ESS payslip PDF — same salary-slip layout as HRMS (`apps/web` payslip-pdf).
 */
import { jsPDF } from "jspdf";

import { amountInIndianWords, dash, formatInrPdf } from "@/lib/amount-in-words";
import { parsePayslipLines, periodLabel } from "@/lib/payslip-display";
import type { EssBank, EssKyc, EssMe, EssPayslip } from "@/types/api";

export type EssPayslipPdfContext = {
  me: EssMe | null;
  bank: EssBank | null;
  kyc: EssKyc | null;
  companyName?: string | null;
  companyAddress?: string[] | null;
  companyPan?: string | null;
  companyTan?: string | null;
};

type MoneyRow = { label: string; monthly: number; yearly: number };

function money(value: number): string {
  return `Rs. ${formatInrPdf(value)}`;
}

function capitalizeWords(value: string): string {
  const text = String(value ?? "").trim();
  if (!text) return text;
  return text.replace(
    /(^|[\s\-_/.(])([a-z])/g,
    (_, sep: string, ch: string) => `${sep}${ch.toUpperCase()}`,
  );
}

function maskAccount(value: string | null | undefined): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 4) return dash(value);
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function fitText(doc: jsPDF, text: string, maxWidth: number): string {
  const raw = String(text ?? "");
  if (!raw) return "";
  if (doc.getTextWidth(raw) <= maxWidth) return raw;
  let out = raw;
  while (out.length > 1 && doc.getTextWidth(`${out}…`) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function gridLine(doc: jsPDF, x1: number, y1: number, x2: number, y2: number) {
  doc.setDrawColor(180);
  doc.setLineWidth(0.2);
  doc.line(x1, y1, x2, y2);
}

function strokeRect(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(30);
  doc.setLineWidth(0.35);
  doc.rect(x, y, w, h);
}

function asMoneyRows(lines: Array<{ label: string; amount: number }>): MoneyRow[] {
  return lines.map((row) => ({
    label: row.label,
    monthly: row.amount,
    yearly: Math.round(row.amount * 12),
  }));
}

function attendanceNumber(slip: EssPayslip, keys: string[]): string {
  const src = (slip.attendance_summary ??
    (slip.payslip_json as Record<string, unknown> | null)?.attendance_summary ??
    {}) as Record<string, unknown>;
  for (const key of keys) {
    const value = src[key];
    if (value != null && value !== "") return String(value);
  }
  return "—";
}

function drawSlipPage(
  doc: jsPDF,
  slip: EssPayslip,
  ctx: EssPayslipPdfContext,
) {
  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margin * 2;
  let y = margin;

  const entityName =
    ctx.companyName?.trim() ||
    String(
      (slip.payslip_json as Record<string, unknown> | null)?.company_name || "",
    ).trim() ||
    "Company";
  const address =
    ctx.companyAddress?.filter(Boolean) ??
    ([
      String(
        (slip.payslip_json as Record<string, unknown> | null)?.company_address ||
          "",
      ).trim(),
    ].filter(Boolean) as string[]);

  const rightX = pageW - margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(dash(entityName), rightX, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  let hy = y + 8;
  const addressLines = address.length ? address.slice(0, 4) : ["—"];
  for (const line of addressLines) {
    doc.text(line, rightX, hy, { align: "right" });
    hy += 3.2;
  }
  doc.text(`PAN: ${dash(ctx.companyPan)}`, rightX, hy, { align: "right" });
  hy += 3.2;
  doc.text(`TAN: ${dash(ctx.companyTan)}`, rightX, hy, { align: "right" });
  hy += 3.2;
  y = Math.max(y + 8, hy + 2);

  doc.setDrawColor(30);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("SALARY SLIP", pageW / 2, y, { align: "center" });
  y += 4.2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`For the month of ${periodLabel(slip)}`, pageW / 2, y, {
    align: "center",
  });
  y += 4;

  const parsed = parsePayslipLines(slip);
  const earnings = asMoneyRows(parsed.earnings);
  const deductions = asMoneyRows(parsed.deductions);
  const net = Number(slip.net_salary) || parsed.net || 0;
  const gross =
    Number(slip.gross_salary) ||
    earnings.reduce((sum, row) => sum + row.monthly, 0);
  const totalDed =
    Number(slip.total_deductions) ||
    deductions.reduce((sum, row) => sum + row.monthly, 0);

  const rows: [string, string, string, string][] = [
    [
      "Payslip No.",
      dash(slip.document_number),
      "Employment Type",
      dash(ctx.me?.status),
    ],
    [
      "Employee Name",
      capitalizeWords(dash(slip.employee_name || ctx.me?.display_name)),
      "Employee Code",
      dash(slip.employee_code || ctx.me?.employee_code),
    ],
    [
      "Designation",
      dash(ctx.me?.designation),
      "Department",
      dash(ctx.me?.department_name),
    ],
    ["Location", "—", "Date Of Joining", dash(ctx.me?.date_of_joining)],
    [
      "UAN",
      dash(ctx.kyc?.uan_number),
      "PAN",
      dash(ctx.kyc?.pan_number),
    ],
    [
      "Bank Account Number",
      maskAccount(ctx.bank?.bank_account_number),
      "Bank Name",
      dash(ctx.bank?.bank_name),
    ],
    [
      "IFSC",
      dash(ctx.bank?.bank_ifsc),
      "Payment Status",
      dash(slip.payment_status),
    ],
    [
      "Working Days",
      attendanceNumber(slip, ["working_days", "period_days", "salary_days"]),
      "Present",
      attendanceNumber(slip, ["present_days", "present"]),
    ],
    [
      "Paid Leave",
      attendanceNumber(slip, ["leave_days", "paid_leave"]),
      "LOP Days",
      attendanceNumber(slip, ["lop_days", "unpaid_leave_days"]),
    ],
  ];

  const metaRowH = 5.2;
  const metaH = rows.length * metaRowH;
  const metaLabelW = 38;
  const metaMid = margin + contentW / 2;
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, contentW, metaH, "F");
  doc.setTextColor(0);
  doc.setFontSize(7.5);
  rows.forEach(([l1, v1, l2, v2], index) => {
    const top = y + index * metaRowH;
    const baseline = top + metaRowH - 1.7;
    if (index > 0) gridLine(doc, margin, top, margin + contentW, top);
    doc.setFont("helvetica", "bold");
    doc.text(fitText(doc, l1, metaLabelW - 2.4), margin + 1.4, baseline);
    doc.setFont("helvetica", "normal");
    doc.text(
      fitText(doc, v1, contentW / 2 - metaLabelW - 2.4),
      margin + metaLabelW + 1.4,
      baseline,
    );
    doc.setFont("helvetica", "bold");
    doc.text(fitText(doc, l2, metaLabelW - 2.4), metaMid + 1.4, baseline);
    doc.setFont("helvetica", "normal");
    doc.text(
      fitText(doc, v2, contentW / 2 - metaLabelW - 2.4),
      metaMid + metaLabelW + 1.4,
      baseline,
    );
  });
  gridLine(doc, margin + metaLabelW, y, margin + metaLabelW, y + metaH);
  gridLine(doc, metaMid, y, metaMid, y + metaH);
  gridLine(doc, metaMid + metaLabelW, y, metaMid + metaLabelW, y + metaH);
  strokeRect(doc, margin, y, contentW, metaH);
  y += metaH + 2;

  const dataRows = Math.max(earnings.length, deductions.length, 1);
  const moneyHeadH = 5.2;
  const moneyRowH = 4.8;
  const tableH = moneyHeadH + (dataRows + 1) * moneyRowH;
  const half = contentW / 2;

  function drawMoneyTable(
    x: number,
    title: string,
    lines: MoneyRow[],
    totalLabel: string,
    totalMonthly: number,
    totalYearly: number,
  ) {
    const labelW = half * 0.46;
    const moneyW = (half - labelW) / 2;
    doc.setFillColor(236, 236, 236);
    doc.rect(x, y, half, moneyHeadH, "F");
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const headBase = y + moneyHeadH - 1.6;
    doc.text(fitText(doc, title, labelW - 2.4), x + 1.4, headBase);
    doc.text("Monthly", x + labelW + moneyW - 1.3, headBase, { align: "right" });
    doc.text("Yearly", x + half - 1.3, headBase, { align: "right" });
    gridLine(doc, x, y + moneyHeadH, x + half, y + moneyHeadH);
    gridLine(doc, x + labelW, y, x + labelW, y + tableH);
    gridLine(doc, x + labelW + moneyW, y, x + labelW + moneyW, y + tableH);

    const body: Array<MoneyRow | null> = [...lines];
    while (body.length < dataRows) body.push(null);
    body.forEach((line, index) => {
      const top = y + moneyHeadH + index * moneyRowH;
      gridLine(doc, x, top, x + half, top);
      if (!line) return;
      const baseline = top + moneyRowH - 1.6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(fitText(doc, line.label, labelW - 2.6), x + 1.4, baseline);
      doc.text(money(line.monthly), x + labelW + moneyW - 1.3, baseline, {
        align: "right",
      });
      doc.text(money(line.yearly), x + half - 1.3, baseline, { align: "right" });
    });
    const totalTop = y + moneyHeadH + dataRows * moneyRowH;
    gridLine(doc, x, totalTop, x + half, totalTop);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const totalBase = totalTop + moneyRowH - 1.6;
    doc.text(fitText(doc, totalLabel, labelW - 2.6), x + 1.4, totalBase);
    doc.text(money(totalMonthly), x + labelW + moneyW - 1.3, totalBase, {
      align: "right",
    });
    doc.text(money(totalYearly), x + half - 1.3, totalBase, { align: "right" });
  }

  drawMoneyTable(
    margin,
    "Earnings (A)",
    earnings,
    "Total Earnings (A)",
    gross,
    Math.round(gross * 12),
  );
  drawMoneyTable(
    margin + half,
    "Deductions (B)",
    deductions,
    "Total Deductions (B)",
    totalDed,
    Math.round(totalDed * 12),
  );
  gridLine(doc, margin + half, y, margin + half, y + tableH);
  strokeRect(doc, margin, y, contentW, tableH);
  y += tableH + 2;

  const words = wrap(
    doc,
    `Amount In Words: ${amountInIndianWords(net)}`,
    contentW - 6,
  );
  const summaryLines: Array<[string, string]> = [
    ["Net Payable Salary", money(net)],
    ["Gross Earnings", money(gross)],
    ["Total Deductions", money(totalDed)],
  ];
  const summaryRowH = 4.6;
  const wordsH = Math.max(summaryRowH, words.length * 3.6 + 2.4);
  const summaryH = wordsH + summaryLines.length * summaryRowH;
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  words.forEach((line, index) => {
    doc.text(line, margin + 1.4, y + 3.4 + index * 3.4);
  });
  gridLine(doc, margin, y + wordsH, margin + contentW, y + wordsH);
  summaryLines.forEach(([label, value], index) => {
    const top = y + wordsH + index * summaryRowH;
    if (index > 0) gridLine(doc, margin, top, margin + contentW, top);
    const baseline = top + summaryRowH - 1.5;
    doc.setFont(
      "helvetica",
      label === "Net Payable Salary" ? "bold" : "normal",
    );
    doc.text(label, margin + 1.4, baseline);
    doc.text(value, margin + contentW - 1.4, baseline, { align: "right" });
  });
  strokeRect(doc, margin, y, contentW, summaryH);
  y += summaryH + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90);
  const notes = [
    "This is a system generated payslip and does not require a signature.",
    "Salary is processed based on attendance and company policies.",
    "Tax calculations are based on current declarations and may change subject to actual investments.",
    "For any discrepancies, contact HR within 7 days.",
  ];
  for (const note of notes) {
    doc.text(note, margin, y);
    y += 3.1;
  }
  doc.setTextColor(0);
}

export function createEssPayslipPdf(
  slip: EssPayslip,
  ctx: EssPayslipPdfContext,
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  drawSlipPage(doc, slip, ctx);
  return doc;
}

export async function downloadEssPayslipPdf(
  slip: EssPayslip,
  ctx: EssPayslipPdfContext,
  fileName?: string,
): Promise<void> {
  const doc = createEssPayslipPdf(slip, ctx);
  doc.save(fileName || `${slip.document_number || "salary-slip"}.pdf`);
}
