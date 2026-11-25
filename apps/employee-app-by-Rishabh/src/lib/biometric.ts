import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

const BIOMETRIC_KEY = "ess_biometric_unlock_v1";

let sessionUnlocked = false;

export function isSessionUnlocked(): boolean {
  return sessionUnlocked;
}

export function markSessionUnlocked(): void {
  sessionUnlocked = true;
}

export function clearSessionUnlock(): void {
  sessionUnlocked = false;
}

export async function isBiometricUnlockEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(BIOMETRIC_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setBiometricUnlockEnabled(
  enabled: boolean,
): Promise<void> {
  if (enabled) {
    await AsyncStorage.setItem(BIOMETRIC_KEY, "1");
  } else {
    await AsyncStorage.removeItem(BIOMETRIC_KEY);
  }
}

export type BiometricCapability = {
  hardware: boolean;
  enrolled: boolean;
  /** True when fingerprint, Face ID/face unlock, or device PIN/pattern can unlock. */
  available: boolean;
  hasBiometrics: boolean;
  hasDeviceCredential: boolean;
  label: string;
};

export async function getBiometricCapability(): Promise<BiometricCapability> {
  if (Platform.OS === "web") {
    return {
      hardware: false,
      enrolled: false,
      available: false,
      hasBiometrics: false,
      hasDeviceCredential: false,
      label: "Device lock",
    };
  }

  const hardware = await LocalAuthentication.hasHardwareAsync();
  const types = hardware
    ? await LocalAuthentication.supportedAuthenticationTypesAsync()
    : [];
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  const hasDeviceCredential =
    level >= LocalAuthentication.SecurityLevel.SECRET;
  const biometricsEnrolled =
    level >= LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK;
  const hasFace = types.includes(
    LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
  );
  const hasFingerprint = types.includes(
    LocalAuthentication.AuthenticationType.FINGERPRINT,
  );
  const hasBiometrics = biometricsEnrolled && (hasFace || hasFingerprint || hardware);

  const parts: string[] = [];
  if (hasFingerprint) {
    parts.push(Platform.OS === "ios" ? "Touch ID" : "Fingerprint");
  }
  if (hasFace) {
    parts.push(Platform.OS === "ios" ? "Face ID" : "Face unlock");
  }
  if (hasDeviceCredential) {
    parts.push("Screen lock");
  }
  const label =
    parts.length > 0
      ? parts.join(" / ")
      : Platform.OS === "ios"
        ? "Face ID / Screen lock"
        : "Fingerprint / Screen lock";

  const enrolled = hasBiometrics || hasDeviceCredential;
  return {
    hardware,
    enrolled,
    available: enrolled,
    hasBiometrics,
    hasDeviceCredential,
    label,
  };
}

/**
 * Shows the OS biometric / screen-lock prompt.
 * `disableDeviceFallback: false` allows PIN, pattern, or password when biometrics fail or are unavailable.
 * First Face ID use on iOS also triggers the Face ID permission dialog (NSFaceIDUsageDescription).
 */
export async function authenticateWithBiometrics(
  promptMessage = "Unlock Employee Portal",
): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "Cancel",
    fallbackLabel: "Use screen lock",
    disableDeviceFallback: false,
    requireConfirmation: false,
  });
  return result.success;
}

/**
 * Permission-style ask: OS prompt for fingerprint / Face ID / screen lock,
 * then enable app unlock if the user authenticates successfully.
 */
export async function requestAndEnableBiometricUnlock(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const cap = await getBiometricCapability();
  if (!cap.available) return false;

  const ok = await authenticateWithBiometrics(
    `Allow ${cap.label} to protect this app`,
  );
  if (!ok) return false;

  await setBiometricUnlockEnabled(true);
  markSessionUnlocked();
  return true;
}
