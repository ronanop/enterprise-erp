/** Client-safe environment configuration with API URL fallback. */

function browserSameOriginApi(): string | null {
  if (typeof window === "undefined") return null;
  // Prefer same-origin relative API so private IPs are not baked into the bundle.
  return `${window.location.origin}/api/v1`;
}

const BUILD_API_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || "";
const BUILD_FALLBACK_URL =
  process.env.NEXT_PUBLIC_API_URL_FALLBACK?.trim() || "http://127.0.0.1:8000/api/v1";

/** Prefer relative /api/v1 in production builds to avoid IP disclosure in JS bundles. */
const PRIMARY_API_URL =
  BUILD_API_URL && !/172\.\d+\.\d+\.\d+|192\.168\.|10\.\d+\./.test(BUILD_API_URL)
    ? BUILD_API_URL
    : BUILD_API_URL.startsWith("/")
      ? BUILD_API_URL
      : typeof window !== "undefined"
        ? `${window.location.origin}/api/v1`
        : BUILD_API_URL || "/api/v1";

const FALLBACK_API_URL = BUILD_FALLBACK_URL;

const STORAGE_KEY = "erp.activeApiUrl";

function normalizeApiBase(url: string): string {
  if (!url) return "/api/v1";
  // Support relative bases like "/api/v1"
  if (url.startsWith("/")) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${url.replace(/\/+$/, "")}`;
    }
    return url.replace(/\/+$/, "");
  }
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

let activeApiUrl = normalizeApiBase(
  readStoredApiUrl() || browserSameOriginApi() || PRIMARY_API_URL,
);
let resolveInFlight: Promise<string> | null = null;

function candidateApiUrls(): string[] {
  const sameOrigin = browserSameOriginApi();
  const primary = normalizeApiBase(PRIMARY_API_URL);
  const fallback = normalizeApiBase(FALLBACK_API_URL);
  const ordered = [activeApiUrl, sameOrigin, primary, fallback].filter(Boolean) as string[];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of ordered) {
    if (!url || seen.has(url)) continue;
    // Skip private-IP candidates in the browser when same-origin works.
    if (
      typeof window !== "undefined" &&
      /172\.\d+\.\d+\.\d+|192\.168\.|10\.\d+\./.test(url) &&
      sameOrigin
    ) {
      continue;
    }
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
    // Keep last known / same-origin so callers still attempt a request.
    activeApiUrl = normalizeApiBase(browserSameOriginApi() || PRIMARY_API_URL);
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
  /** Optional public origin for invitation links (e.g. https://hr.example.com). */
  portalOrigin: (process.env.NEXT_PUBLIC_PORTAL_ORIGIN || "").replace(/\/$/, ""),
  /** Dev LAN origin injected by next.config (e.g. http://192.168.1.10:3000). */
  lanOrigin: (process.env.NEXT_PUBLIC_LAN_ORIGIN || "").replace(/\/$/, ""),
};

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}

/**
 * Origin for copied / emailed onboarding links.
 * When HR is on localhost, swap in the LAN IP so a phone on the same network can open it.
 */
export function getShareableOrigin(): string {
  if (env.portalOrigin) return env.portalOrigin;
  if (typeof window === "undefined") return env.lanOrigin;
  if (isLoopbackHost(window.location.hostname) && env.lanOrigin) return env.lanOrigin;
  return window.location.origin;
}
