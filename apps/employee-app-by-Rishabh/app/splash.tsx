import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandMark } from "@/components/brand-mark";
import { useAuth } from "@/context/auth-context";
import {
  isBiometricUnlockEnabled,
  isSessionUnlocked,
} from "@/lib/biometric";
import { colors } from "@/theme/colors";

const SPLASH_MS = 1400;
const APP_DISPLAY_NAME = "iConnect Plus";

/** Simple branded splash → login (or resume session). */
export default function SplashScreen() {
  const router = useRouter();
  const { status, me } = useAuth();

  useEffect(() => {
    if (status === "loading") return;

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      void (async () => {
        let next: Href = "/login";
        if (status === "signedIn") {
          if (me?.must_change_password) {
            next = "/force-change-password";
          } else {
            const biometricsEnabled = await isBiometricUnlockEnabled();
            next =
              biometricsEnabled && !isSessionUnlocked()
                ? "/lock"
                : "/(tabs)/feed";
          }
        }
        router.replace(next);
      })();
    }, SPLASH_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status, me, router]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <View style={styles.center}>
        <BrandMark size={88} />
        <Text style={styles.name}>{APP_DISPLAY_NAME}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  name: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.onSurface,
  },
});
