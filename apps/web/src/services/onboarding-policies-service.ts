/**
 * Onboarding policy documents — editable in Org Setup / eDoc, consumed by candidate portal.
 * Each policy can have written content and/or an uploaded PDF/file.
 *
 * Large PDFs are stored in IndexedDB (localStorage quota is ~5 MB and cannot hold
 * multiple base64 policy files).
 */

import { idbGetJson, idbSetJson } from "@/lib/client-idb-json-store";

export type OnboardingPolicyDoc = {
  id: string;
  code: string;
  title: string;
  body: string;
  /** Optional uploaded policy PDF (or other document) shown in portal View. */
  fileName?: string;
  fileDataUrl?: string;
  mimeType?: string;
  sortOrder: number;
  status: "active" | "inactive";
  updatedAt: string;
};

export type PortalPolicyDoc = {
  id: string;
  label: string;
  body: string;
  fileName?: string;
  fileDataUrl?: string;
  mimeType?: string;
};

const STORAGE_KEY = "erp_onboarding_policies_v1";

const DEFAULT_POLICIES: OnboardingPolicyDoc[] = [
  {
    id: "handbook",
    code: "POL-HANDBOOK",
    title: "Employee Handbook",
    body:
      "Welcome to the organization. This handbook outlines workplace expectations, leave entitlements, attendance rules, and HR contacts. Please read carefully before accepting.",
    sortOrder: 1,
    status: "active",
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: "nda",
    code: "POL-NDA",
    title: "NDA",
    body:
      "You agree not to disclose confidential company information, customer data, or trade secrets during and after employment.",
    sortOrder: 2,
    status: "active",
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: "it_policy",
    code: "POL-IT",
    title: "IT Policy",
    body:
      "Use company devices and accounts responsibly. Do not share passwords. Report security incidents promptly. Personal software installs require IT approval.",
    sortOrder: 3,
    status: "active",
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: "code_of_conduct",
    code: "POL-COC",
    title: "Code of Conduct",
    body:
      "Treat colleagues with respect. Zero tolerance for harassment or discrimination. Follow conflict-of-interest and gift policies.",
    sortOrder: 4,
    status: "active",
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: "privacy",
    code: "POL-PRIVACY",
    title: "Privacy Policy",
    body:
      "We process personal data for employment, payroll, and compliance. Data is retained per statutory requirements and shared only with authorized processors.",
    sortOrder: 5,
    status: "active",
    updatedAt: new Date(0).toISOString(),
  },
];

let cache: OnboardingPolicyDoc[] | null = null;
let loadPromise: Promise<OnboardingPolicyDoc[]> | null = null;
let persistQueue: Promise<void> = Promise.resolve();

function normalizePolicy(p: Partial<OnboardingPolicyDoc>): OnboardingPolicyDoc {
  return {
    id: String(p.id ?? ""),
    code: String(p.code ?? ""),
    title: String(p.title ?? ""),
    body: String(p.body ?? ""),
    fileName: p.fileName ? String(p.fileName) : undefined,
    fileDataUrl: p.fileDataUrl ? String(p.fileDataUrl) : undefined,
    mimeType: p.mimeType ? String(p.mimeType) : undefined,
    sortOrder: Number(p.sortOrder ?? 0),
    status: p.status === "inactive" ? "inactive" : "active",
    updatedAt: String(p.updatedAt ?? new Date().toISOString()),
  };
}

function sortPolicies(rows: OnboardingPolicyDoc[]): OnboardingPolicyDoc[] {
  return [...rows].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
  );
}

function readLocalStorageFallback(): OnboardingPolicyDoc[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingPolicyDoc[];
    if (!Array.isArray(parsed) || !parsed.length) return null;
    return sortPolicies(parsed.map((p) => normalizePolicy(p)));
  } catch {
    return null;
  }
}

