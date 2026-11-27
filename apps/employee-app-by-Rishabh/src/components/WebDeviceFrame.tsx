import type { ReactNode } from "react";
import { Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
} from "react-native-safe-area-context";

/** iPhone 15/16 Pro logical screen size (points). */
const SCREEN_W = 393;
const SCREEN_H = 852;
const BEZEL = 12;
const DEVICE_W = SCREEN_W + BEZEL * 2;
const DEVICE_H = SCREEN_H + BEZEL * 2;
const PAGE_MARGIN = 24;
/** Below this browser width the web build is assumed to be on a real phone. */
const FRAME_MIN_WIDTH = 600;

const INSETS = { top: 54, bottom: 34, left: 0, right: 0 };
const FRAME = { x: 0, y: 0, width: SCREEN_W, height: SCREEN_H };

/**
 * Web-only preview chrome: renders the app inside an iPhone mockup on desktop
 * browsers and supplies device safe-area insets so screens lay out as on iOS.
 */
export function WebDeviceFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();

  if (Platform.OS !== "web" || width < FRAME_MIN_WIDTH) {
    return <>{children}</>;
  }

  const scale = Math.min(
    1,
    (height - PAGE_MARGIN * 2) / DEVICE_H,
    (width - PAGE_MARGIN * 2) / DEVICE_W,
  );

  return (
    <View style={styles.page}>
      <View
        style={[
          styles.device,
          { transform: [{ scale }] },
        ]}
      >
        <View style={[styles.sideButton, styles.actionButton]} />
        <View style={[styles.sideButton, styles.volumeUp]} />
        <View style={[styles.sideButton, styles.volumeDown]} />
        <View style={[styles.sideButton, styles.powerButton]} />

        <View style={styles.screen}>
          <SafeAreaFrameContext.Provider value={FRAME}>
            <SafeAreaInsetsContext.Provider value={INSETS}>
              {children}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>

          <View style={styles.statusBar} pointerEvents="none">
            <Text style={styles.clock}>9:41</Text>
            <View style={styles.statusIcons}>
              <View style={styles.signal}>
                {[4, 6, 8, 10].map((h) => (
                  <View key={h} style={[styles.signalBar, { height: h }]} />
                ))}
              </View>
              <View style={styles.battery}>
                <View style={styles.batteryFill} />
              </View>
              <View style={styles.batteryCap} />
            </View>
          </View>
          <View style={styles.island} pointerEvents="none" />
          <View style={styles.homeIndicator} pointerEvents="none" />
        </View>
      </View>
    </View>
  );
}

const INK = "#0b1c30";

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D8DEE9",
    overflow: "hidden",
  },
  device: {
    width: DEVICE_W,
    height: DEVICE_H,
    padding: BEZEL,
    borderRadius: 64,
    backgroundColor: "#0A0C10",
    borderWidth: 2,
    borderColor: "#2C3038",
    shadowColor: "#0A1628",
    shadowOpacity: 0.32,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 28 },
  },
  screen: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 52,
    backgroundColor: "#F4F6FA",
    // Contain position:fixed descendants (e.g. web modals) within the screen.
    transform: [{ translateX: 0 }],
  },
  sideButton: {
    position: "absolute",
    width: 4,
    borderRadius: 2,
    backgroundColor: "#2a2d33",
  },
  actionButton: { left: -5, top: 150, height: 32 },
  volumeUp: { left: -5, top: 210, height: 62 },
  volumeDown: { left: -5, top: 286, height: 62 },
  powerButton: { right: -5, top: 250, height: 96 },
  statusBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: INSETS.top,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingTop: 6,
  },
  clock: { fontSize: 16, fontWeight: "600", color: INK, letterSpacing: -0.2 },
  statusIcons: { flexDirection: "row", alignItems: "center", gap: 6 },
  signal: { flexDirection: "row", alignItems: "flex-end", gap: 1.5 },
  signalBar: { width: 3, borderRadius: 1, backgroundColor: INK },
  battery: {
    width: 24,
    height: 12,
    padding: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(11,28,48,0.4)",
  },
  batteryFill: { flex: 1, borderRadius: 2, backgroundColor: INK },
  batteryCap: {
    width: 1.5,
    height: 4,
    marginLeft: -4,
    borderTopRightRadius: 1,
    borderBottomRightRadius: 1,
    backgroundColor: "rgba(11,28,48,0.4)",
  },
  island: {
    position: "absolute",
    top: 11,
    alignSelf: "center",
    width: 126,
    height: 37,
    borderRadius: 20,
    backgroundColor: "#000000",
  },
  homeIndicator: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    width: 134,
    height: 5,
    borderRadius: 3,
    backgroundColor: INK,
  },
});
