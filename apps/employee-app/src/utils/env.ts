export const env = {
  /** Use `/api/v1` in dev (proxied to ERP via next.config rewrites) or full URL in production. */
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "/api/v1",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Employee App",
  /** When true, app uses in-memory demo data (no ERP API required). Default false for production ESS. */
  useMock: (process.env.NEXT_PUBLIC_USE_MOCK ?? "false").toLowerCase() === "true",
  /**
   * Temporary: salary/payslip screens use rich mock slips for UI review.
   * Set NEXT_PUBLIC_PAYSLIP_MOCK=false to use live ESS payslips.
   */
  usePayslipMock:
    (process.env.NEXT_PUBLIC_PAYSLIP_MOCK ?? "true").toLowerCase() === "true",
  /**
   * One-click Demo Employee / Demo Manager buttons on /login.
   * Set NEXT_PUBLIC_SHOW_DEMO_LOGIN=false to hide in shared environments.
   */
  showDemoLogin:
    (process.env.NEXT_PUBLIC_SHOW_DEMO_LOGIN ?? "true").toLowerCase() === "true",
} as const;
