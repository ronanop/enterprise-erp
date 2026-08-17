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

export async function getBiometricCapability(): Promise<{
  hardware: boolean;
  enrolled: boolean;
  label: string;
}> {
  if (Platform.OS === "web") {
    return { hardware: false, enrolled: false, label: "Biometrics" };
  }
  const hardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = hardware
    ? await LocalAuthentication.isEnrolledAsync()
    : false;
  const types = hardware
    ? await LocalAuthentication.supportedAuthenticationTypesAsync()
    : [];
  const hasFace = types.includes(
    LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
  );
  const hasFingerprint = types.includes(
    LocalAuthentication.AuthenticationType.FINGERPRINT,
  );
  let label = "Biometrics";
  if (hasFace && hasFingerprint) label = "Face ID / Fingerprint";
  else if (hasFace) label = Platform.OS === "ios" ? "Face ID" : "Face unlock";
  else if (hasFingerprint) {
    label = Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
  }
  return { hardware, enrolled, label };
}

export async function authenticateWithBiometrics(
  promptMessage = "Unlock Employee Portal",
): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });
  return result.success;
}
