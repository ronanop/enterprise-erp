/**
 * Single public ESS backend — no local / Render / alternate hosts.
 */
export const ESS_API_BASE = "https://ess-api.iconnectplus.in/api/v1";
export const ESS_API_HEALTH = `${ESS_API_BASE}/health`;

export const env = {
  apiUrl: ESS_API_BASE,
  healthUrl: ESS_API_HEALTH,
  appName: process.env.EXPO_PUBLIC_APP_NAME ?? "iConnect+",
  useMock: false,
  privacyPolicyUrl:
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ??
    "https://iconnectplus.in/legal/privacy",
  termsUrl:
    process.env.EXPO_PUBLIC_TERMS_URL ?? "https://iconnectplus.in/legal/terms",
  dataDeletionUrl:
    process.env.EXPO_PUBLIC_DATA_DELETION_URL ??
    "https://iconnectplus.in/legal/data-deletion",
  supportEmail:
    process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "erp@iconnectplus.in",
} as const;
