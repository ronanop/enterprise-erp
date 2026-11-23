import { describe, expect, it } from "vitest";

import {
  guessSalaryAssignColumnMapping,
  parseSalaryAssignImportWithMapping,
} from "@/lib/salary-assign-import";
import { computeCtcSplit, amountsFromSplit, EXCEL_DEFAULTS } from "@/lib/salary-structure-excel";

describe("salary-assign-import", () => {
  it("maps common headers and parses rows", () => {
    const matrix = [
      ["Employee Code", "Monthly CTC", "Employer Contribution"],
      ["CT5354", "200000", "3000"],
      ["ct1001", "36,000", "1,800"],
    ];
    const headers = matrix[0];
    const mapping = guessSalaryAssignColumnMapping(headers);
    expect(mapping).toEqual([
      "employee_code",
      "monthly_ctc",
      "employer_contribution",
    ]);
    const { rows, errors } = parseSalaryAssignImportWithMapping(matrix, 0, mapping);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      employeeCode: "CT5354",
      monthlyCtc: 200000,
      employerContribution: 3000,
    });
    expect(rows[1].employeeCode).toBe("CT1001");
    expect(rows[1].monthlyCtc).toBe(36000);
  });

  it("keeps Excel employer contribution 3000 and 0 (not default 1800)", () => {
    for (const er of [3000, 0]) {
      const split = computeCtcSplit({
        grossCtc: 200000,
        basicPercent: EXCEL_DEFAULTS.basicPercent,
        hraPercentOfBasic: EXCEL_DEFAULTS.hraPercentOfBasic,
        telephoneAllowance: 0,
        employerContribution: er,
      });
      const amounts = amountsFromSplit(split);
      expect(amounts.employerContribution).toBe(er);
      expect(amounts.employerContribution).not.toBe(1800);
      expect(split.specialAllowance).toBe(200000 - 120000 - 60000 - er);
    }
  });

  it("parses the Digitech assign sheet headers", () => {
    const matrix = [
      ["employee_code", "monthly_ctc", "employer_contribution"],
      ["CDPL5379", "200000", "3000"],
      ["CDPL0204", "35000", "0"],
    ];
    const mapping = guessSalaryAssignColumnMapping(matrix[0]);
    const { rows } = parseSalaryAssignImportWithMapping(matrix, 0, mapping);
    expect(rows[0].employerContribution).toBe(3000);
    expect(rows[1].employerContribution).toBe(0);
  });
});
