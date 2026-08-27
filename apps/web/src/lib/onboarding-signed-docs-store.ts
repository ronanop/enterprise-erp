/**
 * Signed policy PDFs (signature stamped) live in IndexedDB so onboarding cases
 * in localStorage stay under quota.
 */

import { idbGetJson, idbSetJson } from "@/lib/client-idb-json-store";
import type { SignedPolicyDocument } from "@/types/onboarding-management";

const STORAGE_KEY = "erp_onboarding_signed_policies_v1";

type SignedByCase = Record<string, SignedPolicyDocument[]>;

let cache: SignedByCase | null = null;
let loadPromise: Promise<SignedByCase> | null = null;
let persistQueue: Promise<void> = Promise.resolve();

async function load(): Promise<SignedByCase> {
  try {
    const fromIdb = await idbGetJson<SignedByCase>(STORAGE_KEY);
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

export function ensureSignedPolicyDocsLoaded(): Promise<SignedByCase> {
  if (cache) return Promise.resolve(cache);
  if (!loadPromise) loadPromise = load();
  return loadPromise;
}

export async function saveSignedPolicyDocsForCase(
  caseId: string,
  docs: SignedPolicyDocument[],
): Promise<void> {
  await ensureSignedPolicyDocsLoaded();
  const next = { ...(cache ?? {}), [caseId]: docs };
  cache = next;
  persistQueue = persistQueue.then(async () => {
    await idbSetJson(STORAGE_KEY, next);
  });
  await persistQueue;
}

export async function getSignedPolicyDocsForCase(
  caseId: string,
): Promise<SignedPolicyDocument[]> {
  await ensureSignedPolicyDocsLoaded();
  return cache?.[caseId] ?? [];
}

export function getSignedPolicyDocsForCaseSync(caseId: string): SignedPolicyDocument[] {
  return cache?.[caseId] ?? [];
}

/** Metadata-only copy safe for localStorage (no base64 payloads). */
export function stripSignedDocPayloads(
  docs: SignedPolicyDocument[],
): SignedPolicyDocument[] {
  return docs.map((d) => ({
    policyId: d.policyId,
    title: d.title,
    fileName: d.fileName,
    mimeType: d.mimeType,
    signedAt: d.signedAt,
    fileDataUrl: "",
  }));
}

if (typeof window !== "undefined") {
  void ensureSignedPolicyDocsLoaded();
}
