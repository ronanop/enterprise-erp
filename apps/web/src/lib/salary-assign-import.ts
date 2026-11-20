/** Parse Excel/CSV rows for bulk assign-salary (employee code + monthly CTC + employer PF). */

export type SalaryAssignImportFieldKey =
  | ""
  | "employee_code"
  | "monthly_ctc"
  | "employer_contribution"
  | "employee_name"
  | "effective_date";

export type NormalizedSalaryAssignRow = {
  employeeCode: string;
  monthlyCtc: number;
  employerContribution: number;
  employeeName?: string;
  effectiveDate?: string;
  rowNumber: number;
};

export const SALARY_ASSIGN_IMPORT_SAMPLE_CSV = [
  "employee_code,monthly_ctc,employer_contribution",
  "CT5354,200000,3000",
  "CT1001,36000,1800",
].join("\n");

export const SALARY_ASSIGN_IMPORT_FIELD_OPTIONS: {
  value: SalaryAssignImportFieldKey;
  label: string;
}[] = [
  { value: "", label: "— Ignore —" },
  { value: "employee_code", label: "Employee code" },
  { value: "monthly_ctc", label: "Monthly CTC" },
  { value: "employer_contribution", label: "Employer contribution" },
  { value: "employee_name", label: "Employee name (optional)" },
  { value: "effective_date", label: "Effective date (optional)" },
];

function normHeader(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s./\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

const HEADER_ALIASES: Record<string, SalaryAssignImportFieldKey> = {
  employee_code: "employee_code",
  emp_code: "employee_code",
  employeecode: "employee_code",
  code: "employee_code",
  new_employee_id: "employee_code",
  employee_id: "employee_code",
  monthly_ctc: "monthly_ctc",
  monthlyctc: "monthly_ctc",
  ctc: "monthly_ctc",
  gross_ctc: "monthly_ctc",
  gross_ctc_monthly: "monthly_ctc",
  monthly_gross_ctc: "monthly_ctc",
  salary: "monthly_ctc",
  employer_contribution: "employer_contribution",
  employer_pf: "employer_contribution",
  employercontribution: "employer_contribution",
  er_pf: "employer_contribution",
  employer: "employer_contribution",
  employee_name: "employee_name",
  name: "employee_name",
  effective_date: "effective_date",
  effective_from: "effective_date",
};

export function guessSalaryAssignColumnMapping(headers: string[]): SalaryAssignImportFieldKey[] {
  const used = new Set<SalaryAssignImportFieldKey>();
  return headers.map((h) => {
    const key = HEADER_ALIASES[normHeader(h)];
    if (!key || used.has(key)) return "";
    used.add(key);
    return key;
  });
}

export function extractSalaryAssignImportHeaders(matrix: string[][]): {
  headerIdx: number;
  headers: string[];
  displayHeaders: string[];
} {
  for (let i = 0; i < Math.min(matrix.length, 30); i += 1) {
    const row = matrix[i] ?? [];
    const headers = row.map((c) => String(c ?? "").trim());
    const mapped = guessSalaryAssignColumnMapping(headers);
    if (mapped.includes("employee_code") && mapped.includes("monthly_ctc")) {
      return { headerIdx: i, headers, displayHeaders: headers };
    }
  }
  const headers = (matrix[0] ?? []).map((c) => String(c ?? "").trim());
  return { headerIdx: matrix.length ? 0 : -1, headers, displayHeaders: headers };
}

function parseMoney(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  const s = String(raw ?? "")
    .replace(/[,₹rs.\s]/gi, "")
    .replace(/inr/gi, "")
    .trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

export function parseSalaryAssignImportWithMapping(
  matrix: string[][],
  headerIdx: number,
  mapping: SalaryAssignImportFieldKey[],
): { rows: NormalizedSalaryAssignRow[]; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows: NormalizedSalaryAssignRow[] = [];

  if (headerIdx < 0) {
    return { rows, errors: ["Could not find header row."], warnings };
  }
  const codeIdx = mapping.indexOf("employee_code");
  const ctcIdx = mapping.indexOf("monthly_ctc");
  if (codeIdx < 0 || ctcIdx < 0) {
    return {
      rows,
      errors: ["Map columns for Employee code and Monthly CTC."],
      warnings,
    };
  }
  const erIdx = mapping.indexOf("employer_contribution");
  const nameIdx = mapping.indexOf("employee_name");
  const dateIdx = mapping.indexOf("effective_date");
  const seen = new Set<string>();

  for (let r = headerIdx + 1; r < matrix.length; r += 1) {
    const line = matrix[r] ?? [];
    const empty = line.every((c) => !String(c ?? "").trim());
    if (empty) continue;
    const employeeCode = String(line[codeIdx] ?? "").trim().toUpperCase();
    const monthlyCtc = parseMoney(line[ctcIdx]);
    const employerContribution =
      erIdx >= 0 ? parseMoney(line[erIdx]) : 0;
    const employeeName =
      nameIdx >= 0 ? String(line[nameIdx] ?? "").trim() : undefined;
    const effectiveDate =
      dateIdx >= 0 ? String(line[dateIdx] ?? "").trim() : undefined;
    const rowNumber = r + 1;

    if (!employeeCode) {
      errors.push(`Row ${rowNumber}: missing employee code`);
      continue;
    }
    if (!Number.isFinite(monthlyCtc) || monthlyCtc <= 0) {
      errors.push(`Row ${rowNumber} (${employeeCode}): monthly CTC must be > 0`);
      continue;
    }
    if (!Number.isFinite(employerContribution) || employerContribution < 0) {
      errors.push(`Row ${rowNumber} (${employeeCode}): employer contribution invalid`);
      continue;
    }
    if (seen.has(employeeCode)) {
      warnings.push(`Row ${rowNumber}: duplicate ${employeeCode} — last row wins`);
    }
    seen.add(employeeCode);
    rows.push({
      employeeCode,
      monthlyCtc,
      employerContribution: employerContribution || 0,
      employeeName: employeeName || undefined,
      effectiveDate: effectiveDate || undefined,
      rowNumber,
    });
  }

  // Keep last occurrence per code
  const byCode = new Map<string, NormalizedSalaryAssignRow>();
  for (const row of rows) byCode.set(row.employeeCode, row);
  return { rows: [...byCode.values()], errors, warnings };
}
