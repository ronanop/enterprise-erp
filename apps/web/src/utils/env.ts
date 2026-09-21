/** Client-safe environment configuration. */

function resolveApiUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? "/api/v1").trim().replace(/\/$/, "");
  // Windows often resolves `localhost` to IPv6 (::1). Uvicorn binds IPv4 only
  // when started with --host 0.0.0.0, so force IPv4 for absolute URLs.
  return raw.replace(/:\/\/localhost(?=[:/]|$)/, "://127.0.0.1");
}

export const env = {
  apiUrl: resolveApiUrl(),
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Enterprise ERP",
  demoEmail: process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "admin@example.com",
  /** Shared default for every demo / module login account. */
  demoPassword: process.env.NEXT_PUBLIC_DEMO_PASSWORD || "Secure1!",
} as const;
