/** Dedupe comma/semicolon-separated PO labels for table display. */
export function formatUniquePoLabels(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  const parts = raw
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.length > 0 ? unique.join(", ") : "—";
}

export function formatUniquePoList(labels: readonly string[] | null | undefined): string {
  if (!labels?.length) return "—";
  const unique = [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
  return unique.length > 0 ? unique.join(", ") : "—";
}
