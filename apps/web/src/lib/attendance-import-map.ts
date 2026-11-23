/** Column mapping helpers for biometric / machine attendance Excel-CSV import. */

import type { AttendanceStatusCode } from "@/types/attendance-management";

export type AttendanceImportFieldKey =
  | ""
  | "employee_code"
  | "attendance_date"
  | "check_in"
  | "check_out"
  | "status"
  | "source";

export const ATTENDANCE_IMPORT_FIELD_OPTIONS: {
  value: AttendanceImportFieldKey;
  label: string;
}[] = [
  { value: "", label: "— Ignore —" },
  { value: "employee_code", label: "Machine / employee code (Code)" },
  { value: "attendance_date", label: "Date" },
  { value: "check_in", label: "First In / check-in" },
  { value: "check_out", label: "Last Out / check-out" },
  { value: "status", label: "Status / Attd" },
  { value: "source", label: "Source (optional)" },
];

export type NormalizedAttendanceImportRow = {
  employee_code: string;
  attendance_date: string;
  check_in: string;
  check_out: string;
  status: AttendanceStatusCode;
  source: string;
};

export const ATTENDANCE_IMPORT_SAMPLE_CSV = [
  "Code,Date,First In,Last Out,Status",
  "CDPL5356,2026-08-01,10:05,18:30,Present",
  "CDPL5356,2026-08-02,0:00,0:00,WO",
  "EMP-0001,2026-08-01,09:12,18:05,P",
].join("\n");

function normHeader(h: string): string {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-/]+/g, "");
}

const HEADER_ALIASES: Record<string, AttendanceImportFieldKey> = {
  employeecode: "employee_code",
  empcode: "employee_code",
  empno: "employee_code",
  employeeno: "employee_code",
  employeenumber: "employee_code",
  machinecode: "employee_code",
  machineemployeecode: "employee_code",
  biometriccode: "employee_code",
  biometrid: "employee_code",
  userid: "employee_code",
  code: "employee_code",
  attendancedate: "attendance_date",
  date: "attendance_date",
  attdate: "attendance_date",
  punchdate: "attendance_date",
  checkin: "check_in",
  firstin: "check_in",
  firstintime: "check_in",
  intime: "check_in",
  punchin: "check_in",
  checkout: "check_out",
  lastout: "check_out",
  lastouttime: "check_out",
  outtime: "check_out",
  punchout: "check_out",
  // Combined machine column "Intime - OutTime" → treated as First In when Last Out also mapped separately;
  // parser also splits "HH:mm - HH:mm" when only this column is mapped to check_in.
  intimeouttime: "check_in",
  intimeout: "check_in",
  status: "status",
  attendancestatus: "status",
  attd: "status",
  daydesc: "status",
  source: "source",
};

/** Pad every row to the widest row so trailing Excel columns are not dropped. */
export function padAttendanceMatrix(matrix: string[][]): string[][] {
  const width = matrix.reduce((w, row) => Math.max(w, row?.length ?? 0), 0);
  if (width === 0) return matrix;
  return matrix.map((row) => {
    const cells = (row ?? []).map((c) => String(c ?? "").trim());
    if (cells.length >= width) return cells;
    return [...cells, ...Array.from({ length: width - cells.length }, () => "")];
  });
}

function filledCount(row: string[]): number {
  return row.reduce((n, c) => (String(c ?? "").trim() ? n + 1 : n), 0);
}

function rowLooksLikeHeader(row: string[]): boolean {
  const normalized = row.map((c) => normHeader(String(c)));
  const hasCode =
    normalized.includes("code") ||
    normalized.includes("employeecode") ||
    normalized.includes("empcode") ||
    normalized.includes("machinecode");
  const hasDate =
    normalized.includes("date") ||
    normalized.includes("attendancedate");
  const hasPunch =
    normalized.includes("firstin") ||
    normalized.includes("lastout") ||
    normalized.includes("checkin") ||
    normalized.includes("checkout") ||
    normalized.includes("intimeouttime") ||
    normalized.includes("status");
  return hasCode && (hasDate || hasPunch);
}

export function extractAttendanceImportHeaders(matrix: string[][]): {
  headerIdx: number;
  headers: string[];
  displayHeaders: string[];
} {
  const padded = padAttendanceMatrix(matrix);
  const width = padded[0]?.length ?? 0;

  // Prefer the widest header-like row (machine files sometimes have a short title row
  // that also contains "Code" / "Date" before the real column header row).
  let bestIdx = -1;
  let bestFilled = -1;
  for (let i = 0; i < Math.min(padded.length, 50); i += 1) {
    const row = padded[i] ?? [];
    if (!rowLooksLikeHeader(row)) continue;
    const filled = filledCount(row);
    if (filled > bestFilled) {
      bestFilled = filled;
      bestIdx = i;
    }
  }

  if (bestIdx >= 0) {
    const headers = (padded[bestIdx] ?? []).map((c, idx) => {
      const label = String(c ?? "").trim();
      return label || `Column ${idx + 1}`;
    });
    return { headerIdx: bestIdx, headers, displayHeaders: headers };
  }

  if (padded.length > 0) {
    const headers = (padded[0] ?? []).map((c, idx) => {
      const label = String(c ?? "").trim();
      return label || `Column ${idx + 1}`;
    });
    // If row 0 is sparse but a later row is wider with labels, merge labels into blanks.
    for (let i = 1; i < Math.min(padded.length, 5); i += 1) {
      const row = padded[i] ?? [];
      if (filledCount(row) <= filledCount(padded[0] ?? [])) continue;
      for (let c = 0; c < width; c += 1) {
        if (headers[c]?.startsWith("Column ") && String(row[c] ?? "").trim()) {
          headers[c] = String(row[c]).trim();
        }
      }
    }
    return { headerIdx: 0, headers, displayHeaders: headers };
  }
  return { headerIdx: -1, headers: [], displayHeaders: [] };
}

