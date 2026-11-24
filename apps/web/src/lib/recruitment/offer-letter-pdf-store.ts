/**
 * Persist composed offer-letter PDFs (letterhead + body) in IndexedDB.
 * localStorage cannot hold multi-page letterhead PDFs reliably.
 */

import { idbGetJson, idbSetJson } from "@/lib/client-idb-json-store";

const KEY = "erp_ats_offer_letter_pdfs_v1";

type StoreShape = Record<string, string>;

async function readStore(): Promise<StoreShape> {
  try {
    const fromIdb = await idbGetJson<StoreShape>(KEY);
    if (fromIdb && typeof fromIdb === "object") return { ...fromIdb };
  } catch {
    /* ignore */
  }
  return {};
}

async function writeStore(next: StoreShape): Promise<void> {
  await idbSetJson(KEY, next);
}

export async function saveOfferLetterPdf(
  offerId: string,
  pdfDataUrl: string,
): Promise<void> {
  if (!offerId || !pdfDataUrl?.startsWith("data:")) return;
  const all = await readStore();
  all[offerId] = pdfDataUrl;
  await writeStore(all);
}

export async function getOfferLetterPdf(offerId: string): Promise<string | null> {
  if (!offerId) return null;
  const all = await readStore();
  const url = all[offerId];
  return url?.startsWith("data:") ? url : null;
}

/** True when a data-URL PDF looks like a real composed letter (not a tiny stub). */
export function isSubstantialPdfDataUrl(url: string | null | undefined): boolean {
  const u = (url || "").trim();
  if (!u.startsWith("data:") || !/pdf/i.test(u)) return false;
  // Plain jsPDF body-only stubs are usually small; letterhead compose is much larger
  return u.length >= 8_000;
}
