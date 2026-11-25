import { Linking, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { requestAndEnableBiometricUnlock } from "@/lib/biometric";

export type PermissionSnapshot = {
  location: boolean;
  camera: boolean;
  photos: boolean;
  notifications: boolean;
  /** Fingerprint / Face ID / device screen lock (PIN, pattern, password). */
  deviceUnlock: boolean;
};

/**
 * Request OS permissions after an in-app rationale screen.
 *
 * Store-aligned rules:
 * - Location / camera are also re-requested at feature time (punch, selfie, scan).
 * - Photos use the system picker (expo-image-picker) — no broad READ_MEDIA_* access.
 * - Notifications: sound + lock-screen visibility via the Android channel config.
 * - Device unlock: Face ID / fingerprint / screen lock via LocalAuthentication
 *   (iOS Face ID permission dialog appears on first authenticate call).
 */
export async function requestEssentialPermissions(): Promise<PermissionSnapshot> {
  if (Platform.OS === "web") {
    return {
      location: false,
      camera: false,
      photos: false,
      notifications: false,
      deviceUnlock: false,
    };
  }

  const location = await Location.requestForegroundPermissionsAsync();
  const camera = await ImagePicker.requestCameraPermissionsAsync();
  // Media library prompt only when the OS still requires it for the picker;
  // Android 13+ photo picker often needs no broad gallery permission.
  const photos = await ImagePicker.requestMediaLibraryPermissionsAsync();
  const notifications = await requestNotificationPermissions();
  const deviceUnlock = await requestAndEnableBiometricUnlock();

  return {
    location: location.status === "granted",
    camera: camera.status === "granted",
    photos: photos.status === "granted",
    notifications,
    deviceUnlock,
  };
}

export async function openSystemAppSettings(): Promise<void> {
  await Linking.openSettings();
}

async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const Notifications = await import("expo-notifications");

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("ess-alerts", {
        name: "Employee alerts",
        description: "Attendance, leave, approvals, and workplace alerts",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        enableVibrate: true,
        enableLights: true,
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
        showBadge: true,
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowDisplayInCarPlay: false,
          allowCriticalAlerts: false,
          provideAppNotificationSettings: true,
          allowProvisional: false,
        },
      });
      finalStatus = status;
    }
    return finalStatus === "granted";
  } catch {
    return false;
  }
}
