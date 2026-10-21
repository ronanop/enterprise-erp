import { describe, expect, it } from "vitest";

import type { PayslipRecord } from "@/types/payroll-management";
import {
  createPayslipPdf,
  payslipFigures,
  payslipPdfContext,
  payslipProjection,
  type PayslipPdfContext,
} from "@/utils/payslip-pdf";

function slip(overrides: Partial<PayslipRecord> = {}): PayslipRecord {
  return {
    id: "slip-1",
    payslipCode: "PSL-1",
    runId: "run-1",
    employeeId: "emp-1",
    employeeName: "Asha Rao",
    month: "2025-12",
    monthLabel: "December 2025",
    department: "Engineering",
    bankAccount: "",
    presentDays: 21,
    leaveDays: 1,
    unpaidLeaveDays: 0,
    scheduledWorkingDays: 22,
    payableDays: 30,
    periodDays: 30,
    lopDays: 0,
    earnings: [
      { label: "Basic", amount: 30000 },
      { label: "HRA", amount: 15000 },
      { label: "Special Allowance", amount: 20000 },
      { label: "Bonus", amount: 5000 },
    ],
    deductions: [
      { label: "Employee PF", amount: 3600 },
      { label: "Employer PF", amount: 3600 },
      { label: "Professional Tax", amount: 200 },
    ],
    gross: 70000,
    totalDeductions: 3800,
    net: 66200,
    taxRegime: "new",
    generatedAt: "2025-12-31T00:00:00.000Z",
    ...overrides,
  };
}

function context(overrides: Partial<PayslipPdfContext> = {}): PayslipPdfContext {
  return {
    employeeCode: "E1",
    department: "Engineering",
    designation: "Engineer",
    location: "Pune",
    joiningDate: "01 Apr 2024",
    employmentType: "Permanent",
    pan: "ABCDE1234F",
    uan: "100",
    bank: "******1234",
    ifsc: "HDFC0001",
    lateCount: "",
    paymentStatus: "Paid",
    entityName: "Cache Digitech",
    entityAddress: [],
    entityPan: "",
    entityTan: "",
    logoUrl: "",
    yearLabel: "April 2025 – March 2026",
    ytdEarnings: 70000,
    ytdDeductions: 3800,
    ytdNet: 66200,
    ytdTds: null,
    ytdPf: 3600,
    ytdProfessionalTax: 200,
    ytdLop: null,
    ytdMonths: 9,
    monthsLeft: 3,
    nextMonths: ["2026-01", "2026-02", "2026-03"],
    ...overrides,
  };
}

describe("payslip company letterhead", () => {
  it("prints the company address, PAN, and TAN when the employee is not linked to a company", () => {
    const ctx = payslipPdfContext(slip(), [], [], [
      {
        id: "co-1",
        legalName: "Cache Digitech Pvt Ltd",
        companyName: "Cache Digitech",
        pan: "ABCDE1234F",
        tan: "PNEA12345B",
        logoUrl: "",
        addressLines: ["221B Baker Street", "Pune, Maharashtra, 411001"],
        fiscalStartMonth: 4,
      },
    ]);
    expect(ctx.entityName).toBe("Cache Digitech Pvt Ltd");
    expect(ctx.entityAddress).toEqual(["221B Baker Street", "Pune, Maharashtra, 411001"]);
    expect(ctx.entityPan).toBe("ABCDE1234F");
    expect(ctx.entityTan).toBe("PNEA12345B");
  });
});

