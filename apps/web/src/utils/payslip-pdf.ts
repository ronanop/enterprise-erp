import { jsPDF } from "jspdf";

import type { HrMasterOption } from "@/services/hr-master-connector";
import type { EmployeeRecord } from "@/types/employee-management";
import type { PayslipRecord } from "@/types/payroll-management";
import { getStoredOrgContext } from "@/lib/org-context-storage";
import { employerPfAmount, getCachedPayrollPfPolicy } from "@/lib/payroll-pf-policy";
import { maskAccount } from "@/lib/pii-mask";
import { tdsForTheMonth, tdsForTheYear } from "@/lib/salary-structure-excel";
import { amountInIndianWords, dash, formatInrPdf } from "@/utils/purchase-order-amount-words";

export type PayslipCompany = {
  id: string;
  legalName: string;
  companyName: string;
  pan: string;
  tan: string;
  logoUrl: string;
  addressLines: string[];
  fiscalStartMonth: number;
};

export type PayslipPdfContext = {
  employeeCode: string;
  department: string;
  designation: string;
  location: string;
  joiningDate: string;
  employmentType: string;
  pan: string;
  uan: string;
  bank: string;
  ifsc: string;
  lateCount: string;
  paymentStatus: string;
  entityName: string;
  entityAddress: string[];
  entityPan: string;
  entityTan: string;
  logoUrl: string;
  yearLabel: string;
  ytdEarnings: number | null;
  ytdDeductions: number | null;
  ytdNet: number | null;
  ytdTds: number | null;
  ytdPf: number | null;
  ytdProfessionalTax: number | null;
  ytdLop: number | null;
  ytdMonths: number;
  monthsLeft: number;
  nextMonths: string[];
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  permanent: "Permanent",
  contract: "Contract",
  intern: "Intern",
  consultant: "Consultant",
  full_time: "Full time",
};

function clean(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text === "—" || text === "-") return "";
  return text;
}

