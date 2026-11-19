const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const AADHAAR_RE = /^\d{12}$/;
const MOBILE_RE = /^[6-9]\d{9}$/;

export function validatePan(value: string): string | null {
  const v = value.trim().toUpperCase();
  if (!v) return null;
  return PAN_RE.test(v) ? null : "Invalid PAN format (e.g. ABCDE1234F)";
}

export function validateAadhaar(value: string): string | null {
  const v = value.replace(/\s/g, "");
  if (!v) return null;
  return AADHAAR_RE.test(v) ? null : "Aadhaar must be 12 digits";
}

export function validateIfsc(value: string): string | null {
  const v = value.trim().toUpperCase();
  if (!v) return null;
  return IFSC_RE.test(v) ? null : "Invalid IFSC code";
}

export function validateMobile(value: string): string | null {
  const v = value.replace(/\D/g, "");
  if (!v) return null;
  return MOBILE_RE.test(v) ? null : "Invalid mobile number";
}

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Invalid email address";
  return null;
}

export function validateBankAccount(account: string, confirm: string): string | null {
  if (!account.trim()) return null;
  if (account !== confirm) return "Account numbers do not match";
  if (account.length < 8) return "Account number looks too short";
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
    errors.push("Official email is already in use");
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
