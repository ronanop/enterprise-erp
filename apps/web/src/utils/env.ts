/** Client-safe environment configuration. */

export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Enterprise ERP",
  demoEmail: process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "admin@example.com",
  /** Shared default for every demo / module login account. */
  demoPassword: process.env.NEXT_PUBLIC_DEMO_PASSWORD || "Secure1!",
} as const;
