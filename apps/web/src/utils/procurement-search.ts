/**
 * Match search tokens against names / codes without mid-word hits
 * (e.g. "cis" → Cisco, not Precision Tools).
 */
export function textTokenMatch(haystack: string, token: string): boolean {
  const h = haystack.trim().toLowerCase();
  const t = token.trim().toLowerCase();
  if (!t) return true;
  if (!h) return false;
  if (h.startsWith(t)) return true;
  return h.split(/[^a-z0-9]+/).some((part) => part.length > 0 && part.startsWith(t));
}
