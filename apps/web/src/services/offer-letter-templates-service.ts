/**
 * Offer letter templates — PDF letterhead + body merge fields.
 * Stored in IndexedDB (PDFs exceed localStorage quota).
 */

import { idbGetJson, idbSetJson } from "@/lib/client-idb-json-store";
import type { OfferLetterTemplate } from "@/types/recruitment-ats";

const KEY = "erp_ats_offer_letter_templates_v1";

let cache: OfferLetterTemplate[] | null = null;
let loadPromise: Promise<OfferLetterTemplate[]> | null = null;
let persistQueue: Promise<void> = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

function sortTemplates(rows: OfferLetterTemplate[]): OfferLetterTemplate[] {
  return [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function isTemplate(t: unknown): t is OfferLetterTemplate {
  return (
    !!t &&
    typeof t === "object" &&
    typeof (t as OfferLetterTemplate).id === "string" &&
    typeof (t as OfferLetterTemplate).name === "string" &&
    typeof (t as OfferLetterTemplate).pdfDataUrl === "string" &&
    typeof (t as OfferLetterTemplate).bodyContent === "string"
  );
}

function readLocalStorageFallback(): OfferLetterTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTemplate);
  } catch {
    return [];
  }
}

function clearLocalStorageTemplates() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

async function loadFromStorage(): Promise<OfferLetterTemplate[]> {
  try {
    const fromIdb = await idbGetJson<OfferLetterTemplate[]>(KEY);
    if (Array.isArray(fromIdb) && fromIdb.length) {
      cache = sortTemplates(fromIdb.filter(isTemplate));
      clearLocalStorageTemplates();
      return cache;
    }
  } catch {
    /* fall through */
  }

  const fromLs = readLocalStorageFallback();
  if (fromLs.length) {
    cache = sortTemplates(fromLs);
    try {
      await idbSetJson(KEY, cache);
      clearLocalStorageTemplates();
    } catch {
      /* keep LS if IDB write fails */
    }
    return cache;
  }

  cache = [];
  return cache;
}

/** Warm cache (safe to call multiple times). */
export function ensureOfferLetterTemplatesLoaded(): Promise<OfferLetterTemplate[]> {
  if (cache) return Promise.resolve(cache);
  if (!loadPromise) loadPromise = loadFromStorage();
  return loadPromise;
}

function getAllSync(): OfferLetterTemplate[] {
  if (cache) return cache;
  const fromLs = readLocalStorageFallback();
  if (fromLs.length) {
    cache = sortTemplates(fromLs);
    return cache;
  }
  return [];
}

async function persist(rows: OfferLetterTemplate[]): Promise<void> {
  persistQueue = persistQueue
    .then(async () => {
      await idbSetJson(KEY, rows);
      clearLocalStorageTemplates();
    })
    .catch((err) => {
      const msg =
        err instanceof Error ? err.message : "Failed to save offer templates";
      throw new Error(
        /quota|storage/i.test(msg)
          ? "Browser storage is full — free space or use a smaller PDF (max 5 MB)."
          : msg,
      );
    });
  return persistQueue;
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
  await ensureOfferLetterTemplatesLoaded();
  const all = [...getAllSync()];
  const now = nowIso();
  const name = input.name.trim() || "Untitled template";

  if (!input.pdfDataUrl?.startsWith("data:")) {
    throw new Error("Upload a PDF letterhead before saving.");
  }
  if (!input.bodyContent.trim()) {
    throw new Error("Add body content before saving.");
  }

  if (input.id) {
    const idx = all.findIndex((t) => t.id === input.id);
    if (idx >= 0) {
      const next: OfferLetterTemplate = {
        ...all[idx]!,
        name,
        description: (input.description || "").trim() || undefined,
        pdfFileName: input.pdfFileName,
        pdfDataUrl: input.pdfDataUrl,
        bodyContent: input.bodyContent,
        updatedAt: now,
      };
      all[idx] = next;
      cache = sortTemplates(all);
      await persist(cache);
      return next;
    }
  }

  const row: OfferLetterTemplate = {
    id: crypto.randomUUID(),
    name,
    description: (input.description || "").trim() || undefined,
    pdfFileName: input.pdfFileName,
    pdfDataUrl: input.pdfDataUrl,
    bodyContent: input.bodyContent,
    createdAt: now,
    updatedAt: now,
  };
  all.unshift(row);
  cache = sortTemplates(all);
  await persist(cache);
  return row;
}

export async function deleteOfferLetterTemplate(id: string): Promise<boolean> {
  await ensureOfferLetterTemplatesLoaded();
  const all = getAllSync();
  const next = all.filter((t) => t.id !== id);
  if (next.length === all.length) return false;
  cache = next;
  await persist(cache);
  return true;
}
