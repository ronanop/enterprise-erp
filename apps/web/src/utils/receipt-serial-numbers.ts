/** Placeholder when a unit has no serial number. */
export const RECEIPT_SERIAL_NA = "NA";

/** Whole units that need serial capture (fractional remainder has no serial slot). */
export function serialUnitCount(receiveQty: number): number {
  if (!Number.isFinite(receiveQty) || receiveQty <= 0) return 0;
  return Math.floor(receiveQty);
}

export function resizeSerialSlots(prev: string[], count: number): string[] {
  if (count <= 0) return [];
  const next = prev.slice(0, count);
  while (next.length < count) next.push("");
  return next;
}

/** Resize slots; empty values stay empty (serial entry is mandatory). */
export function receiptSerialSlotsWithNaDefaults(prev: string[], count: number): string[] {
  return resizeSerialSlots(prev, count);
}

export function validateSerialSlots(
  slots: string[],
  qty: number,
  productLabel: string,
): string | null {
  if (qty <= 0) return null;
  const units = serialUnitCount(qty);
  if (units <= 0) return null;
  if (slots.length !== units) {
    return `Enter ${units} serial number(s) for ${productLabel}.`;
  }
  for (let i = 0; i < units; i += 1) {
    const value = (slots[i] ?? "").trim();
    if (!value || value.toUpperCase() === RECEIPT_SERIAL_NA) {
      return `Serial ${i + 1} for ${productLabel} is required.`;
    }
  }
  return null;
}

export function serialSlotsForSave(slots: string[]): string[] {
  return slots.map((s) => s.trim());
}
