import type { StoredOrgContext } from "@/types/org-context";

const KEY = "erp_org_context_v1";

export function getStoredOrgContext(): StoredOrgContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredOrgContext;
  } catch {
    return null;
  }
}

export function setStoredOrgContext(ctx: StoredOrgContext): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(ctx));
}

export function clearStoredOrgContext(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}
