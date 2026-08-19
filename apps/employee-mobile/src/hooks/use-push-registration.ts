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

export function usePushRegistration(enabled: boolean) {
  const [registered, setRegistered] = useState(false);

  const register = useCallback(async () => {
    if (!enabled || !canRegisterRemotePush()) return;
    try {
      // Dynamic import avoids Expo Go's import-time push warning on Android.
      const Notifications = await import("expo-notifications");

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: true,
        }),
      });

      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") return;

      const tokenData = await Notifications.getExpoPushTokenAsync();
      await essService.registerDeviceToken({
        token: tokenData.data,
        platform: Platform.OS === "ios" ? "ios" : "android",
      });
      setRegistered(true);
    } catch {
      // Missing projectId / native module — ignore in Phase 1
      if (env.useMock) setRegistered(true);
    }
  }, [enabled]);

  useEffect(() => {
    void register();
  }, [register]);

  return { registered };
}
