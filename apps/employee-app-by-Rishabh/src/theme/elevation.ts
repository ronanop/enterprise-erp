import { Platform, type ViewStyle } from "react-native";

/**
 * One elevation vocabulary for the whole app.
 * Prefer CSS boxShadow (web + modern RN); legacy shadow props on native.
 */

type Level = "sm" | "md" | "lg" | "nav" | "accent";

const WEB: Record<Level, string> = {
  sm: "0 1px 2px rgba(10,22,40,0.04), 0 1px 3px rgba(10,22,40,0.05)",
  md: "0 4px 14px rgba(10,22,40,0.06), 0 1px 3px rgba(10,22,40,0.04)",
  lg: "0 12px 32px rgba(10,22,40,0.10), 0 4px 10px rgba(10,22,40,0.05)",
  nav: "0 10px 28px rgba(10,22,40,0.12), 0 2px 8px rgba(11,87,208,0.06)",
  accent: "0 10px 28px rgba(37,99,235,0.30), 0 2px 8px rgba(37,99,235,0.12)",
};

const NATIVE: Record<Level, ViewStyle> = {
  sm: {
    shadowColor: "#0A1628",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: "#0A1628",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  lg: {
    shadowColor: "#0A1628",
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  nav: {
    shadowColor: "#0A1628",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  accent: {
    shadowColor: "#2563EB",
    shadowOpacity: 0.32,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
};

export function elevation(level: Level): ViewStyle {
  if (Platform.OS === "web") {
    return { boxShadow: WEB[level] } as ViewStyle;
  }
  return NATIVE[level];
}
