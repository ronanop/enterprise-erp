import { useEffect, useRef } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { colors } from "@/theme/colors";
import { GUTTER, TAB_CLEARANCE } from "@/theme/tokens";

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /** Full-bleed sticky header rendered above the scroll area. */
  header?: ReactNode;
  /** Full-bleed strip (offline/demo banners) above the header. */
  banner?: ReactNode;
  /**
   * Viewport-fixed layer above the body, for FABs and similar floating
   * actions that must not scroll with the content.
   */
  overlay?: ReactNode;
  /**
   * Extra bottom padding for tab-root screens so content clears BottomNav.
   * Also includes the device home-indicator inset.
   */
  tabClearance?: boolean;
  /** Soft fade/slide-in on mount. Disable on tab roots to avoid switch jitter. */
  animateEntrance?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll,
  header,
  banner,
  overlay,
  tabClearance,
  animateEntrance = true,
  style,
  contentStyle,
}: Props) {
  const insets = useSafeAreaInsets();
  const entrance = useRef(new Animated.Value(animateEntrance ? 0 : 1)).current;
  const bottomPad = tabClearance
    ? TAB_CLEARANCE + Math.max(0, insets.bottom)
    : 24 + Math.max(0, insets.bottom);

  useEffect(() => {
    if (!animateEntrance) {
      entrance.setValue(1);
      return;
    }
    entrance.setValue(0);
    Animated.timing(entrance, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [animateEntrance, entrance]);

  const entranceStyle = animateEntrance
    ? {
        opacity: entrance,
        transform: [
          {
            translateY: entrance.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 0],
            }),
          },
        ],
      }
    : undefined;

  const body = scroll ? (
    <Animated.View style={[styles.body, entranceStyle]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad },
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </Animated.View>
  ) : (
    <Animated.View
      style={[styles.body, styles.content, { paddingBottom: bottomPad }, contentStyle, entranceStyle]}
    >
      {children}
    </Animated.View>
  );

  return (
    <SafeAreaView style={[styles.safe, style]} edges={["top", "left", "right"]}>
      <DemoModeBanner />
      {banner}
      {header}
      {body}
      {overlay ? (
        <View style={styles.overlay} pointerEvents="box-none">
          {overlay}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: GUTTER,
  },
});
