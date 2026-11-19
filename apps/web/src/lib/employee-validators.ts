const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const AADHAAR_RE = /^\d{12}$/;
const MOBILE_RE = /^[6-9]\d{9}$/;
const PINCODE_RE = /^\d{6}$/;
const UAN_RE = /^\d{12}$/;
const ESIC_RE = /^\d{10,17}$/;
const ACCOUNT_RE = /^\d{9,18}$/;

/** Keep digits only, optionally capped. */
export function digitsOnly(value: string, maxLen?: number): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return maxLen != null ? digits.slice(0, maxLen) : digits;
}

/** Letters + spaces only (names). */
export function lettersOnly(value: string, maxLen = 80): string {
  return String(value ?? "")
    .replace(/[^A-Za-z\s.'-]/g, "")
    .slice(0, maxLen);
}

/** Numeric amount (digits + optional one decimal). */
export function amountOnly(value: string, maxLen = 14): string {
  let v = String(value ?? "").replace(/[^\d.]/g, "");
  const parts = v.split(".");
  if (parts.length > 2) v = `${parts[0]}.${parts.slice(1).join("")}`;
  if (parts[1]?.length > 2) v = `${parts[0]}.${parts[1].slice(0, 2)}`;
  return v.slice(0, maxLen);
}

export function validateRequired(value: string, label: string): string | null {
  if (!String(value ?? "").trim()) return `${label} is required`;
  return null;
}

export function validatePan(
  value: string,
  opts: { required?: boolean } = {},
): string | null {
  const { required = false } = opts;
  const v = value.trim().toUpperCase();
  if (!v) return required ? "PAN is required" : null;
  return PAN_RE.test(v) ? null : "Invalid PAN format (e.g. ABCDE1234F)";
}

export function validateAadhaar(
  value: string,
  opts: { required?: boolean } = {},
): string | null {
  const { required = false } = opts;
  const v = value.replace(/\s/g, "");
  if (!v) return required ? "Aadhaar is required" : null;
  return AADHAAR_RE.test(v) ? null : "Aadhaar must be exactly 12 digits";
}

export function validateIfsc(
  value: string,
  opts: { required?: boolean } = {},
): string | null {
  const { required = false } = opts;
  const v = value.trim().toUpperCase();
  if (!v) return required ? "IFSC is required" : null;
  return IFSC_RE.test(v) ? null : "Invalid IFSC (e.g. HDFC0001234)";
}

export function validateMobile(
  value: string,
  opts: { required?: boolean; label?: string } = {},
): string | null {
  const { required = false, label = "Mobile" } = opts;
  const v = value.replace(/\D/g, "");
  if (!v) return required ? `${label} is required` : null;
  return MOBILE_RE.test(v) ? null : `${label} must be a 10-digit Indian number`;
}

export function validateEmail(
  value: string,
  opts: { required?: boolean; label?: string } = {},
): string | null {
  const { required = false, label = "Email" } = opts;
  const v = value.trim();
  if (!v) return required ? `${label} is required` : null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `Invalid ${label.toLowerCase()} address`;
  return null;
}

export function validatePincode(
  value: string,
  opts: { required?: boolean } = {},
): string | null {
  const { required = false } = opts;
  const v = value.replace(/\D/g, "");
  if (!v) return required ? "Pincode is required" : null;
  return PINCODE_RE.test(v) ? null : "Pincode must be exactly 6 digits";
}

export function validateUan(value: string): string | null {
  const v = value.replace(/\D/g, "");
  if (!v) return null;
  return UAN_RE.test(v) ? null : "UAN must be exactly 12 digits";
}

export function validateEsic(value: string): string | null {
  const v = value.replace(/\D/g, "");
  if (!v) return null;
  return ESIC_RE.test(v) ? null : "ESIC number must be 10–17 digits";
}

export function validateBankAccount(
  account: string,
  confirm: string,
  opts: { required?: boolean } = {},
): string | null {
  const { required = false } = opts;
  const a = account.replace(/\D/g, "");
  const c = confirm.replace(/\D/g, "");
  if (!a) return required ? "Account number is required" : null;
  if (!ACCOUNT_RE.test(a)) return "Account number must be 9–18 digits";
  if (required && !c) return "Confirm account number is required";
  if (c && a !== c) return "Account numbers do not match";
  return null;
}

export function validateYear(value: string): string | null {
  const v = value.replace(/\D/g, "");
  if (!v) return null;
  if (!/^\d{4}$/.test(v)) return "Year must be 4 digits";
  const n = Number(v);
  const max = new Date().getFullYear() + 1;
  if (n < 1950 || n > max) return `Year must be between 1950 and ${max}`;
  return null;
}

export function validateAmount(value: string, label = "Amount"): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return `${label} must be a valid number`;
  return null;
}

export type UniquenessCheck = {
  employeeCode: string;
  officialEmail: string;
  mobile: string;
  pan: string;
  aadhaar: string;
};

export function findUniquenessConflicts(
  check: UniquenessCheck,
  records: { id: string; employeeCode: string; officialEmail: string; mobile: string; pan: string; aadhaar: string }[],
  excludeId?: string,
): string[] {
  const errors: string[] = [];
  const others = records.filter((r) => r.id !== excludeId);
  const email = check.officialEmail.trim().toLowerCase();
  if (email && others.some((r) => r.officialEmail.toLowerCase() === email)) {
    errors.push("cache email id is already in use");
  }
  if (check.employeeCode && others.some((r) => r.employeeCode === check.employeeCode)) {
    errors.push("Employee ID is already in use");
  }
  const mobile = check.mobile.replace(/\D/g, "");
  if (mobile && others.some((r) => r.mobile.replace(/\D/g, "") === mobile)) {
    errors.push("Mobile number is already in use");
  }
  const pan = check.pan.trim().toUpperCase();
  if (pan && others.some((r) => r.pan.toUpperCase() === pan)) {
    errors.push("PAN is already in use");
  }
  const aadhaar = check.aadhaar.replace(/\s/g, "");
  if (aadhaar && others.some((r) => r.aadhaar.replace(/\s/g, "") === aadhaar)) {
    errors.push("Aadhaar is already in use");
  }
  return errors;
}
