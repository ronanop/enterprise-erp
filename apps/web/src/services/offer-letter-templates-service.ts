/**
 * Offer letter templates — PDF letterhead + body merge fields.
 * Source of truth: MinIO via API. IndexedDB is a local cache only.
 */

import { apiClient, formatApiError } from "@/services/api-client";
import { idbGetJson, idbSetJson } from "@/lib/client-idb-json-store";
import type { OfferLetterTemplate } from "@/types/recruitment-ats";

const KEY = "erp_ats_offer_letter_templates_v1";
const API = "/recruitment/offer-templates";

let cache: OfferLetterTemplate[] | null = null;
let loadPromise: Promise<OfferLetterTemplate[]> | null = null;

function sortTemplates(rows: OfferLetterTemplate[]): OfferLetterTemplate[] {
  return [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function isTemplate(t: unknown): t is OfferLetterTemplate {
  return (
    !!t &&
    typeof t === "object" &&
    typeof (t as OfferLetterTemplate).id === "string" &&
    typeof (t as OfferLetterTemplate).name === "string" &&
    typeof (t as OfferLetterTemplate).bodyContent === "string"
  );
}

function mapApiRow(row: Record<string, unknown>): OfferLetterTemplate | null {
  if (!isTemplate(row) && !(row && typeof row.id === "string")) return null;
  const id = String(row.id ?? "");
  const name = String(row.name ?? "");
  const bodyContent = String(row.bodyContent ?? row.body_content ?? "");
  const pdfDataUrl = String(row.pdfDataUrl ?? row.pdf_data_url ?? "");
  const pdfFileName = String(row.pdfFileName ?? row.pdf_file_name ?? "letterhead.pdf");
  const createdAt = String(row.createdAt ?? row.created_at ?? new Date().toISOString());
  const updatedAt = String(row.updatedAt ?? row.updated_at ?? createdAt);
  if (!id || !name) return null;
  return {
    id,
    name,
    description: (row.description as string | undefined) || undefined,
    pdfFileName,
    pdfDataUrl: pdfDataUrl.startsWith("data:") ? pdfDataUrl : "",
    bodyContent,
    createdAt,
    updatedAt,
  };
}

async function cacheLocal(rows: OfferLetterTemplate[]): Promise<void> {
  cache = sortTemplates(rows);
  try {
    await idbSetJson(KEY, cache);
  } catch {
    /* ignore quota */
  }
}

async function loadFromApi(): Promise<OfferLetterTemplate[]> {
  const listed = await apiClient<Record<string, unknown>[]>(API);
  const rows = (listed ?? []).map(mapApiRow).filter((r): r is OfferLetterTemplate => !!r);
  // List omits PDF bytes — hydrate each template that needs a letterhead
  const hydrated: OfferLetterTemplate[] = [];
  for (const row of rows) {
    if (row.pdfDataUrl?.startsWith("data:")) {
      hydrated.push(row);
      continue;
    }
    try {
      const full = await apiClient<Record<string, unknown>>(`${API}/${encodeURIComponent(row.id)}`);
      const mapped = mapApiRow(full ?? {});
      hydrated.push(mapped ?? row);
    } catch {
      hydrated.push(row);
    }
  }
  await cacheLocal(hydrated);
  return cache!;
}

async function loadFromStorage(): Promise<OfferLetterTemplate[]> {
  try {
    return await loadFromApi();
  } catch {
    try {
      const fromIdb = await idbGetJson<OfferLetterTemplate[]>(KEY);
      if (Array.isArray(fromIdb) && fromIdb.length) {
        cache = sortTemplates(fromIdb.filter(isTemplate));
        return cache;
      }
    } catch {
      /* fall through */
    }
    cache = [];
    return cache;
  }
}

/** Warm cache (safe to call multiple times). */
export function ensureOfferLetterTemplatesLoaded(): Promise<OfferLetterTemplate[]> {
  if (cache) return Promise.resolve(cache);
  if (!loadPromise) loadPromise = loadFromStorage();
  return loadPromise;
}

function getAllSync(): OfferLetterTemplate[] {
  return cache ? [...cache] : [];
}

export function listOfferLetterTemplates(): OfferLetterTemplate[] {
  return getAllSync().map((t) => ({ ...t }));
}

export function getOfferLetterTemplate(id: string): OfferLetterTemplate | null {
  return getAllSync().find((t) => t.id === id) ?? null;
}

export async function saveOfferLetterTemplate(
  input: Omit<OfferLetterTemplate, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  },
): Promise<OfferLetterTemplate> {
  if (!input.pdfDataUrl?.startsWith("data:")) {
    throw new Error("Upload a PDF letterhead before saving.");
  }
  if (!input.bodyContent.trim()) {
    throw new Error("Add body content before saving.");
  }

  try {
    const saved = await apiClient<Record<string, unknown>>(API, {
      method: "POST",
      body: {
        id: input.id || null,
        name: input.name.trim() || "Untitled template",
        description: (input.description || "").trim() || null,
        pdf_file_name: input.pdfFileName || "letterhead.pdf",
        pdf_data_url: input.pdfDataUrl,
        body_content: input.bodyContent,
      },
    });
    const mapped = mapApiRow(saved ?? {});
    if (!mapped) throw new Error("Invalid template response");
    await ensureOfferLetterTemplatesLoaded();
    const all = getAllSync().filter((t) => t.id !== mapped.id);
    all.unshift(mapped);
    await cacheLocal(all);
    return mapped;
  } catch (err) {
    throw new Error(formatApiError(err, "Failed to save offer template to storage"));
  }
}

export async function deleteOfferLetterTemplate(id: string): Promise<boolean> {
  try {
    await apiClient<null>(`${API}/${encodeURIComponent(id)}`, { method: "DELETE" });
    const next = getAllSync().filter((t) => t.id !== id);
    await cacheLocal(next);
    return true;
  } catch {
    return false;
  }
}
