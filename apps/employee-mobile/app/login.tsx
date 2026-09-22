import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button, ErrorBox, Screen, TextField } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { MOCK_DEMO_EMAIL, MOCK_DEMO_PASSWORD } from "@/data/mock-ess";
import { clearFaceVerified } from "@/lib/face-auth";
import { ApiClientError, authService } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors, radii } from "@/theme/colors";
import { env } from "@/utils/env";

type LoginMode = "email" | "employee";

const REMEMBER_KEY = "ess.login.remember";

type Remembered = {
  mode: LoginMode;
  email?: string;
  companyCode?: string;
  employeeCode?: string;
};

export default function LoginScreen() {
  const router = useRouter();
  const { status, completeSignIn } = useAuth();
  const [mode, setMode] = useState<LoginMode>("employee");
  const [email, setEmail] = useState(env.useMock ? MOCK_DEMO_EMAIL : "");
  const [companyCode, setCompanyCode] = useState("DEMOCO");
  const [employeeCode, setEmployeeCode] = useState("EMP-004");
  const [password, setPassword] = useState(env.useMock ? MOCK_DEMO_PASSWORD : "");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (env.useMock) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(REMEMBER_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as Remembered;
        setRememberMe(true);
        setMode(saved.mode);
        if (saved.email) setEmail(saved.email);
        if (saved.companyCode) setCompanyCode(saved.companyCode);
        if (saved.employeeCode) setEmployeeCode(saved.employeeCode);
        setPassword("");
      } catch {
        // ignore
      }
    })();
  }, []);

  if (status === "signedIn") {
    return <Redirect href="/(tabs)/home" />;
  }

  async function afterLogin() {
    await clearFaceVerified();
    await completeSignIn();
    if (!env.useMock) {
      const face = await essService.faceStatus();
      if (face.data?.verification_required) {
        router.replace({
          pathname: "/face-verify",
          params: { next: "/(tabs)/home" },
        });
        return;
      }
    }
    router.replace("/(tabs)/home");
  }

  async function onSubmit() {
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (env.useMock || mode === "email") {
        const login = await authService.login(email.trim(), password);
        if (login.data?.mfa_required) {
          setError("MFA is required for this account. Use the ERP login first.");
          return;
        }
      } else {
        const login = await authService.essLogin({
          company_code: companyCode.trim(),
          employee_code: employeeCode.trim(),
          password,
        });
        if (login.data?.mfa_required) {
          setError("MFA is required for this account.");
          return;
        }
      }

      if (rememberMe && !env.useMock) {
        const payload: Remembered =
          mode === "email"
            ? { mode, email: email.trim() }
            : {
                mode,
                companyCode: companyCode.trim(),
                employeeCode: employeeCode.trim(),
              };
        await AsyncStorage.setItem(REMEMBER_KEY, JSON.stringify(payload));
      } else {
        await AsyncStorage.removeItem(REMEMBER_KEY);
      }

      await afterLogin();
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
          setError(err.message);
        }
      } else {
        setError("Unable to sign in. Check API connection.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.hero}>
          <View style={styles.logo}>
            <Text style={styles.logoGlyph}>✓</Text>
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Log in to your account to continue.
          </Text>
        </View>

        <View style={styles.segment}>
          <Pressable
            onPress={() => setMode("employee")}
            style={[styles.segBtn, mode === "employee" && styles.segActive]}
          >
            <Text
              style={[
                styles.segLabel,
                mode === "employee" && styles.segLabelActive,
              ]}
            >
              Employee code
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("email")}
            style={[styles.segBtn, mode === "email" && styles.segActive]}
          >
            <Text
              style={[styles.segLabel, mode === "email" && styles.segLabelActive]}
            >
              Email
            </Text>
          </Pressable>
        </View>

        {env.useMock ? (
          <View style={styles.demoBanner}>
            <Text style={styles.demoTitle}>Demo login</Text>
            <Text style={styles.demoBody}>
              {MOCK_DEMO_EMAIL} / {MOCK_DEMO_PASSWORD}
            </Text>
          </View>
        ) : null}

        <View style={styles.form}>
          {mode === "email" || env.useMock ? (
            <TextField
              label="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
            />
          ) : (
            <>
              <TextField
                label="Company code"
                autoCapitalize="characters"
                value={companyCode}
                onChangeText={setCompanyCode}
                placeholder="Enter company code"
              />
              <TextField
                label="Employee code"
                autoCapitalize="characters"
                value={employeeCode}
                onChangeText={setEmployeeCode}
                placeholder="Enter employee code"
              />
            </>
          )}

          <TextField
            label="Password"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
          />

          <View style={styles.rowBetween}>
            <Pressable
              onPress={() => setRememberMe((v) => !v)}
              style={styles.remember}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                {rememberMe ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={styles.rememberLabel}>Remember me</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setInfo(
                  "Password resets are managed by HR. Contact your HR team for help.",
                )
              }
            >
              <Text style={styles.forgot}>Forgot Password?</Text>
            </Pressable>
          </View>

          {error ? <ErrorBox>{error}</ErrorBox> : null}
          {info ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>{info}</Text>
            </View>
          ) : null}

          <Button title="Sign In" loading={loading} onPress={onSubmit} />
        </View>

        <Text style={styles.footer}>
          Need an account? <Text style={styles.footerLink}>Contact HR</Text>
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: 40, justifyContent: "center" },
  hero: { alignItems: "center", marginBottom: 28 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoGlyph: { color: "#fff", fontSize: 28, fontWeight: "700" },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    maxWidth: 280,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.lg,
    padding: 4,
    marginBottom: 16,
  },
  segBtn: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  segActive: { backgroundColor: colors.surfaceLowest },
  segLabel: { fontSize: 13, fontWeight: "600", color: colors.onSurfaceVariant },
  segLabelActive: { color: colors.primary },
  demoBanner: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.2)",
    backgroundColor: colors.primaryFixed,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  demoTitle: { fontWeight: "700", color: colors.primary, fontSize: 12 },
  demoBody: { marginTop: 2, color: colors.onSurfaceVariant, fontSize: 12 },
  form: { gap: 14 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  remember: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: "#fff", fontSize: 11, fontWeight: "700" },
  rememberLabel: { fontSize: 14, color: colors.onSurfaceVariant },
  forgot: { fontSize: 14, fontWeight: "600", color: colors.primary },
  infoBox: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.2)",
    backgroundColor: colors.primaryFixed,
    padding: 12,
  },
  infoText: { color: colors.primary, fontSize: 14 },
  footer: {
    marginTop: 28,
    textAlign: "center",
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  footerLink: { fontWeight: "600", color: colors.primary },
});
