/**
 * Mobile env - use absolute API URL (no Next.js proxy).
 * Default mock mode so Phase 0 runs without a backend.
 */
export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1",
  appName: process.env.EXPO_PUBLIC_APP_NAME ?? "Employee Portal",
  /** Default false to match web ESS production behavior. */
  useMock:
    (process.env.EXPO_PUBLIC_USE_MOCK ?? "false").toLowerCase() === "true",
  /** Temporary: salary screens can use rich mock slips for UI review. */
  usePayslipMock:
    (process.env.EXPO_PUBLIC_PAYSLIP_MOCK ?? "false").toLowerCase() === "true",
} as const;
