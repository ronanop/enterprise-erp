/** Column mapping helpers for leave-balance Excel/CSV import. */

export type LeaveBalanceImportFieldKey =
  | ""
  | "employee_code"
  | "leave_type_code"
  | "balance_year"
  | "remaining"
  | "opening_balance"
  | "accrued"
  | "used";

export const LEAVE_BALANCE_IMPORT_FIELD_OPTIONS: { value: LeaveBalanceImportFieldKey; label: string }[] = [
  { value: "", label: "— Ignore —" },
  { value: "employee_code", label: "Employee code" },
  { value: "leave_type_code", label: "Leave type code (SL / CL / …)" },
  { value: "balance_year", label: "Balance year (optional)" },
  { value: "remaining", label: "Leaves left / remaining" },
  { value: "opening_balance", label: "Opening balance" },
  { value: "accrued", label: "Accrued (optional)" },
  { value: "used", label: "Used (optional)" },
];

export type NormalizedLeaveBalanceImportRow = {
  employee_code: string;
  leave_type_code: string;
  balance_year?: number | null;
  remaining?: number | null;
  opening_balance?: number | null;
  accrued?: number | null;
  used?: number | null;
};

export const LEAVE_BALANCE_IMPORT_SAMPLE_CSV = [
  "employee_code,leave_type_code,remaining,used,balance_year",
  "CDPL0001,SL,6,0,2026",
  "CDPL0001,CL,8,2,2026",
  "CT0002,SL,4,,2026",
].join("\n");

function normHeader(h: string): string {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-/]+/g, "");
}

const HEADER_ALIASES: Record<string, LeaveBalanceImportFieldKey> = {
  employeecode: "employee_code",
  empcode: "employee_code",
  empno: "employee_code",
  employeeno: "employee_code",
  code: "employee_code",
  leavetypecode: "leave_type_code",
  leavetype: "leave_type_code",
  leavecode: "leave_type_code",
  typecode: "leave_type_code",
  type: "leave_type_code",
  balanceyear: "balance_year",
  year: "balance_year",
  leaveyear: "balance_year",
  remaining: "remaining",
  leavesleft: "remaining",
  leaveleft: "remaining",
  balanceleft: "remaining",
  balance: "remaining",
  closingbalance: "remaining",
  available: "remaining",
  openingbalance: "opening_balance",
  opening: "opening_balance",
  accrued: "accrued",
  used: "used",
  availed: "used",
};

export function extractLeaveBalanceImportHeaders(matrix: string[][]): {
  headerIdx: number;
  headers: string[];
  displayHeaders: string[];
} {
  for (let i = 0; i < Math.min(matrix.length, 30); i += 1) {
    const row = matrix[i] ?? [];
    const joined = row.map((c) => normHeader(String(c))).join("|");
    if (
      joined.includes("employeecode") ||
      joined.includes("empcode") ||
      (joined.includes("code") && joined.includes("leave"))
    ) {
      const headers = row.map((c) => String(c ?? "").trim());
      return { headerIdx: i, headers, displayHeaders: headers };
    }
  }
  if (matrix.length > 0) {
    const headers = (matrix[0] ?? []).map((c) => String(c ?? "").trim());
    return { headerIdx: 0, headers, displayHeaders: headers };
  }
  return { headerIdx: -1, headers: [], displayHeaders: [] };
}

export function guessLeaveBalanceColumnMapping(headers: string[]): LeaveBalanceImportFieldKey[] {
  const used = new Set<LeaveBalanceImportFieldKey>();
  return headers.map((h) => {
    const key = HEADER_ALIASES[normHeader(h)] ?? "";
    if (!key || used.has(key)) return "";
    used.add(key);
    return key;
  });
}

function parseNumber(raw: string): number | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function parseLeaveBalanceImportWithMapping(
  matrix: string[][],
  headerIdx: number,
  mapping: LeaveBalanceImportFieldKey[],
): { rows: NormalizedLeaveBalanceImportRow[]; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows: NormalizedLeaveBalanceImportRow[] = [];

  if (headerIdx < 0) {
    return { rows: [], errors: ["Could not find header row."], warnings: [] };
  }
  if (!mapping.includes("employee_code")) {
    errors.push("Map a column to Employee code.");
  }
  if (!mapping.includes("leave_type_code")) {
    errors.push("Map a column to Leave type code.");
  }
  if (!mapping.includes("remaining") && !mapping.includes("opening_balance")) {
    errors.push("Map Leaves left / remaining or Opening balance.");
  }
  if (errors.length) return { rows: [], errors, warnings };

  for (let r = headerIdx + 1; r < matrix.length; r += 1) {
    const line = matrix[r] ?? [];
    const get = (field: LeaveBalanceImportFieldKey): string => {
      const idx = mapping.indexOf(field);
      if (idx < 0) return "";
      return String(line[idx] ?? "").trim();
    };
    const employee_code = get("employee_code").toUpperCase();
    const leave_type_code = get("leave_type_code").toUpperCase();
    if (!employee_code && !leave_type_code) continue;
    if (!employee_code || !leave_type_code) {
      errors.push(`Row ${r + 1}: employee_code and leave_type_code required`);
      continue;
    }
    const yearRaw = get("balance_year");
    const balance_year = yearRaw ? Number.parseInt(yearRaw, 10) : null;
    if (yearRaw && !Number.isFinite(balance_year)) {
      errors.push(`Row ${r + 1}: invalid balance_year`);
      continue;
    }
    rows.push({
      employee_code,
      leave_type_code,
      balance_year: Number.isFinite(balance_year as number) ? balance_year : null,
      remaining: parseNumber(get("remaining")),
      opening_balance: parseNumber(get("opening_balance")),
      accrued: parseNumber(get("accrued")),
      used: parseNumber(get("used")),
    });
  }

  if (!rows.length && !errors.length) {
    warnings.push("No data rows found under the header.");
  }
  return { rows, errors, warnings };
}
