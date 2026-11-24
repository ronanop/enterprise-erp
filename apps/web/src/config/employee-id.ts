import type { EmployeeIdConfig } from "@/types/employee-management";

const STORAGE_KEY = "erp_employee_id_config_v1";
const SEQ_KEY = "erp_employee_id_seq_v1";
const SEQ_BY_PREFIX_KEY = "erp_employee_id_seq_by_prefix_v1";

export const DEFAULT_EMPLOYEE_ID_CONFIG: EmployeeIdConfig = {
  mode: "emp_seq",
  prefix: "EMP",
  padding: 6,
  companyCode: "COMP01",
};

export function loadEmployeeIdConfig(): EmployeeIdConfig {
  if (typeof window === "undefined") return DEFAULT_EMPLOYEE_ID_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_EMPLOYEE_ID_CONFIG;
    return { ...DEFAULT_EMPLOYEE_ID_CONFIG, ...JSON.parse(raw) } as EmployeeIdConfig;
  } catch {
    return DEFAULT_EMPLOYEE_ID_CONFIG;
  }
}

export function saveEmployeeIdConfig(config: EmployeeIdConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/** Normalize a company/entity code into a code prefix like ``CACHETECH`` (no hyphen). */
export function normalizeEmployeeCodePrefix(entityCode: string): string {
  const raw = entityCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return raw || "EMP";
}

export function formatEmployeeCode(
  seq: number,
  config: EmployeeIdConfig = loadEmployeeIdConfig(),
): string {
  const n = String(seq).padStart(config.padding, "0");
  if (config.mode === "comp_emp") {
    return `${config.companyCode}-EMP${n}`;
  }
  return `${config.prefix}-${n}`;
}

/** ``{ENTITY_CODE}000001`` — one serial series per company/entity code (no hyphen). */
export function formatEmployeeCodeForEntity(
  entityCode: string,
  seq: number,
  padding = 6,
): string {
  return `${normalizeEmployeeCodePrefix(entityCode)}${String(seq).padStart(padding, "0")}`;
}

function readPrefixSeqMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SEQ_BY_PREFIX_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePrefixSeqMap(map: Record<string, number>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SEQ_BY_PREFIX_KEY, JSON.stringify(map));
}

function maxSerialForPrefix(prefix: string, existingCodes: string[]): number {
  let max = 0;
  const p = prefix.toUpperCase();
  for (const code of existingCodes) {
    const upper = String(code || "").toUpperCase();
    if (!upper.startsWith(p)) continue;
    const digits = upper.slice(p.length);
    if (/^\d+$/.test(digits)) {
      max = Math.max(max, Number.parseInt(digits, 10));
    }
  }
  return max;
}

export function peekNextSequenceForEntity(
  entityCode: string,
  existingCodes: string[] = [],
): number {
  const prefix = normalizeEmployeeCodePrefix(entityCode);
  const fromCodes = maxSerialForPrefix(prefix, existingCodes);
  const map = readPrefixSeqMap();
  const fromLocal = Number(map[prefix] ?? 0);
  return Math.max(fromCodes, fromLocal, 0) + 1;
}

export function peekNextEmployeeCodeForEntity(
  entityCode: string,
  existingCodes: string[] = [],
  padding = 6,
): string {
  return formatEmployeeCodeForEntity(
    entityCode,
    peekNextSequenceForEntity(entityCode, existingCodes),
    padding,
  );
}

export function consumeEmployeeSequenceForEntity(
  entityCode: string,
  existingCodes: string[] = [],
): string {
  const prefix = normalizeEmployeeCodePrefix(entityCode);
  const next = peekNextSequenceForEntity(entityCode, existingCodes);
  const map = readPrefixSeqMap();
  map[prefix] = next;
  writePrefixSeqMap(map);
  return formatEmployeeCodeForEntity(entityCode, next);
}

export function peekNextEmployeeSequence(): number {
  if (typeof window === "undefined") return 1;
  const raw = localStorage.getItem(SEQ_KEY);
  const current = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(current) ? current + 1 : 1;
}

export function consumeEmployeeSequence(): number {
  const next = peekNextEmployeeSequence();
  localStorage.setItem(SEQ_KEY, String(next));
  return next;
}

export function syncSequenceFromCodes(existingCodes: string[]): void {
  let max = 0;
  const cfg = loadEmployeeIdConfig();
  const prefix = `${cfg.prefix}-`;
  const byPrefix: Record<string, number> = readPrefixSeqMap();

  for (const code of existingCodes) {
    const upper = String(code || "").toUpperCase();
    let digits: string | null = null;
    if (cfg.mode === "comp_emp") {
      const idx = upper.lastIndexOf("EMP");
      if (idx >= 0) digits = upper.slice(idx + 3);
    } else if (upper.startsWith(prefix.toUpperCase())) {
      digits = upper.slice(prefix.length);
    }
    if (digits && /^\d+$/.test(digits)) {
      max = Math.max(max, Number.parseInt(digits, 10));
    }

    // Also track entity-code prefixes: CODE000123 (and legacy CODE-000123)
    const m =
      upper.match(/^([A-Z][A-Z0-9]*?)(\d{3,})$/) ||
      upper.match(/^([A-Z0-9]+)-(\d+)$/);
    if (m) {
      const p = m[1];
      const n = Number.parseInt(m[2], 10);
      if (Number.isFinite(n)) {
        byPrefix[p] = Math.max(byPrefix[p] ?? 0, n);
      }
    }
  }
  if (max > 0) {
    const raw = localStorage.getItem(SEQ_KEY);
    const current = raw ? Number.parseInt(raw, 10) : 0;
    if (max > current) localStorage.setItem(SEQ_KEY, String(max));
  }
  writePrefixSeqMap(byPrefix);
}