function formatJoin(iso: string): string {
  if (!iso) return "";
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function monthKey(slip: PayslipRecord): string {
  return String(slip.month || "").slice(0, 7);
}

function fyStartKey(month: string, fiscalStart: number): string {
  const year = Number(month.slice(0, 4));
  const mon = Number(month.slice(5, 7));
  if (!year || !mon) return "";
  const startYear = mon >= fiscalStart ? year : year - 1;
  return `${startYear}-${String(fiscalStart).padStart(2, "0")}`;
}

function monthsLeftInFy(month: string, fiscalStart: number): number {
  const mon = Number(month.slice(5, 7));
  if (!mon) return 0;
  const end = fiscalStart === 1 ? 12 : fiscalStart - 1;
  if (mon === end) return 0;
  if (mon < end) return end - mon;
  return 12 - mon + end;
}

function monthName(key: string): string {
  const date = new Date(`${key}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function addMonths(key: string, count: number): string {
  const date = new Date(`${key}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setMonth(date.getMonth() + count);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function paymentLabel(status?: string): string {
  const key = (status ?? "").trim().toLowerCase();
  if (key === "paid") return "Paid";
  if (key === "processing") return "Processing";
  if (key === "failed") return "Failed";
  if (key === "unpaid" || key === "pending") return "Pending";
  if (!key) return "";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function lineAmount(slip: PayslipRecord, pattern: RegExp, exclude?: RegExp): number | null {
  const hits = slip.deductions.filter((row) => {
    const label = row.label.toLowerCase();
    return pattern.test(label) && !(exclude && exclude.test(label));
  });
  if (!hits.length) return null;
  return hits.reduce((sum, row) => sum + row.amount, 0);
}

export function payslipCompanyFromApi(row: Record<string, unknown>): PayslipCompany {
  const address = [
    clean(row.address_line1),
    clean(row.address_line2),
    [clean(row.city), clean(row.state_name), clean(row.postal_code)].filter(Boolean).join(", "),
  ].filter(Boolean);
  const start = Number(row.fiscal_year_start_month ?? 4);
  return {
    id: String(row.id ?? ""),
    legalName: clean(row.legal_name),
    companyName: clean(row.company_name),
    pan: clean(row.tax_number),
    tan: clean(row.tan_number),
    logoUrl: clean(row.logo_url),
    addressLines: address,
    fiscalStartMonth: start >= 1 && start <= 12 ? start : 4,
  };
}

export function payslipPdfContext(
  slip: PayslipRecord,
  employees: HrMasterOption[],
  records: EmployeeRecord[] = [],
  companies: PayslipCompany[] = [],
  slips: PayslipRecord[] = [],
): PayslipPdfContext {
  const option = employees.find((row) => row.id === slip.employeeId);
  const record =
    records.find((row) => row.id === slip.employeeId) ||
    records.find(
      (row) => row.employeeCode && row.employeeCode === (slip.employeeCode || option?.code),
    );
  const sessionCompanyId = getStoredOrgContext()?.companyId ?? "";
  const company =
    companies.find((row) => row.id && row.id === record?.companyId) ||
    companies.find((row) => row.id && row.id === option?.companyId) ||
    companies.find((row) => row.id && row.id === sessionCompanyId) ||
    (companies.length === 1 ? companies[0] : undefined) ||
    companies.find((row) => row.legalName || row.companyName || row.addressLines.length);
  const bankSource = record?.extension.companyBank.accountNumber
    ? record.extension.companyBank
    : record?.extension.bank;
  const account = maskAccount(clean(bankSource?.accountNumber) || clean(option?.accountNumber));
  const bankName = clean(bankSource?.bankName) || clean(option?.bankName);
  const employmentRaw = clean(record?.employmentType || record?.extension.employment.employmentType);
  const month = monthKey(slip) || new Date().toISOString().slice(0, 7);
  const fiscalStart = company?.fiscalStartMonth ?? 4;
  const startKey = fyStartKey(month, fiscalStart);
  const mine = slips.filter((row) => {
    const key = monthKey(row);
    const same =
      row.employeeId === slip.employeeId ||
      Boolean(record?.employeeCode && row.employeeCode === record.employeeCode);
    return same && Boolean(key && startKey && key >= startKey && key <= month);
  });
  const pool = mine.some((row) => row.id === slip.id) ? mine : [...mine, slip];
  const sumOrNull = (pick: (row: PayslipRecord) => number | null): number | null => {
    const values = pool.map(pick).filter((value): value is number => value != null);
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0);
  };
  const startYear = Number(startKey.slice(0, 4));
  const endYear = fiscalStart === 1 ? startYear : startYear + 1;
  const endMonth = fiscalStart === 1 ? 12 : fiscalStart - 1;
  const yearLabel = startKey
    ? `${monthName(startKey)} – ${monthName(`${endYear}-${String(endMonth).padStart(2, "0")}`)}`
    : "";

  return {
    employeeCode: clean(record?.employeeCode || option?.code || slip.employeeCode),
    department: clean(record?.departmentName || option?.department || slip.department),
    designation: clean(record?.designationName || option?.designation),
    location: clean(record?.locationName || record?.extension.employment.location),
    joiningDate: formatJoin(clean(record?.joiningDate || record?.extension.employment.joiningDate)),
    employmentType: EMPLOYMENT_LABELS[employmentRaw] || employmentRaw,
    pan: clean(record?.extension.governmentIds.pan),
    uan: clean(record?.extension.governmentIds.uan),
    bank: [account, bankName ? `(${bankName})` : ""].filter(Boolean).join(" "),
    ifsc: clean(bankSource?.ifsc) || clean(option?.bankIfsc),
    lateCount: slip.lateCount == null ? "" : String(slip.lateCount),
    paymentStatus: paymentLabel(slip.paymentStatus),
    entityName: clean(
      company?.legalName || company?.companyName || record?.companyName || option?.companyName,
    ),
    entityAddress: company?.addressLines ?? [],
    entityPan: company?.pan ?? "",
    entityTan: company?.tan ?? "",
    logoUrl: company?.logoUrl ?? "",
    yearLabel,
    ytdEarnings: pool.length ? pool.reduce((sum, row) => sum + row.gross, 0) : null,
    ytdDeductions: pool.length ? pool.reduce((sum, row) => sum + row.totalDeductions, 0) : null,
    ytdNet: pool.length ? pool.reduce((sum, row) => sum + row.net, 0) : null,
    ytdTds: sumOrNull((row) => lineAmount(row, /tds|income tax/)),
    ytdPf: sumOrNull((row) => lineAmount(row, /provident|pf/, /employer/)),
    ytdProfessionalTax: sumOrNull((row) => lineAmount(row, /professional tax/)),
    ytdLop: (() => {
      const amounts = pool.map((row) =>
        payslipFigures(row)
          .deductions.filter((line) => /leave without pay|\blop\b/i.test(line.label))
          .reduce((sum, line) => sum + line.monthly, 0),
      );
      return amounts.some((amount) => amount > 0) ? amounts.reduce((sum, amount) => sum + amount, 0) : null;
    })(),
    ytdMonths: pool.length,
    monthsLeft: monthsLeftInFy(month, fiscalStart),
    nextMonths: [1, 2, 3]
      .map((step) => addMonths(month, step))
      .filter(Boolean)
      .slice(0, monthsLeftInFy(month, fiscalStart)),
  };
}

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(dash(text), maxWidth) as string[];
}

function strokeRect(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(30);
  doc.setLineWidth(0.4);
  doc.rect(x, y, w, h);
}

function gridLine(doc: jsPDF, x1: number, y1: number, x2: number, y2: number) {
  doc.setDrawColor(90);
  doc.setLineWidth(0.2);
  doc.line(x1, y1, x2, y2);
}

function fitText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

function money(value: number): string {
  return `Rs. ${formatInrPdf(value)}`;
}

function moneyOrBlank(value: number | null): string {
  return value == null ? "—" : money(value);
}

export type PayslipMoneyRow = { label: string; monthly: number; yearly: number; recurring: boolean };

export type PayslipFigures = {
  salaryDays: number;
  presentDays: number;
  leaveDays: number;
  unpaidLeaveDays: number | null;
  lopDays: number;
  earnings: PayslipMoneyRow[];
  deductions: PayslipMoneyRow[];
  monthlyGross: number;
  yearlyGross: number;
  lopAmount: number;
  monthlyDeductions: number;
  yearlyDeductions: number;
  net: number;
  employerPf: number;
  employerEsi: number;
  employerContribution: number;
  costToCompany: number;
};

export type PayslipProjection = {
  earnings: number;
  deductions: number;
  net: number;
  tdsYear: number;
  monthTds: number;
  nextTds: number;
  nextNet: number | null;
};

function isEmployerLabel(label: string): boolean {
  return label.toLowerCase().includes("employer");
}

function isOneTimeEarning(label: string): boolean {
  return /overtime|bonus|arrear|incentive|reimbursement|performance/i.test(label);
}

function isOneTimeDeduction(label: string): boolean {
  return /leave without pay|\blop\b|late/i.test(label);
}

function moneyRow(label: string, monthly: number, recurring: boolean): PayslipMoneyRow {
  const amount = Math.round(monthly);
  return { label, monthly: amount, yearly: recurring ? amount * 12 : amount, recurring };
}

/**
 * Earnings are the posted lines, restored to a full month when loss of pay
 * reduced them on the payroll divisor. Yearly is × 12 for recurring lines only.
 * LOP, late marks, bonus, and arrears keep the posted amount.
 */
export function payslipFigures(slip: PayslipRecord): PayslipFigures {
  const divisor = slip.periodDays && slip.periodDays > 0 ? slip.periodDays : 30;
  const payable = slip.payableDays ?? divisor;
  const factor = divisor > 0 ? Math.min(1, Math.max(0, payable / divisor)) : 1;
  const workingDays =
    slip.scheduledWorkingDays && slip.scheduledWorkingDays > 0 ? slip.scheduledWorkingDays : divisor;

  const listedEarnings = slip.earnings.filter(
    (row) => row.amount !== 0 || row.label.toLowerCase() === "basic",
  );
  const recurringPosted = listedEarnings.filter((row) => !isOneTimeEarning(row.label));
  const variablePosted = listedEarnings.filter((row) => isOneTimeEarning(row.label));
  const recurringSum = recurringPosted.reduce((sum, row) => sum + row.amount, 0);
  const variableSum = variablePosted.reduce((sum, row) => sum + row.amount, 0);
  const grossForLines = Math.round(slip.gross);
  const variableAlreadyInSplit = Math.abs(recurringSum - grossForLines) < 2 && variableSum > 0;
  const sourceEarnings = variableAlreadyInSplit ? recurringPosted : listedEarnings;
  const postedSum = sourceEarnings.reduce((sum, row) => sum + row.amount, 0);
  const gross = Math.round(slip.gross);
  const canRestore = Math.abs(postedSum - gross) < 2 && factor > 0 && factor < 0.999;

  const earnings = sourceEarnings.map((row) => {
    const recurring = !isOneTimeEarning(row.label);
    const monthly = canRestore && recurring ? row.amount / factor : row.amount;
    return moneyRow(row.label, monthly, recurring);
  });
  const monthlyGross = earnings.reduce((sum, row) => sum + row.monthly, 0);
  const yearlyGross = earnings.reduce((sum, row) => sum + row.yearly, 0);
  const lopAlreadyListed = slip.deductions.some((row) => isOneTimeDeduction(row.label) && /lop|leave without pay/i.test(row.label));
  const lopAmount = lopAlreadyListed ? 0 : Math.max(0, monthlyGross - gross);

  const deductionLines = slip.deductions.filter(
    (row) => row.amount > 0 && row.label.toLowerCase() !== "pf (total)",
  );
  const lineSum = deductionLines.reduce((sum, row) => sum + row.amount, 0);
  const employerFromLines = deductionLines
    .filter((row) => isEmployerLabel(row.label))
    .reduce((sum, row) => sum + row.amount, 0);
  const labeledEmployerPf = deductionLines
    .filter((row) => isEmployerLabel(row.label) && /pf|provident/i.test(row.label))
    .reduce((sum, row) => sum + row.amount, 0);
  const labeledEmployerEsi = deductionLines
    .filter((row) => isEmployerLabel(row.label) && /esi/i.test(row.label))
    .reduce((sum, row) => sum + row.amount, 0);
  const postedEmployer =
    employerFromLines > 0 ? employerFromLines : Math.round(slip.employerContribution ?? 0);
  const employerInTotal = Math.abs(lineSum - Math.round(slip.totalDeductions)) < 2;
  const shownDeductions = employerInTotal
    ? deductionLines
    : deductionLines.filter((row) => !isEmployerLabel(row.label));

  const deductions: PayslipMoneyRow[] = shownDeductions.map((row) =>
    moneyRow(row.label, row.amount, !isOneTimeDeduction(row.label)),
  );
  if (lopAmount > 0) {
    deductions.push(
      moneyRow(
        slip.lopDays
          ? `Leave without pay (${slip.lopDays} day${slip.lopDays === 1 ? "" : "s"})`
          : "Leave without pay",
        lopAmount,
        false,
      ),
    );
  }

  const monthlyDeductions = deductions.reduce((sum, row) => sum + row.monthly, 0);
  const yearlyDeductions = deductions.reduce((sum, row) => sum + row.yearly, 0);
  const monthlyBasic = earnings.find((row) => row.label.toLowerCase() === "basic")?.monthly ?? 0;
  let employerPf = Math.round(labeledEmployerPf);
  let employerEsi = Math.round(labeledEmployerEsi);
  if (postedEmployer > 0 && employerPf + employerEsi === 0) {
    employerPf = postedEmployer;
  }
  if (postedEmployer <= 0) {
    const policy = getCachedPayrollPfPolicy();
    employerPf = employerPfAmount(policy, {
      monthlyBasic,
      cycleBasic: monthlyBasic,
      factor: 1,
    });
    employerEsi = monthlyGross > 0 && monthlyGross <= 21000 ? Math.round(monthlyGross * 0.0325) : 0;
  }
  const employerContribution = employerPf + employerEsi;
  return {
    salaryDays: workingDays,
    presentDays: slip.presentDays ?? 0,
    leaveDays: slip.leaveDays ?? 0,
    unpaidLeaveDays: slip.unpaidLeaveDays == null ? null : slip.unpaidLeaveDays,
    lopDays: slip.lopDays ?? 0,
    earnings,
    deductions,
    monthlyGross,
    yearlyGross,
    lopAmount,
    monthlyDeductions,
    yearlyDeductions,
    net: Math.round(slip.net),
    employerPf,
    employerEsi,
    employerContribution,
    costToCompany: monthlyGross + employerContribution,
  };
}

/** Actual year-to-date plus the current recurring structure for months that are not posted yet. */
export function payslipProjection(figures: PayslipFigures, ctx: PayslipPdfContext): PayslipProjection {
  const recurringEarnings = figures.earnings
    .filter((row) => row.recurring)
    .reduce((sum, row) => sum + row.monthly, 0);
  const oneTimeEarnings = figures.earnings
    .filter((row) => !row.recurring)
    .reduce((sum, row) => sum + row.monthly, 0);
  const recurringDeductions = figures.deductions
    .filter((row) => row.recurring)
    .reduce((sum, row) => sum + row.monthly, 0);
  const elapsed = Math.max(1, 12 - ctx.monthsLeft);
  const covered = ctx.ytdEarnings == null ? 0 : Math.max(ctx.ytdMonths, 1);
  const unposted = Math.max(0, elapsed - covered) + ctx.monthsLeft;
  const earnings =
    ctx.ytdEarnings == null ? recurringEarnings * 12 + oneTimeEarnings : ctx.ytdEarnings + recurringEarnings * unposted;
  const deductions =
    ctx.ytdDeductions == null ? figures.yearlyDeductions : ctx.ytdDeductions + recurringDeductions * unposted;
  const nextCount = Math.min(3, ctx.monthsLeft, ctx.nextMonths.length);
  const fullMonthPay = recurringEarnings;
  const monthTds = tdsForTheMonth(fullMonthPay * 12);
  const yearTds = tdsForTheYear(fullMonthPay * 12);
  return {
    earnings,
    deductions,
    net: earnings - deductions,
    tdsYear: yearTds,
    monthTds,
    nextTds: nextCount > 0 ? monthTds * nextCount : 0,
    nextNet: nextCount > 0 ? (fullMonthPay - recurringDeductions) * nextCount : null,
  };
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
  let logoH = 0;
  if (logo) {
    logoH = Math.min(16, (logo.height / logo.width) * logoW);
    const format = logo.dataUrl.includes("image/png") ? "PNG" : "JPEG";
    doc.addImage(logo.dataUrl, format, margin, y, logoW, logoH);
  }

  const rightX = pageW - margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(dash(ctx.entityName), rightX, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  let hy = y + 8;
  const addressLines = ctx.entityAddress.length ? ctx.entityAddress.slice(0, 4) : ["—"];
  for (const line of addressLines) {
    doc.text(line, rightX, hy, { align: "right" });
    hy += 3.2;
  }
  doc.text(`PAN: ${dash(ctx.entityPan)}`, rightX, hy, { align: "right" });
  hy += 3.2;
  doc.text(`TAN: ${dash(ctx.entityTan)}`, rightX, hy, { align: "right" });
  hy += 3.2;
  y = Math.max(y + logoH + 4, hy + 2);

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
  doc.text(`For the month of ${slip.monthLabel}`, pageW / 2, y, { align: "center" });
  y += 4;

  const figures = payslipFigures(slip);
  const projection = payslipProjection(figures, ctx);
  const rows: [string, string, string, string][] = [
    ["Payslip no.", dash(slip.payslipCode), "Payment", dash(ctx.paymentStatus)],
    ["Employee", dash(slip.employeeName), "Employee code", dash(ctx.employeeCode)],
    ["Designation", dash(ctx.designation), "Department", dash(ctx.department)],
    ["Location", dash(ctx.location), "Date of joining", dash(ctx.joiningDate)],
    ["Employment type", dash(ctx.employmentType), "PAN", dash(ctx.pan)],
    ["UAN", dash(ctx.uan), "Bank account", dash(ctx.bank)],
    ["IFSC", dash(ctx.ifsc), "Late count", dash(ctx.lateCount)],
    ["Working days", String(figures.salaryDays), "Present", String(figures.presentDays)],
    ["Paid leave", String(figures.leaveDays), "Unpaid leave", figures.unpaidLeaveDays == null ? "—" : String(figures.unpaidLeaveDays)],
    ["LOP days", String(figures.lopDays), "Pay days", String(slip.payableDays ?? slip.periodDays ?? figures.salaryDays)],
  ];
  const metaRowH = 5.2;
  const metaH = rows.length * metaRowH;
  const metaLabelW = 32;
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
    doc.text(fitText(doc, v1, contentW / 2 - metaLabelW - 2.4), margin + metaLabelW + 1.4, baseline);
    doc.setFont("helvetica", "bold");
    doc.text(fitText(doc, l2, metaLabelW - 2.4), metaMid + 1.4, baseline);
    doc.setFont("helvetica", "normal");
    doc.text(fitText(doc, v2, contentW / 2 - metaLabelW - 2.4), metaMid + metaLabelW + 1.4, baseline);
  });
  gridLine(doc, margin + metaLabelW, y, margin + metaLabelW, y + metaH);
  gridLine(doc, metaMid, y, metaMid, y + metaH);
  gridLine(doc, metaMid + metaLabelW, y, metaMid + metaLabelW, y + metaH);
  strokeRect(doc, margin, y, contentW, metaH);
  y += metaH + 2;

  const dataRows = Math.max(figures.earnings.length, figures.deductions.length, 1);
  const moneyHeadH = 5.2;
  const moneyRowH = 4.8;
  const tableH = moneyHeadH + (dataRows + 1) * moneyRowH;
  const half = contentW / 2;

  function drawMoneyTable(
    x: number,
    title: string,
    lines: PayslipMoneyRow[],
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

    const body: Array<PayslipMoneyRow | null> = [...lines];
    while (body.length < dataRows) body.push(null);
    body.forEach((line, index) => {
      const top = y + moneyHeadH + index * moneyRowH;
      gridLine(doc, x, top, x + half, top);
      if (!line) return;
      const baseline = top + moneyRowH - 1.6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(fitText(doc, line.label, labelW - 2.6), x + 1.4, baseline);
      doc.text(money(line.monthly), x + labelW + moneyW - 1.3, baseline, { align: "right" });
      doc.text(money(line.yearly), x + half - 1.3, baseline, { align: "right" });
    });
    const totalTop = y + moneyHeadH + dataRows * moneyRowH;
    gridLine(doc, x, totalTop, x + half, totalTop);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const totalBase = totalTop + moneyRowH - 1.6;
    doc.text(fitText(doc, totalLabel, labelW - 2.6), x + 1.4, totalBase);
    doc.text(money(totalMonthly), x + labelW + moneyW - 1.3, totalBase, { align: "right" });
    doc.text(money(totalYearly), x + half - 1.3, totalBase, { align: "right" });
  }

  drawMoneyTable(
    margin,
    "Earnings (A)",
    figures.earnings,
    "Total earnings (A)",
    figures.monthlyGross,
    figures.yearlyGross,
  );
  drawMoneyTable(
    margin + half,
    "Deductions (B)",
    figures.deductions,
    "Total deductions (B)",
    figures.monthlyDeductions,
    figures.yearlyDeductions,
  );
  gridLine(doc, margin + half, y, margin + half, y + tableH);
  strokeRect(doc, margin, y, contentW, tableH);
  y += tableH + 2;

  const pageH = doc.internal.pageSize.getHeight();
  const ensure = (height: number) => {
    if (y + height > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const words = wrap(doc, `Amount in words: ${amountInIndianWords(figures.net)}`, contentW - 6);
  const summaryLines: Array<[string, string]> = [
    ["Net payable salary", money(figures.net)],
    ["Cost to company (monthly)", money(figures.costToCompany)],
    ["PF (employer)", money(figures.employerPf)],
    ["ESI (employer)", money(figures.employerEsi)],
    ["Employer contribution", money(figures.employerContribution)],
  ];
  const summaryRowH = 4.6;
  const wordsH = Math.max(summaryRowH, words.length * 3.6 + 2.4);
  const summaryH = wordsH + summaryLines.length * summaryRowH;
  const summaryValueX = margin + contentW - 42;
  ensure(summaryH + 2);
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
    doc.setFont("helvetica", label === "Net payable salary" ? "bold" : "normal");
    doc.text(label, margin + 1.4, baseline);
    doc.text(value, margin + contentW - 1.4, baseline, { align: "right" });
  });
  gridLine(doc, summaryValueX, y + wordsH, summaryValueX, y + summaryH);
  strokeRect(doc, margin, y, contentW, summaryH);
  y += summaryH + 2;

  const columns: Array<{ title: string; subtitle: string; rows: Array<[string, string]> }> = [
    {
      title: "Year to date",
      subtitle: ctx.yearLabel,
      rows: [
        ["Total earnings", moneyOrBlank(ctx.ytdEarnings)],
        ["Total deductions", moneyOrBlank(ctx.ytdDeductions)],
        ["Net salary paid", moneyOrBlank(ctx.ytdNet)],
        ["TDS deducted", moneyOrBlank(ctx.ytdTds)],
        ["PF (employee)", moneyOrBlank(ctx.ytdPf)],
        ["Professional tax", moneyOrBlank(ctx.ytdProfessionalTax)],
        ["LOP deduction", moneyOrBlank(ctx.ytdLop)],
      ],
    },
    {
      title: "Annual projection",
      subtitle: ctx.yearLabel,
      rows: [
        ["Projected earnings", money(projection.earnings)],
        ["Projected deductions", money(projection.deductions)],
        ["Projected net salary", money(projection.net)],
        ["Projected TDS", money(projection.tdsYear)],
        ["Balance months", String(ctx.monthsLeft)],
        ["TDS, next 3 months", money(projection.nextTds)],
        ["Net, next 3 months", projection.nextNet == null ? "—" : money(projection.nextNet)],
      ],
    },
    {
      title: "Tax summary",
      subtitle: "",
      rows: [
        ["Annual gross salary", money(projection.earnings)],
        ["Standard deduction", "—"],
        ["HRA exemption", "—"],
        ["Section 80C", "—"],
        ["Section 80D", "—"],
        ["Taxable income", "—"],
        ["Estimated annual tax", money(projection.tdsYear)],
        ["TDS deducted (YTD)", moneyOrBlank(ctx.ytdTds)],
        ["Balance TDS", money(Math.max(0, projection.tdsYear - (ctx.ytdTds ?? 0)))],
      ],
    },
  ];
  const columnHeadH = 6.4;
  const columnRowH = 4.1;
  const columnRows = Math.max(...columns.map((column) => column.rows.length));
  const columnH = columnHeadH + columnRows * columnRowH;
  ensure(columnH + 2);
  const columnW = contentW / 3;
  columns.forEach((column, index) => {
    const x = margin + index * columnW;
    const valueX = x + columnW * 0.58;
    doc.setFillColor(236, 236, 236);
    doc.rect(x, y, columnW, columnHeadH, "F");
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(fitText(doc, column.title, columnW - 3), x + 1.4, y + 2.7);
    if (column.subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.8);
      doc.setTextColor(70);
      doc.text(fitText(doc, column.subtitle, columnW - 3), x + 1.4, y + columnHeadH - 1.3);
      doc.setTextColor(0);
    }
    gridLine(doc, x, y + columnHeadH, x + columnW, y + columnHeadH);
    for (let rowIndex = 0; rowIndex < columnRows; rowIndex += 1) {
      const top = y + columnHeadH + rowIndex * columnRowH;
      if (rowIndex > 0) gridLine(doc, x, top, x + columnW, top);
      const row = column.rows[rowIndex];
      if (!row) continue;
      const baseline = top + columnRowH - 1.35;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.text(fitText(doc, row[0], columnW * 0.58 - 2.2), x + 1.2, baseline);
      doc.text(fitText(doc, row[1], columnW * 0.42 - 2.2), x + columnW - 1.2, baseline, { align: "right" });
    }
    gridLine(doc, valueX, y + columnHeadH, valueX, y + columnH);
    if (index > 0) gridLine(doc, x, y, x, y + columnH);
  });
  strokeRect(doc, margin, y, contentW, columnH);
  y += columnH + 2;

  const nextRows = ctx.nextMonths;
  const nextHeadH = 5.2;
  const nextRowH = 4.4;
  const nextBody = Math.max(nextRows.length, 1) + 1;
  const nextH = nextHeadH + nextBody * nextRowH;
  const nextValueX = margin + contentW - 42;
  ensure(nextH + 2);
  doc.setFillColor(236, 236, 236);
  doc.rect(margin, y, contentW, nextHeadH, "F");
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Next months TDS", margin + 1.4, y + nextHeadH - 1.6);
  doc.text("Amount", margin + contentW - 1.4, y + nextHeadH - 1.6, { align: "right" });
  gridLine(doc, margin, y + nextHeadH, margin + contentW, y + nextHeadH);
  gridLine(doc, nextValueX, y, nextValueX, y + nextH);
  if (!nextRows.length) {
    doc.setFont("helvetica", "normal");
    doc.text("—", margin + 1.4, y + nextHeadH + nextRowH - 1.5);
    gridLine(doc, margin, y + nextHeadH + nextRowH, margin + contentW, y + nextHeadH + nextRowH);
  } else {
    nextRows.forEach((key, index) => {
      const top = y + nextHeadH + index * nextRowH;
      if (index > 0) gridLine(doc, margin, top, margin + contentW, top);
      const baseline = top + nextRowH - 1.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(monthName(key), margin + 1.4, baseline);
      doc.text(money(projection.monthTds), margin + contentW - 1.4, baseline, { align: "right" });
    });
  }
  const totalTop = y + nextHeadH + Math.max(nextRows.length, 1) * nextRowH;
  gridLine(doc, margin, totalTop, margin + contentW, totalTop);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Total", margin + 1.4, totalTop + nextRowH - 1.5);
  doc.text(
    money(projection.monthTds * Math.max(nextRows.length, 0)),
    margin + contentW - 1.4,
    totalTop + nextRowH - 1.5,
    { align: "right" },
  );
  strokeRect(doc, margin, y, contentW, nextH);
  y += nextH + 3;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90);
  const notes = [
    "This is a system generated payslip and does not require a signature.",
    "Salary is processed based on attendance and company policies.",
    "Tax calculations are shown only when a tax amount is stored. Declarations such as Section 80C are not estimated.",
    "For any discrepancies, contact HR within 7 days.",
  ];
  for (const note of notes) {
    ensure(4);
    doc.text(note, margin, y);
    y += 3.1;
  }
  doc.setTextColor(0);
}

export function createPayslipPdf(slip: PayslipRecord, ctx: PayslipPdfContext): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = ctx.logoUrl ? { dataUrl: ctx.logoUrl, width: 320, height: 120 } : null;
  drawSlipPage(doc, slip, ctx, logo);
  return doc;
}

export async function downloadPayslipPdf(
  slip: PayslipRecord,
  ctx: PayslipPdfContext,
  fileName?: string,
): Promise<void> {
  const doc = createPayslipPdf(slip, ctx);
  doc.save(fileName || `${slip.payslipCode || "salary-slip"}.pdf`);
}

export async function downloadPayslipsPdf(
  rows: Array<{ slip: PayslipRecord; ctx: PayslipPdfContext }>,
  fileName: string,
): Promise<void> {
  if (!rows.length) return;
  const doc = createPayslipPdf(rows[0].slip, rows[0].ctx);
  rows.slice(1).forEach((row) => {
    doc.addPage();
    const logo = row.ctx.logoUrl ? { dataUrl: row.ctx.logoUrl, width: 320, height: 120 } : null;
    drawSlipPage(doc, row.slip, row.ctx, logo);
  });
  doc.save(fileName);
}
