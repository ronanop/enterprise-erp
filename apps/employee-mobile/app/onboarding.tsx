import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { markOnboardingComplete } from "@/lib/onboarding";
import { colors } from "@/theme/colors";

const STEPS = [
  {
    id: "welcome",
    title: "Welcome to Employee Portal AI",
    body: "Manage your work life effortlessly with intelligent automation and refined insights.",
    image: require("../assets/images/onboarding/welcome.png"),
    cta: "Next",
  },
  {
    id: "features",
    title: "Everything in One Place",
    body: "Leaves, salary, documents, meetings, and tasks—all together.",
    image: require("../assets/images/onboarding/features.png"),
    cta: "Next",
  },
  {
    id: "attendance",
    title: "Attendance Made Easy",
    body: "Check in, check out, and track work hours with one tap.",
    image: require("../assets/images/onboarding/attendance.png"),
    cta: "Next",
  },
  {
    id: "ai",
    title: "Your AI Workplace Assistant",
    body: "Ask for leave, download payslips, check attendance, or find documents using natural language.",
    image: require("../assets/images/onboarding/ai-assistant.png"),
    cta: "Get Started",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  async function finish() {
    await markOnboardingComplete();
    router.replace("/login");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <View style={styles.container}>
        <View pointerEvents="none" style={styles.topGlow} />
        <View pointerEvents="none" style={styles.bottomGlow} />

        <View style={styles.skipRow}>
          <Pressable onPress={() => void finish()} hitSlop={12}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.visualWrap}>
            <Image source={current.image} style={styles.visual} resizeMode="cover" />
            {current.id === "features" ? (
              <>
                <FeatureIcon name="wallet-outline" color={colors.primary} style={styles.walletIcon} />
                <FeatureIcon name="calendar-outline" color={colors.secondary} style={styles.calendarIcon} />
                <FeatureIcon name="sparkles-outline" color={colors.tertiary} style={styles.sparkleIcon} />
              </>
            ) : null}
            {current.id === "ai" ? (
              <>
                <Prompt label="Apply for leave" icon="calendar-outline" style={styles.promptOne} />
                <Prompt label="Download payslip" icon="wallet-outline" style={styles.promptTwo} />
                <Prompt label="Update profile" icon="person-outline" style={styles.promptThree} />
              </>
            ) : null}
          </View>

          <View style={styles.copy}>
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.body}>{current.body}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots} accessibilityLabel={`${step + 1} of ${STEPS.length}`}>
            {STEPS.map((_, index) => (
              <View key={index} style={[styles.dot, index === step && styles.dotActive]} />
            ))}
          </View>

          {last || current.id === "welcome" ? (
            <PrimaryButton title={current.cta} onPress={() => (last ? void finish() : setStep((index) => index + 1))} />
          ) : (
            <View style={styles.actionRow}>
              <Pressable onPress={() => void finish()} hitSlop={12} style={styles.footerSkip}>
                <Text style={styles.footerSkipText}>Skip</Text>
              </Pressable>
              <PrimaryButton title={current.cta} compact onPress={() => setStep((index) => index + 1)} />
            </View>
          )}
          {!last && current.id === "welcome" ? (
            <Text style={styles.counter}>{step + 1} of {STEPS.length}</Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

function PrimaryButton({
  title,
  compact,
  onPress,
}: {
  title: string;
  compact?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.primaryButton, compact && styles.compactButton, pressed && styles.pressed]}>
      <Text style={styles.primaryButtonText}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color="#fff" />
    </Pressable>
  );
}

function FeatureIcon({
  name,
  color,
  style,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  style: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.featureIcon, style]}>
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

function Prompt({
  label,
  icon,
  style,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  style: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.prompt, style]}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.promptText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, overflow: "hidden", backgroundColor: "#fff" },
  topGlow: { position: "absolute", right: -80, top: -70, width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(37, 99, 235, 0.1)" },
  bottomGlow: { position: "absolute", bottom: -100, left: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(113, 42, 226, 0.1)" },
  skipRow: { alignItems: "flex-end", paddingHorizontal: 20, paddingTop: 14 },
  skipText: { color: colors.onSurfaceVariant, fontSize: 14, fontWeight: "600", paddingVertical: 8, paddingHorizontal: 10 },
  content: { flex: 1, minHeight: 0, justifyContent: "center", paddingHorizontal: 20 },
  visualWrap: { position: "relative", width: "100%", maxWidth: 360, alignSelf: "center", aspectRatio: 4 / 5, flexShrink: 1, marginBottom: 28, borderRadius: 32, shadowColor: "#2563eb", shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 5 },
  visual: { width: "100%", height: "100%", borderRadius: 32 },
  featureIcon: { position: "absolute", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surfaceLowest, shadowColor: "#0b1c30", shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  walletIcon: { right: -4, top: -10 },
  calendarIcon: { left: -6, top: "47%" },
  sparkleIcon: { right: -8, bottom: 40 },
  prompt: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surfaceLowest, shadowColor: "#0b1c30", shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  promptOne: { left: 4, top: "8%" },
  promptTwo: { right: 0, top: "23%" },
  promptThree: { bottom: "18%", left: 16 },
  promptText: { color: colors.onSurface, fontSize: 12, fontWeight: "700" },
  copy: { alignItems: "center", flexShrink: 0 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.onSurface,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  body: {
    maxWidth: 300,
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
  footer: { paddingHorizontal: 20, paddingBottom: 20, gap: 22 },
  dots: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.outlineVariant },
  dotActive: { width: 32, backgroundColor: colors.primary },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerSkip: { paddingVertical: 14, paddingHorizontal: 12 },
  footerSkipText: { color: colors.outline, fontSize: 14, fontWeight: "600" },
  primaryButton: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, backgroundColor: colors.primary, paddingHorizontal: 20, shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  compactButton: { minWidth: 132 },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  counter: { marginTop: -10, color: colors.outline, fontSize: 12, fontWeight: "700", textAlign: "center" },
});
