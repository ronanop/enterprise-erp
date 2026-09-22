/** Normalize inbound email / ticket text for display (strip invisible chars, break long URLs). */
export function formatServiceDisplayText(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF\u034F\u061C\u00AD\u2060\u3164\u180E]/g, "")
    .replace(/\[(https?:\/\/[^\]\s]+)\]/gi, "\n$1\n")
    .trim();
}
