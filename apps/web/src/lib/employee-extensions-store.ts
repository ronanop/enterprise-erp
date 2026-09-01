import { idbGetJson, idbSetJson } from "@/lib/client-idb-json-store";
import type { EmployeeExtension } from "@/types/employee-management";
import { devError, devWarn } from "@/lib/dev-log";

export const EMPLOYEE_EXTENSIONS_STORAGE_KEY = "erp_employee_extensions_v1";

let cache: Record<string, EmployeeExtension> | null = null;
let loadPromise: Promise<Record<string, EmployeeExtension>> | null = null;
let persistQueue: Promise<void> = Promise.resolve();

function readLocalStorageFallback(): Record<string, EmployeeExtension> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(EMPLOYEE_EXTENSIONS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, EmployeeExtension>;
  } catch {
    return {};
  }
}

function clearLocalStorageExtensions(): void {
  try {
    localStorage.removeItem(EMPLOYEE_EXTENSIONS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

async function loadFromStorage(): Promise<Record<string, EmployeeExtension>> {
  try {
    const fromIdb = await idbGetJson<Record<string, EmployeeExtension>>(
      EMPLOYEE_EXTENSIONS_STORAGE_KEY,
    );
    if (fromIdb && typeof fromIdb === "object") {
      cache = fromIdb;
      clearLocalStorageExtensions();
      return cache;
    }
  } catch {
    /* fall through to localStorage */
  }

  const fromLs = readLocalStorageFallback();
  cache = fromLs;
  if (Object.keys(fromLs).length > 0) {
    try {
      await idbSetJson(EMPLOYEE_EXTENSIONS_STORAGE_KEY, fromLs);
      clearLocalStorageExtensions();
    } catch {
      /* keep localStorage copy if IDB fails */
    }
  }
  return cache;
}

/** Warm cache in the background (safe to call multiple times). */
export function ensureEmployeeExtensionsLoaded(): Promise<Record<string, EmployeeExtension>> {
  if (cache) return Promise.resolve(cache);
  if (!loadPromise) loadPromise = loadFromStorage();
  return loadPromise;
}

/** Sync read — uses cache when loaded, otherwise legacy localStorage. */
export function getEmployeeExtensionsSync(): Record<string, EmployeeExtension> {
  return cache ?? readLocalStorageFallback();
}

export function setEmployeeExtension(employeeId: string, ext: EmployeeExtension): void {
  if (!cache) cache = readLocalStorageFallback();
  cache[employeeId] = ext;

  persistQueue = persistQueue
    .then(async () => {
      const snapshot = cache ?? {};
      await idbSetJson(EMPLOYEE_EXTENSIONS_STORAGE_KEY, snapshot);
      clearLocalStorageExtensions();
    })
    .catch((err) => {
      devError("Failed to persist employee extensions to IndexedDB");
    });
}

/** Wipe all local employee extension overlays (after clear-all / re-import). */
export async function clearAllEmployeeExtensions(): Promise<void> {
  cache = {};
  clearLocalStorageExtensions();
  try {
    await idbSetJson(EMPLOYEE_EXTENSIONS_STORAGE_KEY, {});
  } catch {
    /* ignore */
  }
}

if (typeof window !== "undefined") {
  void ensureEmployeeExtensionsLoaded();
}
