import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import { essService } from "@/services/ess-service";
import { env } from "@/utils/env";

/**
 * Remote Android push was removed from Expo Go in SDK 53+ and throws in SDK 57.
 * Skip registration there so LogBox does not treat the library warning as a crash.
 * Use a development build (`npx expo run:android` / EAS) to test real push.
 */
function canRegisterRemotePush(): boolean {
  if (Platform.OS === "web") return false;
  return !(isRunningInExpoGo() && Platform.OS === "android");
}

async function ensureAlertChannel() {
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
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
      showBadge: true,
    });
  }
}

export function usePushRegistration(enabled: boolean) {
  const [registered, setRegistered] = useState(false);

  const register = useCallback(async () => {
    if (!enabled || !canRegisterRemotePush()) return;
    try {
      const Notifications = await import("expo-notifications");
      await ensureAlertChannel();

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
      if (finalStatus !== "granted") return;

      // Must match app.json → expo.extra.eas.projectId (EAS / Expo push).
      const projectId = "29a70c4a-fdf9-4483-b0cf-7ac1716d022d";
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      await essService.registerDeviceToken({
        token: tokenData.data,
        platform: Platform.OS === "ios" ? "ios" : "android",
      });
      setRegistered(true);
    } catch {
      // Missing projectId / native module - ignore in Phase 1
      if (env.useMock) setRegistered(true);
    }
  }, [enabled]);

  useEffect(() => {
    void register();
  }, [register]);

  return { registered };
}
