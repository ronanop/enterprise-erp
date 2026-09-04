import type { EmployeeIdConfig } from "@/types/employee-management";

const STORAGE_KEY = "erp_employee_id_config_v1";

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

export function formatEmployeeCode(seq: number, config: EmployeeIdConfig = loadEmployeeIdConfig()): string {
  const n = String(seq).padStart(config.padding, "0");
  if (config.mode === "comp_emp") {
    return `${config.companyCode}-EMP${n}`;
  }
  return `${config.prefix}-${n}`;
}

const SEQ_KEY = "erp_employee_id_seq_v1";

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
  for (const code of existingCodes) {
    let digits: string | null = null;
    if (cfg.mode === "comp_emp") {
      const idx = code.toUpperCase().lastIndexOf("EMP");
      if (idx >= 0) digits = code.slice(idx + 3);
    } else if (code.toUpperCase().startsWith(prefix.toUpperCase())) {
      digits = code.slice(prefix.length);
    }
    if (digits && /^\d+$/.test(digits)) {
      max = Math.max(max, Number.parseInt(digits, 10));
    }
  }
  if (max > 0) {
    const raw = localStorage.getItem(SEQ_KEY);
    const current = raw ? Number.parseInt(raw, 10) : 0;
    if (max > current) localStorage.setItem(SEQ_KEY, String(max));
  }
}
