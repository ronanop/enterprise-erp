import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useAuth } from "@/context/auth-context";
import {
  isBiometricUnlockEnabled,
  isSessionUnlocked,
} from "@/lib/biometric";
import { isOnboardingComplete } from "@/lib/onboarding";
import { colors } from "@/theme/colors";

const SPLASH_MS = 3200;
let hasSeenSplashThisSession = false;

const BG = colors.background;
/** Fade target must carry the bg channels so Android does not fade through black. */
const BG_CLEAR = "rgba(248, 249, 255, 0)";

/** Radial fill stands in for the PWA's `blur-[90px]` blobs. */
function SoftBlob({
  id,
  size,
  color,
  opacity,
  style,
}: {
  id: string;
  size: number;
  color: string;
  opacity: number;
  style?: ViewStyle;
}) {
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
            <Stop offset="45%" stopColor={color} stopOpacity={opacity * 0.6} />
            <Stop offset="75%" stopColor={color} stopOpacity={opacity * 0.2} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

function useLoop(duration: number, delay = 0) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: duration / 2,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, duration, value]);

  return value;
}

function useFadeUp(delay: number) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(value, {
      toValue: 1,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, value]);

  return {
    opacity: value,
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  };
}

export default function SplashScreen() {
  const router = useRouter();
  const { status } = useAuth();
  const [message, setMessage] = useState("Preparing your workspace...");

  const float = useLoop(6000);
  const blobA = useLoop(10000);
  const blobB = useLoop(14000, 600);
  const pulse = useLoop(2000);
  const titleFade = useFadeUp(120);
  const pillFade = useFadeUp(280);

  useEffect(() => {
    if (status === "loading") return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    async function getNextRoute(): Promise<Href> {
      if (!(await isOnboardingComplete())) return "/onboarding";
      if (status === "signedOut") return "/login";
      const biometricsEnabled = await isBiometricUnlockEnabled();
      return biometricsEnabled && !isSessionUnlocked() ? "/lock" : "/(tabs)/home";
    }

    void getNextRoute()
      .catch(() => "/login" as Href)
      .then((route) => {
        if (cancelled) return;
        if (hasSeenSplashThisSession) {
          router.replace(route);
          return;
        }

        timers.push(
          setTimeout(() => {
            if (!cancelled) setMessage("Almost ready...");
          }, 2200),
          setTimeout(() => {
            if (cancelled) return;
            hasSeenSplashThisSession = true;
            router.replace(route);
          }, SPLASH_MS),
        );
      });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [router, status]);

  const heroLift = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -14],
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <View style={styles.container}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.blobBlue,
            {
              transform: [
                {
                  translateX: blobA.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 12],
                  }),
                },
                {
                  translateY: blobA.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -18],
                  }),
                },
              ],
            },
          ]}
        >
          <SoftBlob id="splashBlue" size={460} color="#2563eb" opacity={0.14} />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.blobIndigo,
            {
              transform: [
                {
                  translateX: blobB.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -12],
                  }),
                },
                {
                  translateY: blobB.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 18],
                  }),
                },
              ],
            },
          ]}
        >
          <SoftBlob id="splashIndigo" size={512} color="#6366f1" opacity={0.13} />
        </Animated.View>

        <View pointerEvents="none" style={styles.blobPurple}>
          <SoftBlob id="splashPurple" size={410} color="#7c3aed" opacity={0.09} />
        </View>

        <View style={styles.topSpacer} />

        <View style={styles.heroArea}>
          <View pointerEvents="none" style={styles.heroGlow}>
            <SoftBlob id="splashHeroGlow" size={360} color="#2563eb" opacity={0.12} />
          </View>

          <Animated.View
            style={[styles.heroFrame, { transform: [{ translateY: heroLift }] }]}
          >
            <Image
              source={require("../assets/images/splash-cinematic-hero.png")}
              style={styles.heroImage}
              resizeMode="cover"
              accessibilityLabel="Employee Portal AI workspace"
            />
            <LinearGradient
              pointerEvents="none"
              colors={[BG, BG_CLEAR]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.featherLeft}
            />
            <LinearGradient
              pointerEvents="none"
              colors={[BG_CLEAR, BG]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.featherRight}
            />
            <LinearGradient
              pointerEvents="none"
              colors={[BG, BG_CLEAR]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.featherTop}
            />
            <LinearGradient
              pointerEvents="none"
              colors={[BG_CLEAR, BG]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.featherBottom}
            />
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <Animated.View style={titleFade}>
            <Text style={styles.title}>Employee Portal AI</Text>
            <Text style={styles.subtitle}>Everything for Work</Text>
          </Animated.View>

          <Animated.View style={[styles.pillWrap, pillFade]}>
            <View style={styles.statusPill}>
              <View style={styles.statusDotWrap}>
                <Animated.View
                  style={[
                    styles.statusRing,
                    {
                      opacity: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.45, 0],
                      }),
                      transform: [
                        {
                          scale: pulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 2.6],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.statusDot,
                    {
                      opacity: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.6, 1],
                      }),
                      transform: [
                        {
                          scale: pulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.95, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>
              <Text style={styles.statusText}>{message}</Text>
            </View>
          </Animated.View>
        </View>

        <LinearGradient
          pointerEvents="none"
          colors={[BG_CLEAR, BG]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.pageFade}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: BG,
  },
  blobBlue: { position: "absolute", left: -150, top: -46 },
  blobIndigo: { position: "absolute", right: -136, top: 64 },
  blobPurple: { position: "absolute", left: "33%", marginLeft: -77, bottom: 19 },
  topSpacer: { height: 24 },
  heroArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroGlow: { position: "absolute" },
  heroFrame: {
    flex: 1,
    alignSelf: "stretch",
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  featherLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "12%",
  },
  featherRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "12%",
  },
  featherTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "14%",
  },
  featherBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "22%",
  },
  footer: {
    zIndex: 20,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 40,
  },
  title: {
    color: colors.onSurface,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    color: "rgba(67, 70, 85, 0.8)",
    fontSize: 16,
    textAlign: "center",
  },
  pillWrap: { marginTop: 28 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    shadowColor: "#2563eb",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  statusDotWrap: {
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusRing: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2563eb",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2563eb",
  },
  statusText: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  pageFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "33%",
    zIndex: 5,
  },
});
