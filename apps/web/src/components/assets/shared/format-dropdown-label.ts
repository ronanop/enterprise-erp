/**
 * Sentence-case label for dropdown options (first word capital; underscores → spaces).
 * Values stay lowercase snake_case; only the visible label is formatted.
 */
export function formatDropdownLabel(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const spaced = raw.replace(/_/g, " ").replace(/\s+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
