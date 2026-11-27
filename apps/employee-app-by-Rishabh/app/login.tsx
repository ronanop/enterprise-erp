import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BrandMark } from "@/components/brand-mark";
import { Button, ErrorBox, Screen, TextField } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import {
  getBiometricCapability,
  isBiometricUnlockEnabled,
  requestAndEnableBiometricUnlock,
} from "@/lib/biometric";
import { warmEssApi } from "@/lib/api-warmup";
import { clearFaceVerified } from "@/lib/face-auth";
import { ApiClientError, authService } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors, radii } from "@/theme/colors";
import { elevation } from "@/theme/elevation";
import { gradients } from "@/theme/tokens";
import { env } from "@/utils/env";

/** Shared ESS portal company code — same for every employee. */
export const ESS_COMPANY_CODE = "CDPL0112";

const REMEMBER_KEY = "ess.login.remember.v3";

type Remembered = {
  email?: string;
};

export default function LoginScreen() {
  const router = useRouter();
  const { status, completeSignIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Wake staging API / tunnel before the reviewer taps Sign In.
    void warmEssApi();
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(REMEMBER_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as Remembered;
        setRememberMe(true);
        if (saved.email) setEmail(saved.email);
      } catch {
        // ignore
      }
    })();
  }, []);

  if (status === "signedIn") {
    return <Redirect href="/(tabs)/feed" />;
  }

  async function afterLogin(mustChange?: boolean) {
    await clearFaceVerified();
    const profile = await completeSignIn();
    await offerDeviceUnlockIfNeeded();

    const forceChange =
      mustChange === true || profile?.must_change_password === true;
    if (forceChange) {
      router.replace("/force-change-password");
      return;
    }

    if (!env.useMock) {
      const face = await essService.faceStatus();
      if (face.data?.verification_required) {
        router.replace({
          pathname: "/face-verify",
          params: { next: "/(tabs)/feed" },
        });
        return;
      }
    }
    router.replace("/(tabs)/feed");
  }

  async function offerDeviceUnlockIfNeeded() {
    if (Platform.OS === "web") return;
    try {
      if (await isBiometricUnlockEnabled()) return;
      const cap = await getBiometricCapability();
      if (!cap.available) return;
      await new Promise<void>((resolve) => {
        Alert.alert(
          "Protect this app",
          `Use ${cap.label} (fingerprint, Face ID, or screen lock) when reopening the app?`,
          [
            { text: "Not now", style: "cancel", onPress: () => resolve() },
            {
              text: "Enable",
              onPress: () => {
                void requestAndEnableBiometricUnlock().finally(() => resolve());
              },
            },
          ],
          { cancelable: true, onDismiss: () => resolve() },
        );
      });
    } catch {
      // Non-blocking
    }
  }

  async function onSignIn() {
    setError(null);
    const mail = email.trim();
    if (!mail || !mail.includes("@")) {
      setError("Enter your work email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setLoading(true);
    try {
      const login = await authService.essLogin({
        company_code: ESS_COMPANY_CODE,
        email: mail,
        password,
      });
      if (login.data?.mfa_required) {
        setError("MFA is required for this account. Contact HR / IT.");
        return;
      }

      if (rememberMe) {
        await AsyncStorage.setItem(
          REMEMBER_KEY,
          JSON.stringify({ email: mail } satisfies Remembered),
        );
      } else {
        await AsyncStorage.removeItem(REMEMBER_KEY);
      }

      await afterLogin(login.data?.must_change_password === true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 403) {
          setError(
            err.message ||
              "Account is locked. Wait and try again or contact HR.",
          );
        } else if (err.status === 404) {
          setError(
            "Logged in, but no employee profile is linked to this user.",
          );
        } else {
          setError(err.message || "Invalid email or password.");
        }
      } else {
        setError("Unable to sign in. Check API connection.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll contentStyle={styles.content} style={styles.screen}>
      <LinearGradient
        colors={gradients.heroWash}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.wash}
        pointerEvents="none"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.hero}>
          <BrandMark size={72} style={styles.logo} />
          <Text style={styles.product}>iConnect+</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in with your work email to continue.
          </Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.form}>
            <TextField
              label="Company code"
              value={ESS_COMPANY_CODE}
              editable={false}
              selectTextOnFocus={false}
            />
            <TextField
              label="Work email"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="name@company.com"
            />
            <TextField
              label="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              onSubmitEditing={() => void onSignIn()}
            />
            <Text style={styles.hint}>
              First-time password is your employee code + date of birth
              (DDMMYYYY). You will be asked to change it after sign-in.
            </Text>

            <View style={styles.row}>
              <Pressable
                onPress={() => setRememberMe((v) => !v)}
                style={styles.remember}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                  {rememberMe ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
                <Text style={styles.rememberLabel}>Remember me</Text>
              </Pressable>
            </View>

            {error ? <ErrorBox>{error}</ErrorBox> : null}
            <Button
              title="Sign In"
              loading={loading}
              onPress={() => void onSignIn()}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Need an account? <Text style={styles.footerLink}>Contact HR</Text>
          </Text>
        </View>

        <View style={styles.legal}>
          <Pressable onPress={() => router.push("/privacy")}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable onPress={() => router.push("/terms")}>
            <Text style={styles.legalLink}>Terms</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable
            onPress={() =>
              void Linking.openURL(
                env.supportEmail.startsWith("mailto:")
                  ? env.supportEmail
                  : `mailto:${env.supportEmail}`,
              )
            }
          >
            <Text style={styles.legalLink}>Support</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingTop: 28, justifyContent: "center", position: "relative" },
  wash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  hero: { alignItems: "center", marginBottom: 24 },
  logo: {
    marginBottom: 16,
    ...elevation("md"),
  },
  product: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.primary,
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.onSurface,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    maxWidth: 300,
  },
  formCard: {
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceLowest,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,206,220,0.55)",
    padding: 20,
    borderCurve: "continuous",
    ...elevation("md"),
  },
  form: { gap: 14 },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.onSurfaceVariant,
    marginTop: -4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  remember: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    ...Platform.select({
      web: { cursor: "pointer" } as object,
      default: {},
    }),
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceLowest,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: "#fff", fontSize: 12, fontWeight: "700" },
  rememberLabel: { fontSize: 14, color: colors.onSurfaceVariant },
  footer: { marginTop: 28, alignItems: "center" },
  footerText: { fontSize: 14, color: colors.onSurfaceVariant },
  footerLink: { fontWeight: "600", color: colors.primary },
  legal: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  legalLink: { fontSize: 13, fontWeight: "600", color: colors.primary },
  legalDot: { color: colors.outline },
});
