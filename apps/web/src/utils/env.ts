/** Client-safe environment configuration with API URL fallback. */

const PRIMARY_API_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8000/api/v1";
const FALLBACK_API_URL =
  process.env.NEXT_PUBLIC_API_URL_FALLBACK?.trim() || "http://127.0.0.1:8000/api/v1";

const STORAGE_KEY = "erp.activeApiUrl";

function normalizeApiBase(url: string): string {
  return url.replace(/\/+$/, "");
}

function readStoredApiUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw?.trim() ? normalizeApiBase(raw) : null;
  } catch {
    return null;
  }
}

function storeApiUrl(url: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, normalizeApiBase(url));
  } catch {
    /* ignore quota / private mode */
  }
}

let activeApiUrl = normalizeApiBase(readStoredApiUrl() || PRIMARY_API_URL);
let resolveInFlight: Promise<string> | null = null;

function candidateApiUrls(): string[] {
  const primary = normalizeApiBase(PRIMARY_API_URL);
  const fallback = normalizeApiBase(FALLBACK_API_URL);
  const ordered = [activeApiUrl, primary, fallback];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of ordered) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

async function probeApiBase(base: string, timeoutMs = 2500): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve a reachable API base (primary first, then fallback). Cached for the tab. */
export async function resolveApiUrl(force = false): Promise<string> {
  if (typeof window === "undefined") {
    return normalizeApiBase(PRIMARY_API_URL);
  }
  if (!force && resolveInFlight) return resolveInFlight;

  resolveInFlight = (async () => {
    for (const base of candidateApiUrls()) {
      if (await probeApiBase(base)) {
        activeApiUrl = base;
        storeApiUrl(base);
        return base;
      }
    }
    // Keep last known / primary so callers still attempt a request.
    activeApiUrl = normalizeApiBase(PRIMARY_API_URL);
    return activeApiUrl;
  })();

  try {
    return await resolveInFlight;
  } finally {
    resolveInFlight = null;
  }
}

export function getApiUrl(): string {
  return activeApiUrl;
}

export function setApiUrl(url: string): void {
  activeApiUrl = normalizeApiBase(url);
  storeApiUrl(activeApiUrl);
}

export const env = {
  get apiUrl() {
    return activeApiUrl;
  },
  apiUrlPrimary: normalizeApiBase(PRIMARY_API_URL),
  apiUrlFallback: normalizeApiBase(FALLBACK_API_URL),
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Enterprise ERP",
  demoEmail: process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "admin@example.com",
  /** Shared default for every demo / module login account. */
  demoPassword: process.env.NEXT_PUBLIC_DEMO_PASSWORD || "Secure1!",
  /** ElevenLabs Convai widget (authenticated app shell only). */
  elevenlabsAgentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "",
};