export function guessAttendanceColumnMapping(headers: string[]): AttendanceImportFieldKey[] {
  const used = new Set<AttendanceImportFieldKey>();
  const preferred: Record<string, AttendanceImportFieldKey> = {
    code: "employee_code",
    employeecode: "employee_code",
    date: "attendance_date",
    attendancedate: "attendance_date",
    firstin: "check_in",
    checkin: "check_in",
    intime: "check_in",
    lastout: "check_out",
    checkout: "check_out",
    outtime: "check_out",
    status: "status",
  };
  // Pass 1: preferred machine headers (Code / Date / First In / Last Out / Status)
  const result: AttendanceImportFieldKey[] = headers.map((h) => {
    const n = normHeader(h);
    const key = preferred[n] ?? "";
    if (!key || used.has(key)) return "";
    used.add(key);
    return key;
  });
  // Pass 2: remaining aliases
  return result.map((cur, i) => {
    if (cur) return cur;
    const key = HEADER_ALIASES[normHeader(headers[i] ?? "")] ?? "";
    if (!key || used.has(key)) return "";
    used.add(key);
    return key;
  });
}

/** Prefer Indian D/M/YYYY when ambiguous; accept ISO and Excel-normalized dates. */
export function normalizeAttendanceDate(raw: string): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;

  const slash = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (slash) {
    let a = Number(slash[1]);
    let b = Number(slash[2]);
    let y = Number(slash[3]);
    if (y < 100) y += 2000;
    let day: number;
    let month: number;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      month = a;
      day = b;
    } else {
      // Ambiguous → D/M/YYYY (machine exports in India)
      day = a;
      month = b;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const parsed = Date.parse(t);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
}

/** Normalize punch time to HH:mm; treat 0:00 / 00:00 as empty. */
export function normalizeAttendanceTime(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) {
    // Excel fraction like 0.4167 → leave blank (matrix usually already stringified)
    return "";
  }
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "";
  if (hh === 0 && mm === 0) return "";
  if (hh > 23 || mm > 59) return "";
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function mapMachineAttendanceStatus(raw: string): AttendanceStatusCode {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, "");
  if (!v) return "present";
  if (["wo", "weeklyoff", "weekoff", "weekend", "off"].includes(v)) return "weekend";
  if (["ho", "hol", "holiday", "ph"].includes(v)) return "holiday";
  if (["a", "ab", "absent", "abs"].includes(v)) return "absent";
  if (["l", "leave", "cl", "sl", "pl"].includes(v)) return "leave";
  if (["hd", "half", "halfday"].includes(v)) return "half_day";
  if (["wfh", "workfromhome"].includes(v)) return "work_from_home";
  if (["late"].includes(v)) return "late";
  if (["miss", "missed", "missedpunch", "mp"].includes(v)) return "missed_punch";
  if (["p", "pr", "present", "on", "1"].includes(v)) return "present";
  return "present";
}

export function parseAttendanceImportWithMapping(
  matrix: string[][],
  headerIdx: number,
  mapping: AttendanceImportFieldKey[],
): { rows: NormalizedAttendanceImportRow[]; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows: NormalizedAttendanceImportRow[] = [];

  if (headerIdx < 0) {
    return { rows: [], errors: ["Could not find header row."], warnings: [] };
  }
  if (!mapping.includes("employee_code")) {
    errors.push("Map a column to Machine / employee code (Code).");
  }
  if (!mapping.includes("attendance_date")) {
    errors.push("Map a column to Date.");
  }
  if (errors.length) return { rows: [], errors, warnings };

  for (let r = headerIdx + 1; r < matrix.length; r += 1) {
    const line = matrix[r] ?? [];
    const get = (field: AttendanceImportFieldKey): string => {
      const idx = mapping.indexOf(field);
      if (idx < 0) return "";
      return String(line[idx] ?? "").trim();
    };

    const codeRaw = get("employee_code");
    const dateRaw = get("attendance_date");
    if (!codeRaw && !dateRaw) continue;

    const employee_code = codeRaw.replace(/\s+/g, "").toUpperCase();
    if (!employee_code) {
      errors.push(`Row ${r + 1}: machine / employee code is required`);
      continue;
    }
    const attendance_date = normalizeAttendanceDate(dateRaw);
    if (!attendance_date) {
      errors.push(`Row ${r + 1}: invalid date "${dateRaw}"`);
      continue;
    }

    let check_in = normalizeAttendanceTime(get("check_in"));
    let check_out = normalizeAttendanceTime(get("check_out"));
    // Support combined "Intime - OutTime" / "10:00-18:30" in the First In mapped column.
    if ((!check_in || !check_out) && get("check_in").includes("-")) {
      const parts = get("check_in")
        .split(/\s*-\s*/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        if (!check_in) check_in = normalizeAttendanceTime(parts[0] ?? "");
        if (!check_out) check_out = normalizeAttendanceTime(parts[1] ?? "");
      }
    }
    const status = mapMachineAttendanceStatus(get("status"));
    const source = get("source") || "biometric";

    rows.push({
      employee_code,
      attendance_date,
      check_in,
      check_out,
      status,
      source,
    });
  }

  if (!rows.length && !errors.length) {
    warnings.push("No data rows found under the header.");
  }
  return { rows, errors, warnings };
}
