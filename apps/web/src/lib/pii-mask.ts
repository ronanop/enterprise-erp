/** Display masking for PII (Aadhaar, PAN, phone, bank, email). */

export function looksMasked(value?: string | null): boolean {
  if (!value) return false;
  return value.includes("*") || value.includes("•");
}

export function maskKeepLast(value?: string | null, keep = 4, maskChar = "*"): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  if (looksMasked(text)) return text;
  if (text.length <= keep) return maskChar.repeat(text.length);
  return maskChar.repeat(text.length - keep) + text.slice(-keep);
}

export function maskEmail(value?: string | null): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  if (looksMasked(text)) return text;
  const at = text.indexOf("@");
  if (at < 0) return maskKeepLast(text, 2);
  const local = text.slice(0, at);
  const domain = text.slice(at + 1);
  if (!local) return `*@${domain}`;
  const maskedLocal = local.length === 1 ? "*" : local[0] + "*".repeat(local.length - 1);
  return `${maskedLocal}@${domain}`;
}

export function maskPhone(value?: string | null): string {
  return maskKeepLast(value, 4);
}

export function maskAadhaar(value?: string | null): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return looksMasked(value) ? String(value) : "";
  return maskKeepLast(digits, 4);
}

export function maskPan(value?: string | null): string {
  const text = (value ?? "").trim().toUpperCase();
  if (!text) return "";
  if (looksMasked(text)) return text;
  return maskKeepLast(text, 4);
}

export function maskAccount(value?: string | null): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits) return maskKeepLast(digits, 4);
  return maskKeepLast(value, 4);
}

export function maskDob(value?: string | null): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  if (looksMasked(text)) return text;
  if (text.length >= 8 && text[4] === "-" && text[7] === "-") return "****-**-**";
  return maskKeepLast(text, 2);
}

export function maskAddress(value?: string | null): string {
  return maskKeepLast(value, 6);
}

/** Mask PII fields on a portal-like object for UI display (does not mutate input). */
export function maskPortalForDisplay<T extends Record<string, unknown>>(portal: T): T {
  const p = structuredClone(portal) as T & {
    personal?: Record<string, string>;
    governmentIds?: Record<string, string>;
    bank?: Record<string, string>;
    emergency?: Record<string, string>;
  };

  if (p.personal) {
    if (p.personal.phone) p.personal.phone = maskPhone(p.personal.phone);
    if (p.personal.email) p.personal.email = maskEmail(p.personal.email);
    if (p.personal.personalEmail) p.personal.personalEmail = maskEmail(p.personal.personalEmail);
    if (p.personal.dob) p.personal.dob = maskDob(p.personal.dob);
    if (p.personal.address) p.personal.address = maskAddress(p.personal.address);
    if (p.personal.permanentAddress) {
      p.personal.permanentAddress = maskAddress(p.personal.permanentAddress);
    }
  }
  if (p.governmentIds) {
    if (p.governmentIds.aadhaar) p.governmentIds.aadhaar = maskAadhaar(p.governmentIds.aadhaar);
    if (p.governmentIds.pan) p.governmentIds.pan = maskPan(p.governmentIds.pan);
    for (const key of ["passport", "drivingLicense", "uan", "esic"] as const) {
      if (p.governmentIds[key]) {
        p.governmentIds[key] = maskKeepLast(p.governmentIds[key], 4);
      }
    }
  }
  if (p.bank) {
    if (p.bank.accountNumber) p.bank.accountNumber = maskAccount(p.bank.accountNumber);
    if (p.bank.upi) p.bank.upi = maskKeepLast(p.bank.upi, 4);
  }
  if (p.emergency) {
    if (p.emergency.phone) p.emergency.phone = maskPhone(p.emergency.phone);
    if (p.emergency.address) p.emergency.address = maskAddress(p.emergency.address);
  }
  return p;
}
