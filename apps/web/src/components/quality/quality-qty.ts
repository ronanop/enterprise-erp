export type QtyField = "inspected" | "accepted" | "rejected";

export type QtyFieldErrors = Partial<Record<QtyField, string>>;

export function parseNonNegativeQty(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

const DISPOSITION_MSG = "Accepted plus rejected cannot exceed inspected quantity.";

export function mapQtyApiError(message: string): QtyFieldErrors | null {
  const lower = message.toLowerCase();
  if (lower.includes("accepted") && lower.includes("rejected") && lower.includes("inspected")) {
    return { accepted: DISPOSITION_MSG, rejected: DISPOSITION_MSG };
  }
  if (lower.includes("negative") || lower.includes("non-negative")) {
    return { inspected: message, accepted: message, rejected: message };
  }
  return null;
}

export function validateDispositionQty(
  inspected: number,
  accepted: number,
  rejected: number,
): QtyFieldErrors {
  const errors: QtyFieldErrors = {};
  if (accepted + rejected > inspected) {
    errors.accepted = DISPOSITION_MSG;
    errors.rejected = DISPOSITION_MSG;
    if (inspected === 0) {
      errors.inspected = "Inspected quantity must be at least accepted plus rejected.";
    }
  }
  return errors;
}

export function validateQtyInputs(
  inspectedRaw: string,
  acceptedRaw: string,
  rejectedRaw: string,
): QtyFieldErrors {
  const errors: QtyFieldErrors = {};
  for (const [field, raw] of [
    ["inspected", inspectedRaw],
    ["accepted", acceptedRaw],
    ["rejected", rejectedRaw],
  ] as const) {
    if (raw.trim() === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      errors[field] = "Enter a valid number.";
    } else if (n < 0) {
      errors[field] = "Quantity cannot be negative.";
    }
  }
  if (Object.keys(errors).length > 0) return errors;

  return validateDispositionQty(
    parseNonNegativeQty(inspectedRaw),
    parseNonNegativeQty(acceptedRaw),
    parseNonNegativeQty(rejectedRaw),
  );
}
