import { useEffect, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { apiClientBytes } from "@/services/api-client";
import { gradients } from "@/theme/tokens";

type Size = "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, { box: number; font: number }> = {
  sm: { box: 40, font: 14 },
  md: { box: 48, font: 16 },
  lg: { box: 64, font: 20 },
  xl: { box: 104, font: 30 },
};

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function bytesToDataUri(bytes: Uint8Array, mime = "image/jpeg"): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${globalThis.btoa(binary)}`;
}

/** Mirrors PWA Avatar — initials fallback + optional authenticated photo. */
export function Avatar({
  name,
  size = "md",
  ring = false,
  photoUrl,
  style,
}: {
  name: string;
  size?: Size;
  ring?: boolean;
  /** Absolute http(s)/data URL, or ESS path like `/ess/me/photo`. */
  photoUrl?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const { box, font } = SIZES[size];
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setUri(null);

    const src = (photoUrl || "").trim();
    if (!src) return;

    if (
      src.startsWith("data:") ||
      src.startsWith("blob:") ||
      src.startsWith("http://") ||
      src.startsWith("https://")
    ) {
      setUri(src);
      return;
    }

    void apiClientBytes(src)
      .then((bytes) => {
        if (cancelled || !bytes.length) return;
        setUri(bytesToDataUri(bytes));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [photoUrl]);

  return (
    <View
      style={[
        {
          width: box,
          height: box,
          borderRadius: box / 2,
          overflow: "hidden",
        },
        ring ? styles.ring : null,
        styles.shadow,
        style,
      ]}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={styles.photo}
          onError={() => setFailed(true)}
        />
      ) : (
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fill, { borderRadius: box / 2 }]}
        >
          <Text style={[styles.initials, { fontSize: font }]}>
            {initialsOf(name)}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: "center", justifyContent: "center" },
  photo: { width: "100%", height: "100%" },
  initials: { color: "#ffffff", fontWeight: "700" },
  ring: {
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  shadow: {
    shadowColor: "#2563eb",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
});
