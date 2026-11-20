import { LinearGradient } from "expo-linear-gradient";
import { usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import {
  IconCalendar,
  IconFingerprint,
  IconHome,
  IconUser,
  IconWallet,
  type IconProps,
} from "@/components/icons";

/** Matches Expo Router SDK 58+ custom tabBar props (no `navigation` object). */
type TabBarProps = {
  state: {
    index: number;
    routes: readonly { key: string; name: string }[];
  };
  emitter: {
    emit: (event: {
      type: "tabPress";
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
  };
  navigateToTab: (routeKey: string) => void;
  insets?: { top: number; right: number; bottom: number; left: number };
};

type TabIcon = (p: IconProps) => React.ReactElement;

const ACTIVE = "#2563EB";
const INACTIVE = "#8B95A8";
const ATTENDANCE = "attendance";

/** PWA order: Home · Leave · Attendance (center) · Salary · Profile */
const TAB_ORDER = ["home", "leave", "attendance", "payslips", "profile"] as const;

const ICONS: Record<string, TabIcon> = {
  home: IconHome,
  leave: IconCalendar,
  attendance: IconFingerprint,
  payslips: IconWallet,
  profile: IconUser,
};

const LABELS: Record<string, string> = {
  home: "Home",
  leave: "Leave",
  attendance: "Attendance",
  payslips: "Salary",
  profile: "Profile",
};

const DOCK_HEIGHT = 76;
const FAB_SIZE = 56;

/** Smooth floating dock path with a fixed center well under Attendance. */
function curvedDockPath(notchX: number): string {
  const barLeft = 14;
  const barRight = 376;
  const topY = 0;
  const wellDepth = 40;
  const corner = 20;
  const wellHalf = 40;

  let wellLeft = notchX - wellHalf;
  let wellRight = notchX + wellHalf;
  const minFlat = barLeft + corner + 6;
  const maxFlat = barRight - corner - 6;
  wellLeft = Math.max(wellLeft, minFlat - 4);
  wellRight = Math.min(wellRight, maxFlat + 4);

  const cx = (wellLeft + wellRight) / 2;

  return `
    M ${barLeft} ${corner}
    C ${barLeft} ${corner * 0.4} ${barLeft + corner * 0.4} ${topY} ${barLeft + corner} ${topY}
    L ${Math.max(barLeft + corner, wellLeft - 8)} ${topY}
    C ${wellLeft} ${topY} ${wellLeft + 8} 9 ${wellLeft + 14} 17
    C ${wellLeft + 24} 31 ${cx - 12} ${wellDepth} ${cx} ${wellDepth}
    C ${cx + 12} ${wellDepth} ${wellRight - 24} 31 ${wellRight - 14} 17
    C ${wellRight - 8} 9 ${wellRight} ${topY} ${Math.min(barRight - corner, wellRight + 8)} ${topY}
    L ${barRight - corner} ${topY}
    C ${barRight - corner * 0.4} ${topY} ${barRight} ${corner * 0.4} ${barRight} ${corner}
    L ${barRight} 56
    C ${barRight} 68 ${barRight - 12} 76 ${barRight - 24} 76
    L ${barLeft + 24} 76
    C ${barLeft + 12} 76 ${barLeft} 68 ${barLeft} 56
    Z
  `;
}

const DOCK_PATH = curvedDockPath(195);

/**
 * PWA-matching bottom dock: curved white bar, center Attendance FAB,
 * side tabs with active blue / idle grey.
 */
export function BottomNav({
  state,
  emitter,
  navigateToTab,
  insets: propsInsets,
}: TabBarProps) {
  const safeInsets = useSafeAreaInsets();
  const insets = propsInsets ?? safeInsets;
  const pathname = usePathname();

  if (
    pathname.includes("/compliance") ||
    pathname.includes("/change-password")
  ) {
    return null;
  }

  const ordered = TAB_ORDER.map((name) =>
    state.routes.find((r) => r.name === name),
  ).filter((r): r is { key: string; name: string } => Boolean(r));

  const focusedName = state.routes[state.index]?.name;

  function onPress(route: { key: string; name: string }, focused: boolean) {
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
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(6, insets.bottom) }]}
    >
      <View style={styles.dock}>
        <View style={styles.svgShadow} pointerEvents="none">
          <Svg
            width="100%"
            height={DOCK_HEIGHT}
            viewBox="0 0 390 76"
            preserveAspectRatio="none"
          >
            <Path d={DOCK_PATH} fill="#FFFFFF" />
          </Svg>
        </View>

        <View style={styles.row}>
          {ordered.map((route) => {
            const Icon = ICONS[route.name];
            if (!Icon) return null;

            const focused = focusedName === route.name;
            const isAttendance = route.name === ATTENDANCE;
            const color = focused ? ACTIVE : INACTIVE;

            if (isAttendance) {
              return (
                <View key={route.key} style={styles.slot}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={focused ? { selected: true } : {}}
                    accessibilityLabel={LABELS[route.name]}
                    onPress={() => onPress(route, focused)}
                    style={({ pressed }) => [
                      styles.fabPressable,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <LinearGradient
                      colors={["#5BA4FF", "#2563EB", "#1D4ED8"]}
                      locations={[0, 0.55, 1]}
                      style={styles.fab}
                    >
                      <Icon size={26} color="#FFFFFF" filled />
                    </LinearGradient>
                    <Text style={styles.fabLabel}>{LABELS[route.name]}</Text>
                  </Pressable>
                </View>
              );
            }

            return (
              <View key={route.key} style={styles.slot}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={focused ? { selected: true } : {}}
                  accessibilityLabel={LABELS[route.name]}
                  onPress={() => onPress(route, focused)}
                  style={({ pressed }) => [
                    styles.sideTab,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Icon size={22} color={color} filled={focused} />
                  <Text
                    style={[
                      styles.sideLabel,
                      { color, fontWeight: focused ? "600" : "500" },
                    ]}
                  >
                    {LABELS[route.name]}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
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
    zIndex: 40,
    paddingHorizontal: 12,
    paddingTop: 44,
  },
  dock: {
    position: "relative",
    height: DOCK_HEIGHT,
    overflow: "visible",
  },
  svgShadow: {
    ...StyleSheet.absoluteFill,
    shadowColor: "#0f172a",
    shadowOpacity: 0.14,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  row: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 4,
    paddingBottom: 10,
    zIndex: 2,
  },
  slot: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  sideTab: {
    minWidth: 50,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
    paddingBottom: 2,
    paddingTop: 4,
  },
  sideLabel: {
    fontSize: 11,
    letterSpacing: 0.3,
    lineHeight: 12,
  },
  fabPressable: {
    alignItems: "center",
    marginBottom: 2,
  },
  fab: {
    position: "absolute",
    bottom: 26,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.42,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  fabLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
    lineHeight: 12,
    color: ACTIVE,
    paddingBottom: 2,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
});
