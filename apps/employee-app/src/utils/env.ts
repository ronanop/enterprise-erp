export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Employee App",
  /** When true, app uses in-memory demo data (no ERP API required). Default false for production ESS. */
  useMock: (process.env.NEXT_PUBLIC_USE_MOCK ?? "false").toLowerCase() === "true",
} as const;
