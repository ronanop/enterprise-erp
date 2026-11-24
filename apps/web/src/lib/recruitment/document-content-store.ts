/**
 * Large ATS document payloads (PDFs) live in IndexedDB — localStorage quota
 * cannot hold letterhead offer letters / resumes reliably.
 */

import { idbGetJson, idbSetJson } from "@/lib/client-idb-json-store";

const KEY = "erp_ats_document_content_v1";

/** Data URLs larger than this must not be written to localStorage. */
export const LOCAL_DOC_CONTENT_MAX_CHARS = 4_000;

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

export function isOversizedDocContent(value: string | null | undefined): boolean {
  const v = (value || "").trim();
  return v.startsWith("data:") && v.length > LOCAL_DOC_CONTENT_MAX_CHARS;
}

export async function saveDocumentContent(
  documentId: string,
  dataUrl: string,
): Promise<void> {
  if (!documentId || !dataUrl?.startsWith("data:")) return;
  const all = await readStore();
  all[documentId] = dataUrl;
  await writeStore(all);
}

export async function getDocumentContent(
  documentId: string,
): Promise<string | null> {
  if (!documentId) return null;
  const all = await readStore();
  const url = all[documentId];
  return url?.startsWith("data:") ? url : null;
}

export async function removeDocumentContent(documentId: string): Promise<void> {
  if (!documentId) return;
  const all = await readStore();
  if (!(documentId in all)) return;
  delete all[documentId];
  await writeStore(all);
}
