const KEY = "erp_shift_id_config_v1";
const SEQ_KEY = "erp_shift_code_seq_v1";

export type ShiftIdConfig = {
  prefix: string;
  padding: number;
};

export const DEFAULT_SHIFT_ID_CONFIG: ShiftIdConfig = { prefix: "SHIFT", padding: 3 };

export function loadShiftIdConfig(): ShiftIdConfig {
  if (typeof window === "undefined") return DEFAULT_SHIFT_ID_CONFIG;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SHIFT_ID_CONFIG;
    return { ...DEFAULT_SHIFT_ID_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SHIFT_ID_CONFIG;
  }
}

export function peekNextShiftCode(): string {
  if (typeof window === "undefined") return `${DEFAULT_SHIFT_ID_CONFIG.prefix}-001`;
  const cfg = loadShiftIdConfig();
  const raw = localStorage.getItem(SEQ_KEY);
  const n = raw ? Number.parseInt(raw, 10) : 0;
  const next = Number.isFinite(n) ? n + 1 : 1;
  return `${cfg.prefix}-${String(next).padStart(cfg.padding, "0")}`;
}

export function consumeShiftCode(): string {
  if (typeof window === "undefined") return `${DEFAULT_SHIFT_ID_CONFIG.prefix}-001`;
  const code = peekNextShiftCode();
  const cfg = loadShiftIdConfig();
  const num = Number.parseInt(code.split("-").pop() ?? "1", 10);
  localStorage.setItem(SEQ_KEY, String(num));
  return code;
}

export function syncShiftCodesFromList(codes: string[]): void {
  const cfg = loadShiftIdConfig();
  let max = 0;
  const needle = `${cfg.prefix}-`;
  for (const c of codes) {
    if (!c.toUpperCase().startsWith(needle.toUpperCase())) continue;
    const digits = c.slice(needle.length);
    if (/^\d+$/.test(digits)) max = Math.max(max, Number.parseInt(digits, 10));
  }
  if (max > 0) {
    const cur = Number.parseInt(localStorage.getItem(SEQ_KEY) ?? "0", 10);
    if (max > cur) localStorage.setItem(SEQ_KEY, String(max));
  }
}
