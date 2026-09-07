import { jsPDF } from "jspdf";

import { resolveCompanyEntity, type CompanyEntityConfig } from "@/config/company-entities";
import { CACHE_LOGO_PATH, loadCacheLogo } from "@/utils/load-cache-logo";
import { amountInIndianWords, dash, formatInrPdf } from "@/utils/purchase-order-amount-words";
import type { PayslipRecord } from "@/types/payroll-management";
import type { HrMasterOption } from "@/services/hr-master-connector";

export type PayslipPdfContext = {
  employeeCode: string;
  department: string;
  designation: string;
  bank: string;
  entity: CompanyEntityConfig;
};

export function resolvePayslipEntity(companyName?: string | null): CompanyEntityConfig {
  const n = (companyName || "").toLowerCase();
  if (n.includes("technolog") && !n.includes("digitech") && !n.includes("digi")) {
    return resolveCompanyEntity("CT");
  }
  return resolveCompanyEntity("CDT");
}

export function payslipPdfContext(
  slip: PayslipRecord,
  employees: HrMasterOption[],
): PayslipPdfContext {
  const emp = employees.find((e) => e.id === slip.employeeId);
  const entity = resolvePayslipEntity(emp?.companyName);
  const last4 = String(emp?.accountNumber || "").replace(/\D/g, "").slice(-4);
  const bank =
    slip.bankAccount && slip.bankAccount !== "—" && slip.bankAccount !== "XXXX"
      ? slip.bankAccount
      : [emp?.bankName, last4 ? `****${last4}` : emp?.bankAccount].filter(Boolean).join(" · ") || "—";
  return {
    employeeCode: (emp?.code || slip.employeeCode || "").trim(),
    department: emp?.department || slip.department || "—",
    designation: emp?.designation || "—",
    bank,
    entity,
  };
}

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(dash(text), maxWidth) as string[];
}

function strokeRect(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(30);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h);
}

function money(value: number): string {
  return `Rs. ${formatInrPdf(value)}`;
}

function drawSlipPage(
  doc: jsPDF,
  slip: PayslipRecord,
  ctx: PayslipPdfContext,
  logo: { dataUrl: string; width: number; height: number } | null,
) {
  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margin * 2;
  let y = margin;

  const logoW = 32;
  let logoH = 14;
  if (logo) {
    logoH = (logo.height / logo.width) * logoW;
    doc.addImage(logo.dataUrl, "JPEG", margin, y, logoW, logoH);
  }

  const rightX = pageW - margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(ctx.entity.displayName, rightX, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  let hy = y + 8;
  for (const line of ctx.entity.addressLines.slice(0, 5)) {
    doc.text(line, rightX, hy, { align: "right" });
    hy += 3.2;
  }
  y = Math.max(y + logoH + 4, hy + 2);

  doc.setDrawColor(30);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("SALARY SLIP", pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`For the month of ${slip.monthLabel}`, pageW / 2, y, { align: "center" });
  y += 6;

  const metaH = 28;
  strokeRect(doc, margin, y, contentW, metaH);
  doc.setFontSize(8);
  const col2 = margin + contentW / 2;
  const rows: [string, string, string, string][] = [
    ["Employee", dash(slip.employeeName), "Employee code", dash(ctx.employeeCode)],
    ["Designation", dash(ctx.designation), "Department", dash(ctx.department)],
    [
      "Payable days",
      `${slip.payableDays ?? slip.presentDays ?? "—"} / ${slip.periodDays ?? 30}`,
      "LOP",
      String(slip.lopDays ?? 0),
    ],
    ["Bank", dash(ctx.bank), "Payslip no.", dash(slip.payslipCode)],
  ];
  let my = y + 5;
  for (const [l1, v1, l2, v2] of rows) {
    doc.setFont("helvetica", "bold");
    doc.text(`${l1}:`, margin + 2, my);
    doc.setFont("helvetica", "normal");
    doc.text(v1, margin + 28, my);
    doc.setFont("helvetica", "bold");
    doc.text(`${l2}:`, col2 + 2, my);
    doc.setFont("helvetica", "normal");
    doc.text(v2, col2 + 32, my);
    my += 5.8;
  }
  y += metaH + 5;

  const earn = slip.earnings.filter((e) => e.amount !== 0 || e.label.toLowerCase() === "basic");
  const deduct = slip.deductions.filter((d) => (d.label || "").toLowerCase() !== "pf (total)");
  const rowCount = Math.max(earn.length, deduct.length, 1) + 1;
  const rowH = 6.2;
  const tableH = 8 + rowCount * rowH;
  const half = contentW / 2;
  strokeRect(doc, margin, y, half, tableH);
  strokeRect(doc, margin + half, y, half, tableH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Earnings", margin + 3, y + 5);
  doc.text("Amount", margin + half - 3, y + 5, { align: "right" });
  doc.text("Deductions", margin + half + 3, y + 5);
  doc.text("Amount", margin + contentW - 3, y + 5, { align: "right" });
  doc.setLineWidth(0.2);
  doc.line(margin, y + 7, margin + contentW, y + 7);

  doc.setFont("helvetica", "normal");
  for (let i = 0; i < rowCount - 1; i += 1) {
    const ty = y + 8 + (i + 1) * rowH - 1.5;
    const e = earn[i];
    const d = deduct[i];
    if (e) {
      doc.text(e.label, margin + 3, ty);
      doc.text(money(e.amount), margin + half - 3, ty, { align: "right" });
    }
    if (d) {
      doc.text(d.label, margin + half + 3, ty);
      doc.text(money(d.amount), margin + contentW - 3, ty, { align: "right" });
    }
  }
  const fy = y + 8 + rowCount * rowH - 1.5;
  doc.setFont("helvetica", "bold");
  doc.text("Gross", margin + 3, fy);
  doc.text(money(slip.gross), margin + half - 3, fy, { align: "right" });
  doc.text("Total deductions", margin + half + 3, fy);
  doc.text(money(slip.totalDeductions), margin + contentW - 3, fy, { align: "right" });
  y += tableH + 6;

  strokeRect(doc, margin, y, contentW, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Net pay", margin + 3, y + 8);
  doc.text(money(slip.net), margin + contentW - 3, y + 8, { align: "right" });
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const words = wrap(doc, `Amount in words: ${amountInIndianWords(slip.net)}`, contentW - 4);
  for (const line of words) {
    doc.text(line, margin + 2, y);
    y += 4;
  }
  y += 6;
  doc.setFontSize(7);
  doc.setTextColor(90);
  doc.text("This is a computer-generated salary slip and does not require a signature.", margin, y);
  doc.setTextColor(0);
}

export async function downloadPayslipPdf(
  slip: PayslipRecord,
  ctx: PayslipPdfContext,
  fileName?: string,
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await loadCacheLogo(CACHE_LOGO_PATH);
  drawSlipPage(doc, slip, ctx, logo);
  doc.save(fileName || `${slip.payslipCode || "salary-slip"}.pdf`);
}

export async function downloadPayslipsPdf(
  rows: Array<{ slip: PayslipRecord; ctx: PayslipPdfContext }>,
  fileName: string,
): Promise<void> {
  if (!rows.length) return;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await loadCacheLogo(CACHE_LOGO_PATH);
  rows.forEach((row, i) => {
    if (i > 0) doc.addPage();
    drawSlipPage(doc, row.slip, row.ctx, logo);
  });
  doc.save(fileName);
}
