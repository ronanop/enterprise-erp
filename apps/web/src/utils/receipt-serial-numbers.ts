/** Placeholder when a unit has no serial number. */
export const RECEIPT_SERIAL_NA = "NA";

export function resizeSerialSlots(prev: string[], count: number): string[] {
  if (count <= 0) return [];
  const next = prev.slice(0, count);
  while (next.length < count) next.push("");
  return next;
}

/** Resize slots; empty values default to NA for new receipt entry. */
export function receiptSerialSlotsWithNaDefaults(prev: string[], count: number): string[] {
  return resizeSerialSlots(prev, count).map((slot) => {
    const v = slot.trim();
    return v ? slot : RECEIPT_SERIAL_NA;
  });
}

export function validateSerialSlots(
  slots: string[],
  qty: number,
  productLabel: string,
): string | null {
  if (qty <= 0) return null;
  if (!Number.isInteger(qty)) {
    return `Receive qty for ${productLabel} must be a whole number when capturing serials.`;
  }
  if (slots.length !== qty) {
    return `Enter ${qty} serial number(s) for ${productLabel}.`;
  }
  for (let i = 0; i < qty; i += 1) {
    const value = (slots[i] ?? "").trim();
    if (!value) {
      return `Serial ${i + 1} for ${productLabel} is required (type a serial or choose NA).`;
    }
  }
  return null;
}

export function serialSlotsForSave(slots: string[]): string[] {
  return slots.map((s) => {
    const v = s.trim();
    return v.toUpperCase() === RECEIPT_SERIAL_NA ? RECEIPT_SERIAL_NA : v;
  });
}
