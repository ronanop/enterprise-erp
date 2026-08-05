/** Client-safe environment configuration. */

function resolveApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return "/api/v1";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw.replace(/\/$/, "");
  }
  const relative = raw.startsWith("/") ? raw : `/${raw}`;
  const trimmed = relative.replace(/\/$/, "");
  return trimmed || "/api/v1";
}

export const env = {
  apiUrl: resolveApiUrl(),
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Enterprise ERP",
  demoEmail: process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "admin@example.com",
  /** Shared default for every demo / module login account. */
  demoPassword: process.env.NEXT_PUBLIC_DEMO_PASSWORD || "Secure1!",
} as const;
