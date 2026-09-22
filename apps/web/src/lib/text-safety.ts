/** Reject HTML / script injection in plain-text fields (XSS hardening). */

const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/i;
const EVENT_HANDLER_RE = /\bon[a-z]+\s*=/i;
const ACTIVE_SCHEME_RE = /(?:^|[\s"'`(=])(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/i;

export function containsUnsafeMarkup(value: string | null | undefined): boolean {
  const text = (value ?? "").trim();
  if (!text) return false;
  if (HTML_TAG_RE.test(text)) return true;
  if (EVENT_HANDLER_RE.test(text)) return true;
  if (ACTIVE_SCHEME_RE.test(text)) return true;
  const lowered = text.toLowerCase();
  return (
    lowered.includes("<script") ||
    lowered.includes("<iframe") ||
    lowered.includes("<img") ||
    lowered.includes("<svg")
  );
}

/** Strip outer whitespace; return null when markup / active schemes are present. */
export function assertSafePlainText(
  value: string | null | undefined,
  field = "value",
): string {
  const text = (value ?? "").trim();
  if (containsUnsafeMarkup(text)) {
    throw new Error(`${field} contains disallowed HTML or script content`);
  }
  return text;
}

export function sanitizePlainTextList(
  values: string[] | null | undefined,
  field = "value",
): string[] {
  if (!values?.length) return [];
  return values.map((item, index) => assertSafePlainText(item, `${field}[${index + 1}]`));
}

/**
 * Allow http(s) URLs and same-origin paths only.
 * Blocks javascript:, data:, vbscript:, and protocol-relative URLs.
 */
export function safeHref(href: string | null | undefined): string {
  const trimmed = (href ?? "").trim();
  if (!trimmed) return "#";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\")) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed, "https://example.invalid");
    if (url.protocol === "http:" || url.protocol === "https:") {
      return trimmed;
    }
  } catch {
    /* invalid */
  }
  return "#";
}