function clearLocalStoragePolicies(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

async function loadFromStorage(): Promise<OnboardingPolicyDoc[]> {
  try {
    const fromIdb = await idbGetJson<OnboardingPolicyDoc[]>(STORAGE_KEY);
    if (Array.isArray(fromIdb) && fromIdb.length) {
      cache = sortPolicies(fromIdb.map((p) => normalizePolicy(p)));
      clearLocalStoragePolicies();
      return cache;
    }
  } catch {
    /* fall through */
  }

  const fromLs = readLocalStorageFallback();
  if (fromLs) {
    cache = fromLs;
    try {
      await idbSetJson(STORAGE_KEY, fromLs);
      clearLocalStoragePolicies();
    } catch {
      /* keep LS if IDB fails — may already be over quota */
    }
    return cache;
  }

  cache = DEFAULT_POLICIES.map((p) => ({ ...p }));
  try {
    await idbSetJson(STORAGE_KEY, cache);
  } catch {
    /* ignore */
  }
  clearLocalStoragePolicies();
  return cache;
}

/** Warm cache (safe to call multiple times). */
export function ensureOnboardingPoliciesLoaded(): Promise<OnboardingPolicyDoc[]> {
  if (cache) return Promise.resolve(cache);
  if (!loadPromise) loadPromise = loadFromStorage();
  return loadPromise;
}

function getAllSync(): OnboardingPolicyDoc[] {
  if (cache) return cache;
  const fromLs = readLocalStorageFallback();
  if (fromLs) {
    cache = fromLs;
    return cache;
  }
  return DEFAULT_POLICIES.map((p) => ({ ...p }));
}

function queuePersist(rows: OnboardingPolicyDoc[]): Promise<void> {
  persistQueue = persistQueue
    .then(async () => {
      await idbSetJson(STORAGE_KEY, rows);
      clearLocalStoragePolicies();
    })
    .catch((err) => {
      console.error("Failed to persist onboarding policies to IndexedDB", err);
      throw err;
    });
  return persistQueue;
}

export function listOnboardingPolicies(includeInactive = true): OnboardingPolicyDoc[] {
  const all = getAllSync();
  return includeInactive ? all.map((p) => ({ ...p })) : all.filter((p) => p.status === "active");
}

export function getOnboardingPolicy(id: string): OnboardingPolicyDoc | null {
  return getAllSync().find((p) => p.id === id) ?? null;
}

export async function saveOnboardingPolicy(
  input: Omit<OnboardingPolicyDoc, "updatedAt"> & { updatedAt?: string },
): Promise<OnboardingPolicyDoc> {
  await ensureOnboardingPoliciesLoaded();
  const all = [...(cache ?? getAllSync())];
  const next: OnboardingPolicyDoc = {
    ...input,
    title: input.title.trim() || "Untitled policy",
    body: (input.body ?? "").trim(),
    fileName: input.fileName || undefined,
    fileDataUrl: input.fileDataUrl || undefined,
    mimeType: input.mimeType || undefined,
    updatedAt: new Date().toISOString(),
  };
  const idx = all.findIndex((p) => p.id === next.id);
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  cache = sortPolicies(all);
  await queuePersist(cache);
  return next;
}

export async function deleteOnboardingPolicy(id: string): Promise<void> {
  await ensureOnboardingPoliciesLoaded();
  cache = sortPolicies((cache ?? getAllSync()).filter((p) => p.id !== id));
  await queuePersist(cache);
}

/** Shape used by the candidate portal (compatible with legacy POLICY_DOCS). */
export function listActivePoliciesForPortal(): PortalPolicyDoc[] {
  return listOnboardingPolicies(false).map((p) => ({
    id: p.id,
    label: p.title,
    body: p.body,
    fileName: p.fileName,
    fileDataUrl: p.fileDataUrl,
    mimeType: p.mimeType,
  }));
}

if (typeof window !== "undefined") {
  void ensureOnboardingPoliciesLoaded();
}
