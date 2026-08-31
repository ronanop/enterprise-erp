/** Client-safe environment configuration. */

const defaultApiUrl =
  process.env.NODE_ENV === "development" ? "/api/v1" : "http://localhost:8000/api/v1";

export const env = {
  /** Same-origin `/api/v1` in dev (Next.js proxy) avoids browser CORS. Override with NEXT_PUBLIC_API_URL. */
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? defaultApiUrl,
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Enterprise ERP",
  demoEmail: process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "admin@example.com",
  /** Shared default for every demo / module login account. */
  demoPassword: process.env.NEXT_PUBLIC_DEMO_PASSWORD || "Secure1!",
  /** Optional public origin for invitation links (e.g. https://hr.example.com). */
  portalOrigin: (process.env.NEXT_PUBLIC_PORTAL_ORIGIN || "").replace(/\/$/, ""),
  /** Dev LAN origin injected by next.config (e.g. http://192.168.1.10:3000). */
  lanOrigin: (process.env.NEXT_PUBLIC_LAN_ORIGIN || "").replace(/\/$/, ""),
} as const;

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
