/**
 * Mobile env — use absolute API URL (no Next.js proxy).
 * Default mock mode so Phase 0 runs without a backend.
 */
export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1",
  appName: process.env.EXPO_PUBLIC_APP_NAME ?? "Employee Portal",
  useMock:
    (process.env.EXPO_PUBLIC_USE_MOCK ?? "true").toLowerCase() === "true",
} as const;