describe("payslipFigures", () => {
  it("annualizes recurring lines and keeps bonus as a one-time amount", () => {
    const figures = payslipFigures(slip());
    const basic = figures.earnings.find((row) => row.label === "Basic");
    const bonus = figures.earnings.find((row) => row.label === "Bonus");
    expect(figures.salaryDays).toBe(22);
    expect(basic?.yearly).toBe(360000);
    expect(bonus?.yearly).toBe(5000);
    expect(figures.yearlyGross).toBe(65000 * 12 + 5000);
    expect(figures.deductions.map((row) => row.label)).toEqual(["Employee PF", "Professional Tax"]);
    expect(figures.employerPf).toBe(3600);
    expect(figures.employerEsi).toBe(0);
    expect(figures.employerContribution).toBe(3600);
    expect(figures.costToCompany).toBe(70000 + 3600);
    expect(figures.net).toBe(66200);
    expect(figures.lopAmount).toBe(0);
  });

  it("hides bonus when the salary split already equals gross", () => {
    const figures = payslipFigures(
      slip({
        earnings: [
          { label: "Basic", amount: 30000 },
          { label: "HRA", amount: 15000 },
          { label: "Special Allowance", amount: 20000 },
          { label: "Bonus", amount: 5000 },
        ],
        gross: 65000,
        totalDeductions: 3600,
        net: 61400,
        deductions: [{ label: "Employee PF", amount: 3600 }],
      }),
    );
    expect(figures.earnings.map((row) => row.label)).toEqual(["Basic", "HRA", "Special Allowance"]);
    expect(figures.monthlyGross).toBe(65000);
  });

  it("restores a full month and shows loss of pay once", () => {
    const factor = 29 / 30;
    const figures = payslipFigures(
      slip({
        payableDays: 29,
        lopDays: 1,
        earnings: [
          { label: "Basic", amount: 30000 * factor },
          { label: "HRA", amount: 15000 * factor },
          { label: "Special Allowance", amount: 20000 * factor },
        ],
        deductions: [{ label: "Employee PF", amount: 3600 }],
        gross: 65000 * factor,
        totalDeductions: 3600,
        net: 65000 * factor - 3600,
      }),
    );
    expect(figures.monthlyGross).toBe(65000);
    expect(figures.lopAmount).toBe(65000 - Math.round(65000 * factor));
    const lop = figures.deductions.find((row) => /leave without pay/i.test(row.label));
    expect(lop?.yearly).toBe(lop?.monthly);
    expect(figures.yearlyDeductions).toBe(3600 * 12 + (lop?.monthly ?? 0));
  });
});

describe("payslip pdf", () => {
  it("keeps one payslip on a single page without the breakup charts", () => {
    const doc = createPayslipPdf(
      slip({
        earnings: [
          { label: "Basic", amount: 30000 },
          { label: "HRA", amount: 15000 },
          { label: "Special Allowance", amount: 5000 },
          { label: "Conveyance", amount: 3200 },
          { label: "Medical", amount: 1250 },
        ],
        deductions: [
          { label: "Employee PF", amount: 3600 },
          { label: "Professional Tax", amount: 200 },
          { label: "Leave without pay (4 days)", amount: 7500 },
        ],
        gross: 54450,
        totalDeductions: 11300,
        net: 43150,
        lopDays: 4,
        payableDays: 26,
      }),
      context({
        entityAddress: ["Line 1", "Line 2", "Pune, Maharashtra, 411001"],
        entityPan: "ABCDE1234F",
        entityTan: "PNEA12345B",
        nextMonths: ["2026-01", "2026-02", "2026-03"],
      }),
    );
    expect(doc.getNumberOfPages()).toBe(1);
  });
});

describe("payslipProjection", () => {
  it("adds the recurring structure for the months that are not posted", () => {
    const figures = payslipFigures(slip());
    const projection = payslipProjection(figures, context());
    expect(projection.earnings).toBe(70000 + 65000 * 3);
    expect(projection.deductions).toBe(3800 + 3800 * 3);
    expect(projection.net).toBe(projection.earnings - projection.deductions);
    expect(projection.monthTds).toBe(0);
    expect(projection.nextTds).toBe(0);
    expect(projection.nextNet).toBe((65000 - 3800) * 3);
  });

  it("fills employer PF and ESI from the 30-day salary when the slip omitted them", () => {
    const figures = payslipFigures(
      slip({
        earnings: [
          { label: "Basic", amount: 16920 },
          { label: "HRA", amount: 8460 },
          { label: "Special Allowance", amount: 2820 },
        ],
        deductions: [{ label: "Employee PF", amount: 1800 }],
        gross: 28200,
        totalDeductions: 1800,
        net: 26400,
      }),
    );
    expect(figures.employerPf).toBe(1900);
    expect(figures.employerEsi).toBe(0);
    expect(figures.costToCompany).toBe(28200 + 1900);
  });

  it("fills missing earlier months from the recurring structure", () => {
    const figures = payslipFigures(slip());
    const projection = payslipProjection(figures, context({ ytdMonths: 1, monthsLeft: 3 }));
    expect(projection.earnings).toBe(70000 + 65000 * 11);
  });
});
