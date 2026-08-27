import type { StoredOrgContext } from "@/types/org-context";

const SESSION_KEY = "erp_org_context_v1";
const LOCAL_KEY = "erp_org_context_local_v1";

function readKey(storage: Storage, key: string): StoredOrgContext | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredOrgContext;
    if (!parsed?.companyId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getStoredOrgContext(): StoredOrgContext | null {
  if (typeof window === "undefined") return null;
  // Prefer session (current tab), then local (survives new tabs / soft reopen)
  return (
    readKey(window.sessionStorage, SESSION_KEY) ||
    readKey(window.localStorage, LOCAL_KEY)
  );
}

export function setStoredOrgContext(ctx: StoredOrgContext): void {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify(ctx);
  try {
    window.sessionStorage.setItem(SESSION_KEY, payload);
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.setItem(LOCAL_KEY, payload);
  } catch {
    /* ignore */
  }
}

export function clearStoredOrgContext(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}
