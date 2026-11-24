/**
 * Portal upload payloads (documents + signature) live in IndexedDB so refresh
 * can restore files even when localStorage quota drops base64 from the case.
 */

import { idbGetJson, idbSetJson } from "@/lib/client-idb-json-store";
import type { OnboardingDocument, PortalPayload } from "@/types/onboarding-management";

const STORAGE_KEY = "erp_onboarding_portal_files_v1";

type DocPayload = {
  fileDataUrl: string;
  mimeType?: string;
  fileName: string;
  kind: OnboardingDocument["kind"];
  typeCode?: string;
};

type PortalFilesBlob = {
  documents: Record<string, DocPayload>;
  signature?: {
    fileDataUrl: string;
    mimeType?: string;
    fileName: string;
  };
};

type StoreShape = Record<string, PortalFilesBlob>;

let cache: StoreShape | null = null;
let loadPromise: Promise<StoreShape> | null = null;
let persistQueue: Promise<void> = Promise.resolve();

async function load(): Promise<StoreShape> {
  try {
    const fromIdb = await idbGetJson<StoreShape>(STORAGE_KEY);
    if (fromIdb && typeof fromIdb === "object") {
      cache = fromIdb;
      return cache;
    }
  } catch {
    /* empty */
  }
  cache = {};
  return cache;
}

async function ensureLoaded(): Promise<StoreShape> {
  if (cache) return cache;
  if (!loadPromise) loadPromise = load();
  return loadPromise;
}

export async function savePortalFilePayloads(
  caseId: string,
  portal: PortalPayload,
): Promise<void> {
  if (!caseId) return;
  await ensureLoaded();
  const documents: Record<string, DocPayload> = {};
  for (const d of portal.documents ?? []) {
    if (!d.id || !d.fileDataUrl?.trim()) continue;
    documents[d.id] = {
      fileDataUrl: d.fileDataUrl,
      mimeType: d.mimeType,
      fileName: d.fileName,
      kind: d.kind,
      typeCode: d.typeCode,
    };
  }
  const sigUrl = portal.policies?.signatureDataUrl?.trim();
  const blob: PortalFilesBlob = {
    documents,
    ...(sigUrl
      ? {
          signature: {
            fileDataUrl: sigUrl,
            mimeType: portal.policies.signatureMimeType,
            fileName: portal.policies.signatureFileName || "signature.png",
          },
        }
      : {}),
  };
  const next = { ...(cache ?? {}), [caseId]: blob };
  cache = next;
  persistQueue = persistQueue.then(async () => {
    await idbSetJson(STORAGE_KEY, next);
  });
  await persistQueue;
}

export async function mergePortalFilePayloads(
  caseId: string,
  portal: PortalPayload,
): Promise<PortalPayload> {
  if (!caseId) return portal;
  await ensureLoaded();
  const blob = cache?.[caseId];
  if (!blob) return portal;

  const documents = (portal.documents ?? []).map((d) => {
    if (d.fileDataUrl?.trim()) return d;
    const stored = blob.documents[d.id];
    if (!stored?.fileDataUrl) return d;
    return {
      ...d,
      fileDataUrl: stored.fileDataUrl,
      mimeType: d.mimeType || stored.mimeType,
      fileName: d.fileName || stored.fileName,
    };
  });

  // Recover docs that only exist in IDB (metadata lost from case JSON)
  const knownIds = new Set(documents.map((d) => d.id));
  for (const [id, stored] of Object.entries(blob.documents)) {
    if (knownIds.has(id) || !stored.fileDataUrl) continue;
    documents.push({
      id,
      kind: stored.kind,
      typeCode: stored.typeCode,
      fileName: stored.fileName,
      uploadedAt: new Date().toISOString(),
      verifyStatus: "pending",
      fileDataUrl: stored.fileDataUrl,
      mimeType: stored.mimeType,
    });
  }

  let policies = portal.policies;
  if (!policies.signatureDataUrl?.trim() && blob.signature?.fileDataUrl) {
    policies = {
      ...policies,
      signatureDataUrl: blob.signature.fileDataUrl,
      signatureMimeType: policies.signatureMimeType || blob.signature.mimeType || "image/png",
      signatureFileName: policies.signatureFileName || blob.signature.fileName,
    };
  }

  return { ...portal, documents, policies };
}

export async function clearAllPortalFilePayloads(): Promise<void> {
  cache = {};
  loadPromise = Promise.resolve(cache);
  persistQueue = persistQueue.then(async () => {
    await idbSetJson(STORAGE_KEY, {});
  });
  await persistQueue;
}
