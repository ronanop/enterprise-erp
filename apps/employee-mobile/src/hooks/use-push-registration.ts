import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { essService } from "@/services/ess-service";
import { env } from "@/utils/env";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export function usePushRegistration(enabled: boolean) {
  const [registered, setRegistered] = useState(false);

  const register = useCallback(async () => {
    if (!enabled || Platform.OS === "web") return;
    try {
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
      // Expo Go / missing projectId — ignore in Phase 1
      if (env.useMock) setRegistered(true);
    }
  }, [enabled]);

  useEffect(() => {
    void register();
  }, [register]);

  return { registered };
}
