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
} as const;
