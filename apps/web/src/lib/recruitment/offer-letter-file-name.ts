/** Build a download-friendly offer letter file name from candidate + role. */
export function buildOfferLetterFileName(opts: {
  candidateName?: string | null;
  role?: string | null;
  offerCode?: string | null;
}): string {
  const name = String(opts.candidateName || "")
    .trim()
    .replace(/\s+/g, " ");
  const role = String(opts.role || "")
    .trim()
    .replace(/\s+/g, " ");
  const parts = [name, role, "Offer Letter"].filter(Boolean);
  let base = parts.join(" ").trim() || "Offer Letter";
  if (!name && opts.offerCode) {
    base = `Offer ${opts.offerCode} Offer Letter`;
  }
  const safe = base
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${safe || "Offer Letter"}.pdf`;
}
