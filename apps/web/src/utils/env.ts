/** Client-safe environment configuration for the configured API base. */

function browserSameOriginApi(): string | null {
  if (typeof window === "undefined") return null;
  // Prefer same-origin relative API so private IPs are not baked into the bundle.
  return `${window.location.origin}/api/v1`;
}

const BUILD_API_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || "";

/** Prefer relative /api/v1 in production builds to avoid IP disclosure in JS bundles. */
const PRIMARY_API_URL =
  BUILD_API_URL && !/172\.\d+\.\d+\.\d+|192\.168\.|10\.\d+\./.test(BUILD_API_URL)
    ? BUILD_API_URL
    : BUILD_API_URL.startsWith("/")
      ? BUILD_API_URL
      : typeof window !== "undefined"
        ? `${window.location.origin}/api/v1`
        : BUILD_API_URL || "/api/v1";

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

function configuredApiBase(): string {
  return normalizeApiBase(browserSameOriginApi() || PRIMARY_API_URL);
}

let activeApiUrl = normalizeApiBase(readStoredApiUrl() || configuredApiBase());

/** Resolve the configured API base (no alternate host failover). */
export async function resolveApiUrl(_force = false): Promise<string> {
  activeApiUrl = configuredApiBase();
  storeApiUrl(activeApiUrl);
  return activeApiUrl;
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
