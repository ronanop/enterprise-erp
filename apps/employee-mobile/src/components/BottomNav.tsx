import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  IconCalendar,
  IconFingerprint,
  IconHome,
  IconUser,
  IconWallet,
  type IconProps,
} from "@/components/icons";
import { colors } from "@/theme/colors";

/** Structural subset of the navigator's tab-bar props (SDK 57 has no
 *  direct @react-navigation/bottom-tabs dependency to import from). */
type TabBarProps = {
  state: {
    index: number;
    routes: readonly { key: string; name: string }[];
  };
  navigation: {
    emit: (event: {
      type: "tabPress";
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: never) => void;
  };
};

const ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  home: IconHome,
  attendance: IconFingerprint,
  leave: IconCalendar,
  payslips: IconWallet,
  profile: IconUser,
};

/** Labels match the PWA bottom nav exactly (payslips renders as "Salary"). */
const LABELS: Record<string, string> = {
  home: "Home",
  attendance: "Attendance",
  leave: "Leave",
  payslips: "Salary",
  profile: "Profile",
};

const ACTIVE = colors.primary;
const IDLE = "rgba(67,70,85,0.6)";

/**
 * Mirrors the PWA BottomNav: glass bar, 22px stroke icons, 10px semibold
 * labels, and a 4px dot under the active tab.
 */
export function BottomNav({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.nav, { paddingBottom: Math.max(8, insets.bottom) }]}>
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const Icon = ICONS[route.name];
          if (!Icon) return null;

          const focused = state.index === index;
          const color = focused ? ACTIVE : IDLE;

          function onPress() {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          }

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={LABELS[route.name]}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tab,
                pressed ? styles.tabPressed : null,
              ]}
            >
              <Icon size={22} color={color} />
              <Text style={[styles.label, { color }]}>
                {LABELS[route.name]}
              </Text>
              {focused ? <View style={styles.dot} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    borderTopWidth: 1,
    borderTopColor: "rgba(195,198,215,0.3)",
    backgroundColor: "rgba(248,249,255,0.96)",
    paddingTop: 8,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-around",
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  tabPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  dot: {
    position: "absolute",
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ACTIVE,
  },
});
