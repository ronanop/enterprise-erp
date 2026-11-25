import { Platform } from "react-native";

/**
 * Mobile env - use absolute API URL (no Next.js proxy).
 * Browser preview on the dev PC can use a loopback URL via EXPO_PUBLIC_API_URL_WEB,
 * while a physical phone needs the PC's LAN IP in EXPO_PUBLIC_API_URL.
 */
const nativeApiUrl =
  process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";

export const env = {
  apiUrl:
    Platform.OS === "web"
      ? (process.env.EXPO_PUBLIC_API_URL_WEB ?? nativeApiUrl)
      : nativeApiUrl,
  appName: process.env.EXPO_PUBLIC_APP_NAME ?? "Employee App",
  useMock:
    (process.env.EXPO_PUBLIC_USE_MOCK ?? "false").toLowerCase() === "true",
  /** Required for App Store / Play listings — host a real policy page before release. */
  privacyPolicyUrl:
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ??
    "https://iconnectplus.in/legal/privacy",
  termsUrl:
    process.env.EXPO_PUBLIC_TERMS_URL ?? "https://iconnectplus.in/legal/terms",
  /** Web path for account/data deletion requests (Play + Apple). */
  dataDeletionUrl:
    process.env.EXPO_PUBLIC_DATA_DELETION_URL ??
    "https://iconnectplus.in/legal/data-deletion",
  supportEmail:
    process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "erp@iconnectplus.in",
} as const;
