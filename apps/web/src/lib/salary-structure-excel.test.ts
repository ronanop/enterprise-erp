import { describe, expect, it } from "vitest";

import {
  amountsFromSplit,
  computeCtcSplit,
  computePayablePreview,
  employeePfFromWage,
  EXCEL_DEFAULTS,
} from "@/lib/salary-structure-excel";

describe("salary-structure-excel mapped formulas", () => {
  it("splits 18000 CTC like Excel H–N", () => {
    const split = computeCtcSplit({
      grossCtc: 18000,
      basicPercent: 0.6,
      hraPercentOfBasic: 0.5,
      telephoneAllowance: 0,
      employerContribution: 1800,
    });
    expect(split.basic).toBe(10800);
    expect(split.hra).toBe(5400);
    expect(split.specialAllowance).toBe(0);
    expect(split.employeeGross).toBe(16200);
    expect(split.ctc).toBe(18000);
    expect(split.valid).toBe(true);
  });

  it("prorates special as K×Q/O under LOP (not broken Excel T)", () => {
    const split = computeCtcSplit({
      grossCtc: 30000,
      basicPercent: 0.6,
      hraPercentOfBasic: 0.5,
      telephoneAllowance: 0,
      employerContribution: 0,
    });
    const month = computePayablePreview(split, {
      ...EXCEL_DEFAULTS,
      payableDays: 29,
      edliAdminAmount: 0,
    });
    expect(month.payableBasic).toBe(17400);
    expect(month.payableHra).toBe(8700);
    expect(month.payableSpecial).toBe(2900);
    expect(month.gross).toBe(29000);
  });

  it("computes PF as MIN(wage, 25000)×12%", () => {
    expect(employeePfFromWage(10800)).toBe(1296);
    expect(employeePfFromWage(21000)).toBe(2520);
    expect(employeePfFromWage(30000)).toBe(3000);
  });

  it("keeps EDLI out of employee deductions", () => {
    const split = computeCtcSplit({
      grossCtc: 18000,
      basicPercent: 0.6,
      hraPercentOfBasic: 0.5,
      telephoneAllowance: 0,
      employerContribution: 1800,
    });
    const month = computePayablePreview(split, {
      ...EXCEL_DEFAULTS,
      edliAdminAmount: 100,
    });
    expect(month.pf).toBe(1296);
    expect(month.edli).toBe(100);
    expect(month.totalDed).toBe(month.pf + month.esi + month.tdsMonth);
    expect(month.totalDed).not.toBe(month.pf + month.edli + month.esi + month.tdsMonth);
    expect(month.net).toBe(month.gross - month.totalDed);
    expect(month.annualSalary).toBe(18000 * 12);
  });

  it("matches Excel row for Gross CTC 200000", () => {
    const split = computeCtcSplit({
      grossCtc: 200000,
      basicPercent: 0.6,
      hraPercentOfBasic: 0.5,
      telephoneAllowance: 0,
      employerContribution: 3000,
    });
    expect(split.basic).toBe(120000);
    expect(split.hra).toBe(60000);
    expect(split.specialAllowance).toBe(17000);
    expect(split.ctc).toBe(200000);

    const month = computePayablePreview(split, {
      ...EXCEL_DEFAULTS,
      edliAdminAmount: 0,
      payableDays: 30,
    });
    expect(month.gross).toBe(197000);
    expect(month.pfWage).toBe(137000);
    expect(month.pf).toBe(3000);
    expect(month.esi).toBe(0);
    expect(month.annualSalary).toBe(2400000);
    expect(month.tdsYear).toBe(292500);
    expect(month.tdsMonth).toBe(24375);
    expect(month.totalDed).toBe(27375);
    expect(month.net).toBe(169625);
  });

  it("stores employee PF not employer contribution on structure amounts", () => {
    const split = computeCtcSplit({
      grossCtc: 18000,
      basicPercent: 0.6,
      hraPercentOfBasic: 0.5,
      telephoneAllowance: 0,
      employerContribution: 1800,
    });
    const amounts = amountsFromSplit(split);
    expect(amounts.employerContribution).toBe(1800);
    expect(amounts.pf).toBe(1296);
    expect(amounts.pf).not.toBe(1800);
  });
});
