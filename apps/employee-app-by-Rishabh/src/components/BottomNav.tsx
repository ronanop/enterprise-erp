import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import type { BottomTabBarProps } from "expo-router/tabs";
import {
  IconCalendar,
  IconFeed,
  IconFingerprint,
  IconHome,
  IconHub,
  IconTask,
  IconUser,
  IconWallet,
  type IconProps,
} from "@/components/icons";
import { colors } from "@/theme/colors";

/** RN-web does not export useReducedMotion — match media safely. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);
  return reduced;
}

const TAB_ORDER = ["feed", "task", "attendance", "hub", "profile"] as const;

const ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  feed: IconFeed,
  attendance: IconFingerprint,
  task: IconTask,
  hub: IconHub,
  profile: IconUser,
  home: IconHome,
  leave: IconCalendar,
  payslips: IconWallet,
};

const LABELS: Record<string, string> = {
  feed: "Feed",
  attendance: "Attendance",
  task: "Task",
  hub: "Hub",
  profile: "Profile",
};

const ACTIVE = colors.primary;
const IDLE = "rgba(67,70,85,0.55)";
const PILL_PAD_X = 6;
const INDICATOR_INSET = 4;

/**
 * Instagram-style floating pill dock.
 * Indicator uses equal-width slots + translateX only (native driver) to avoid width/layout jitter.
 */
export function BottomNav({
  state,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  const reduceMotion = usePrefersReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const settledIndex = useRef(-1);

  const visibleRoutes = useMemo(
    () =>
      TAB_ORDER.map((name) =>
        state.routes.find((route) => route.name === name),
      ).filter((route): route is (typeof state.routes)[number] => Boolean(route)),
    [state.routes],
  );

  const activeRoute = state.routes[state.index];
  const activeName = activeRoute?.name ?? visibleRoutes[0]?.name;
  const activeIndex = Math.max(
    0,
    visibleRoutes.findIndex((r) => r.name === activeName),
  );
  const slotCount = Math.max(1, visibleRoutes.length);
  const slotWidth =
    trackWidth > 0 ? (trackWidth - PILL_PAD_X * 2) / slotCount : 0;
  const indicatorWidth = Math.max(0, slotWidth - INDICATOR_INSET * 2);

  useEffect(() => {
    if (slotWidth <= 0) return;
    const target = PILL_PAD_X + activeIndex * slotWidth + INDICATOR_INSET;
    if (reduceMotion) {
      indicatorX.setValue(target);
      settledIndex.current = activeIndex;
      return;
    }
    // First layout: place without animation so the blob isn't off-screen.
    if (settledIndex.current < 0) {
      indicatorX.setValue(target);
      settledIndex.current = activeIndex;
      return;
    }
    // Same tab (e.g. resize) — snap without restarting a spring.
    if (settledIndex.current === activeIndex) {
      indicatorX.setValue(target);
      return;
    }
    settledIndex.current = activeIndex;
    Animated.spring(indicatorX, {
      toValue: target,
      useNativeDriver: true,
      friction: 8,
      tension: 140,
      overshootClamping: true,
      restDisplacementThreshold: 0.2,
      restSpeedThreshold: 0.2,
    }).start();
  }, [activeIndex, indicatorX, reduceMotion, slotWidth]);

  function onTrackLayout(event: LayoutChangeEvent) {
    const w = event.nativeEvent.layout.width;
    setTrackWidth((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingBottom: Math.max(12, insets.bottom || 12) },
      ]}
    >
      <View
        style={styles.pill}
        accessibilityRole="tablist"
        onLayout={onTrackLayout}
      >
        {indicatorWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              {
                width: indicatorWidth,
                transform: [{ translateX: indicatorX }],
              },
            ]}
          />
        ) : null}

        {visibleRoutes.map((route) => {
          const Icon = ICONS[route.name];
          if (!Icon) return null;

          const focused = route.key === activeRoute?.key;
          const color = focused ? ACTIVE : IDLE;

          function onPress() {
            const event = emitter.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigateToTab(route.key);
            }
          }

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={LABELS[route.name]}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tab,
                pressed ? styles.tabPressed : null,
              ]}
            >
              <View style={styles.iconWell}>
                <Icon size={24} color={color} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 6,
    backgroundColor: "transparent",
    zIndex: 50,
  },
  pill: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    maxWidth: 420,
    height: 56,
    paddingHorizontal: PILL_PAD_X,
    borderRadius: 999,
    backgroundColor: colors.surfaceLowest,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(195,198,215,0.65)",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#0b1c30",
        shadowOpacity: 0.14,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow:
          "0 12px 32px rgba(11,28,48,0.12), 0 2px 8px rgba(0,74,198,0.06)",
        backgroundColor: colors.surfaceLowest,
      } as object,
      default: {},
    }),
  },
  indicator: {
    position: "absolute",
    top: INDICATOR_INSET,
    bottom: INDICATOR_INSET,
    left: 0,
    borderRadius: 999,
    backgroundColor: "rgba(0,74,198,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,74,198,0.16)",
    zIndex: 0,
  },
  tab: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
    ...Platform.select({
      web: {
        cursor: "pointer",
        // Prevent press opacity flicker fighting the spring
        transitionProperty: "opacity",
        transitionDuration: "120ms",
      } as object,
      default: {},
    }),
  },
  tabPressed: {
    opacity: 0.72,
  },
  iconWell: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
});
