import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AlertBox, Button, Screen, TextField } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import {
  MOCK_DEMO_COMPANY,
  MOCK_DEMO_EMPLOYEE_CODE,
  MOCK_DEMO_MOBILE,
  MOCK_DEMO_PASSWORD,
} from "@/data/mock-ess";
import { clearTokens } from "@/lib/auth";
import { clearFaceVerified } from "@/lib/face-auth";
import { ApiClientError, authService } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors, radii } from "@/theme/colors";
import { env } from "@/utils/env";

const REMEMBER_KEY = "ess.login.remember";
const LOGIN_ROLE_KEY = "ess.login.role";

type LoginRole = "employee" | "manager" | "hr_team";

type Remembered = {
  companyCode: string;
  employeeCode: string;
};

type CompanyOption = {
  company_code: string;
  company_name: string;
  legal_name?: string;
};

type CaptchaState = {
  captcha_id: string;
  question: string;
  code: string;
};

const ROLE_OPTIONS: { value: LoginRole; label: string }[] = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
  { value: "hr_team", label: "HR Team" },
];

function mobileDigits(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

const companyLoadErrorMessage = (err: unknown): string => {
  const apiHost = (() => {
    try {
      return new URL(env.apiUrl).hostname;
    } catch {
      return env.apiUrl;
    }
  })();
  const localHostHint =
    Platform.OS !== "web" &&
    (apiHost === "127.0.0.1" || apiHost === "localhost")
      ? " On a phone, set EXPO_PUBLIC_API_URL to your PC LAN IP (e.g. http://172.16.110.94:8000/api/v1), then restart Expo."
      : "";

  if (err instanceof ApiClientError) {
    if (err.status === 0) {
      return `${err.message} (API: ${env.apiUrl}).${localHostHint}`;
    }
    if (err.status === 503) {
      return `${err.message || "Database temporarily unavailable"}. API is up, but Postgres is not reachable.`;
    }
    return err.message || `Could not load companies (HTTP ${err.status}).`;
  }
  return `Could not load company list. Retry.${localHostHint}`;
};

function hrmsEssInboxUrl(): string {
  try {
    const api = new URL(env.apiUrl);
    return `${api.protocol}//${api.hostname}:3000/hr/ess-inbox`;
  } catch {
    return "http://127.0.0.1:3000/hr/ess-inbox";
  }
}

async function persistLoginRole(role: LoginRole) {
  try {
    await AsyncStorage.setItem(LOGIN_ROLE_KEY, role);
  } catch {
    /* ignore */
  }
}

function CompanyPicker({
  companies,
  loading,
  value,
  onChange,
  disabled,
}: {
  companies: CompanyOption[];
  loading: boolean;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = companies.find(
    (c) => c.company_code.trim().toUpperCase() === value.trim().toUpperCase(),
  );

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <View style={[styles.pickerRoot, open && styles.pickerRootOpen]}>
      <Pressable
        disabled={disabled || loading}
        onPress={() => setOpen((v) => !v)}
        style={[
          styles.pickerBtn,
          open && styles.pickerBtnOpen,
          (disabled || loading) && styles.disabled,
        ]}
      >
        <View style={styles.pickerTextWrap}>
          {loading ? (
            <Text style={styles.placeholder}>Loading companies…</Text>
          ) : selected ? (
            <Text style={styles.pickerTitle} numberOfLines={1}>
              {selected.company_name}{" "}
              <Text style={styles.pickerSub}>({selected.company_code})</Text>
            </Text>
          ) : (
            <Text style={styles.placeholder}>Select your company</Text>
          )}
        </View>
        <Text style={[styles.chevron, open && styles.chevronOpen]}>▾</Text>
      </Pressable>

      {open ? (
        <View style={styles.dropdown}>
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={styles.dropdownScroll}
          >
            {companies.length === 0 ? (
              <Text style={[styles.placeholder, styles.dropdownEmpty]}>
                No companies available
              </Text>
            ) : (
              companies.map((c) => {
                const active =
                  c.company_code.trim().toUpperCase() ===
                  value.trim().toUpperCase();
                return (
                  <Pressable
                    key={c.company_code}
                    style={[
                      styles.dropdownItem,
                      active && styles.dropdownItemActive,
                    ]}
                    onPress={() => {
                      onChange(c.company_code);
                      setOpen(false);
                    }}
                  >
                    <Text style={styles.pickerTitle}>{c.company_name}</Text>
                    <Text style={styles.pickerSub}>{c.company_code}</Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string; error?: string }>();
  const { status, completeSignIn } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [companyCode, setCompanyCode] = useState(env.useMock ? "CDPL" : "");
  const [mobile, setMobile] = useState(env.useMock ? MOCK_DEMO_MOBILE : "");
  const [phoneIdentified, setPhoneIdentified] = useState(false);
  const [captcha, setCaptcha] = useState<CaptchaState | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [mobileMasked, setMobileMasked] = useState("");
  const [loginRole, setLoginRole] = useState<LoginRole>("employee");
  const [employeeCode, setEmployeeCode] = useState(
    env.useMock ? MOCK_DEMO_EMPLOYEE_CODE : "",
  );
  const [password, setPassword] = useState(
    env.useMock ? MOCK_DEMO_PASSWORD : "",
  );
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const res = await authService.essCaptcha();
      const data = res.data;
      if (data?.captcha_id) {
        setCaptcha({
          captcha_id: data.captcha_id,
          question: data.question || "Please type the below code",
          code: data.code || "",
        });
        setCaptchaAnswer("");
      }
    } catch {
      setCaptcha(null);
      setError("Could not load captcha. Tap reload to try again.");
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  const resetPhoneGate = useCallback(() => {
    setPhoneIdentified(false);
    setMobileMasked("");
    setCaptcha(null);
    setCaptchaAnswer("");
  }, []);

  useEffect(() => {
    if (typeof params.error === "string" && params.error) {
      setError(params.error);
    }
  }, [params.error]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      let saved: Remembered | null = null;
      if (!env.useMock) {
        try {
          const raw = await AsyncStorage.getItem(REMEMBER_KEY);
          if (raw) saved = JSON.parse(raw) as Remembered;
        } catch {
          saved = null;
        }
      }

      setCompaniesLoading(true);
      setCompaniesError(null);
      try {
        const res = await authService.listEssCompanies();
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        setCompanies(rows);

        const rememberedCode = saved?.companyCode?.trim().toUpperCase() ?? "";
        const match = rows.find(
          (c) => c.company_code.trim().toUpperCase() === rememberedCode,
        );
        if (match) {
          setCompanyCode(match.company_code);
        } else if (rows.length === 1) {
          setCompanyCode(rows[0].company_code);
        } else if (env.useMock) {
          const demo =
            rows.find((c) => c.company_code.toUpperCase() === "CDPL") ||
            rows.find(
              (c) => c.company_code.toUpperCase() === MOCK_DEMO_COMPANY,
            ) ||
            rows[0];
          if (demo) setCompanyCode(demo.company_code);
        }
      } catch (err) {
        if (!cancelled) {
          setCompanies([]);
          setCompaniesError(companyLoadErrorMessage(err));
        }
      } finally {
        if (!cancelled) setCompaniesLoading(false);
      }

      if (saved && !cancelled) {
        setRememberMe(true);
        if (saved.employeeCode) setEmployeeCode(saved.employeeCode);
        setPassword("");
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCompany = useMemo(
    () =>
      companies.find(
        (c) =>
          c.company_code.trim().toUpperCase() ===
          companyCode.trim().toUpperCase(),
      ),
    [companies, companyCode],
  );

  const digitsOk = mobileDigits(mobile).length >= 10;
  const canIdentify = Boolean(companyCode.trim()) && digitsOk;
  const canContinue =
    phoneIdentified &&
    Boolean(captchaAnswer.trim()) &&
    Boolean(captcha?.captcha_id);

  async function reloadCompanies() {
    setCompaniesLoading(true);
    setCompaniesError(null);
    try {
      const res = await authService.listEssCompanies();
      const rows = Array.isArray(res.data) ? res.data : [];
      setCompanies(rows);
      if (!companyCode && rows.length === 1) {
        setCompanyCode(rows[0].company_code);
      }
    } catch (err) {
      setCompanies([]);
      setCompaniesError(companyLoadErrorMessage(err));
    } finally {
      setCompaniesLoading(false);
    }
  }

  async function goHomeOrFace(nextPath: string) {
    if (!env.useMock) {
      try {
        const face = await essService.faceStatus();
        if (face.data?.verification_required) {
          router.replace({
            pathname: "/face-verify",
            params: { next: nextPath },
          });
          return;
        }
      } catch {
        // Continue to destination if face status is unavailable.
      }
    }
    router.replace(nextPath as "/(tabs)/home");
  }

  async function afterLogin() {
    const meRes = await essService.me();
    const me = meRes.data;
    await clearFaceVerified();
    await persistLoginRole(loginRole);

    const forcedNext =
      typeof params.next === "string" && params.next ? params.next : null;

    if (loginRole === "manager") {
      if (!me?.can_approve_team_leave && !me?.is_manager) {
        await clearTokens();
        throw new ApiClientError(
          "This account is not set up as a manager (no direct reports). Sign in as Employee, or ask HR to assign your team.",
          403,
        );
      }
      await completeSignIn();
      await goHomeOrFace(forcedNext || "/approvals");
      return;
    }

    if (loginRole === "hr_team") {
      if (!me?.is_ess_admin && me?.ess_role !== "admin") {
        await clearTokens();
        throw new ApiClientError(
          "This account does not have HR Team access. Use HRMS with an HR login, or sign in as Employee / Manager.",
          403,
        );
      }
      await completeSignIn();
      const inbox = hrmsEssInboxUrl();
      try {
        await Linking.openURL(inbox);
      } catch {
        // Fall through to home if the browser cannot open.
      }
      await goHomeOrFace(forcedNext || "/(tabs)/home");
      return;
    }

    await completeSignIn();
    await goHomeOrFace(forcedNext || "/(tabs)/home");
  }

  async function identifyPhone() {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await authService.lookupEssPhone({
        company_code: companyCode.trim().toUpperCase(),
        mobile: mobile.trim(),
      });
      setPhoneIdentified(true);
      setMobileMasked(res.data?.mobile_masked || "");
      if (res.data?.company_code) setCompanyCode(res.data.company_code);
      await loadCaptcha();
    } catch (err) {
      resetPhoneGate();
      if (err instanceof ApiClientError) {
        setError(err.message || "Phone number not found for this company.");
      } else {
        setError("Unable to verify phone. Check API connection.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onStep1Submit() {
    if (!phoneIdentified) {
      await identifyPhone();
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (!captcha?.captcha_id) {
        setError("Captcha is required. Tap reload and try again.");
        await loadCaptcha();
        return;
      }
      const res = await authService.verifyEssPhone({
        company_code: companyCode.trim().toUpperCase(),
        mobile: mobile.trim(),
        captcha_id: captcha.captcha_id,
        captcha_answer: captchaAnswer.trim(),
      });
      setMobileMasked(res.data?.mobile_masked || mobileMasked);
      if (res.data?.company_code) setCompanyCode(res.data.company_code);
      setStep(2);
    } catch (err) {
      await loadCaptcha();
      if (err instanceof ApiClientError) {
        setError(err.message || "Captcha verification failed.");
      } else {
        setError("Unable to continue. Check API connection.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitLogin() {
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const login = await authService.essLogin({
        company_code: companyCode.trim().toUpperCase(),
        employee_code: employeeCode.trim().toUpperCase(),
        password: password.trim(),
        login_role: loginRole,
      });
      if (login.data?.mfa_required) {
        setError("MFA is required for this account.");
        return;
      }

      if (rememberMe && !env.useMock) {
        await AsyncStorage.setItem(
          REMEMBER_KEY,
          JSON.stringify({
            companyCode: companyCode.trim().toUpperCase(),
            employeeCode: employeeCode.trim().toUpperCase(),
          } satisfies Remembered),
        );
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
          setError(
            err.message || "Invalid company, employee code, or password.",
          );
        }
      } else {
        setError("Unable to sign in. Check API connection.");
      }
    } finally {
      setLoading(false);
    }
  }

  function onForgotPassword() {
    setError(null);
    setInfo(
      "Default password is your Employee Code + Date of Birth (DDMMYYYY), e.g. CT535415102003. For password resets, contact your HR team.",
    );
  }

  function backToStep1() {
    setStep(1);
    setError(null);
    setInfo(null);
    setPassword("");
    resetPhoneGate();
  }

  if (status === "signedIn") {
    return <Redirect href="/(tabs)/home" />;
  }

  const subtitle =
    step === 1
      ? phoneIdentified
        ? "Enter the captcha to continue."
        : "Select your entity and enter your registered mobile."
      : "Enter your employee ID and password.";

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
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.steps}>
            <Text style={[styles.stepPill, step === 1 && styles.stepPillActive]}>
              1 · Phone
            </Text>
            <Text style={styles.stepArrow}>→</Text>
            <Text style={[styles.stepPill, step === 2 && styles.stepPillActive]}>
              2 · Sign in
            </Text>
          </View>
        </View>

        {step === 1 ? (
          <View style={styles.form}>
            {env.useMock ? (
              <View style={styles.demoBanner}>
                <Text style={styles.demoTitle}>Demo login</Text>
                <Text style={styles.demoBody}>
                  Phone: {MOCK_DEMO_MOBILE} · Code: {MOCK_DEMO_EMPLOYEE_CODE} ·
                  Password: {MOCK_DEMO_PASSWORD}
                </Text>
              </View>
            ) : null}

            <View style={[styles.fieldBlock, styles.companyFieldBlock]}>
              <Text style={styles.label}>Company / Entity</Text>
              {companies.length > 0 || companiesLoading ? (
                <CompanyPicker
                  companies={companies}
                  loading={companiesLoading}
                  value={companyCode}
                  disabled={phoneIdentified}
                  onChange={(code) => {
                    setCompanyCode(code);
                    resetPhoneGate();
                    setError(null);
                  }}
                />
              ) : (
                <View style={styles.gapSm}>
                  <TextField
                    value={companyCode}
                    onChangeText={(v) => {
                      setCompanyCode(v.toUpperCase());
                      resetPhoneGate();
                    }}
                    placeholder="e.g. CDPL"
                    autoCapitalize="characters"
                    editable={!phoneIdentified}
                  />
                  <Pressable onPress={() => void reloadCompanies()}>
                    <Text style={styles.link}>Retry loading companies</Text>
                  </Pressable>
                </View>
              )}
              {companiesError ? (
                <Text style={styles.warnText}>{companiesError}</Text>
              ) : null}
            </View>

            <TextField
              label="Mobile number"
              keyboardType="phone-pad"
              autoComplete="tel"
              value={mobile}
              editable={!phoneIdentified}
              onChangeText={(v) => {
                setMobile(v);
                if (phoneIdentified) resetPhoneGate();
                setError(null);
              }}
              placeholder="10-digit registered mobile"
            />

            {phoneIdentified ? (
              <View style={styles.captchaCard}>
                <View style={styles.rowBetween}>
                  <View style={styles.flex}>
                    <Text style={styles.captchaTitle}>Mobile identified</Text>
                    <Text style={styles.captchaMeta}>
                      {mobileMasked || "Verified"}
                      {selectedCompany
                        ? ` · ${selectedCompany.company_name}`
                        : ""}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      resetPhoneGate();
                      setError(null);
                    }}
                  >
                    <Text style={styles.link}>Change</Text>
                  </Pressable>
                </View>

                <View style={styles.gapSm}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.label}>Captcha</Text>
                    <Pressable
                      disabled={captchaLoading}
                      onPress={() => void loadCaptcha()}
                    >
                      <Text style={styles.link}>
                        {captchaLoading ? "Loading…" : "Reload"}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.captchaCodeBox}>
                    <Text style={styles.captchaCode}>
                      {captcha?.code || (captchaLoading ? "·····" : "— — —")}
                    </Text>
                  </View>
                  <Text style={styles.hint}>
                    {captcha?.question || "Please type the below code"}
                  </Text>
                  <TextField
                    autoCapitalize="characters"
                    autoComplete="off"
                    value={captchaAnswer}
                    onChangeText={(v) => setCaptchaAnswer(v.toUpperCase())}
                    placeholder="Type the code above"
                    maxLength={8}
                  />
                </View>
              </View>
            ) : null}

            {error ? <AlertBox>{error}</AlertBox> : null}

            <Button
              title={
                loading
                  ? phoneIdentified
                    ? "Verifying…"
                    : "Checking mobile…"
                  : phoneIdentified
                    ? "Continue"
                    : "Verify mobile"
              }
              loading={loading}
              disabled={phoneIdentified ? !canContinue : !canIdentify}
              onPress={() => void onStep1Submit()}
              style={styles.loginBtn}
            />
          </View>
        ) : (
          <View style={styles.form}>
            {mobileMasked ? (
              <View style={styles.demoBanner}>
                <Text style={styles.demoBody}>
                  Phone verified: {mobileMasked}
                  {selectedCompany
                    ? ` · ${selectedCompany.company_name}`
                    : ""}
                </Text>
              </View>
            ) : null}

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Sign in as</Text>
              <View style={styles.roleRow}>
                {ROLE_OPTIONS.map((opt) => {
                  const selected = loginRole === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        setLoginRole(opt.value);
                        setError(null);
                        setInfo(null);
                      }}
                      style={[
                        styles.roleBtn,
                        selected && styles.roleBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleLabel,
                          selected && styles.roleLabelActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.hint}>
                {loginRole === "manager"
                  ? "Opens Team Approvals. Your HRMS profile must have direct reports."
                  : loginRole === "hr_team"
                    ? "Checks HR access, then opens HRMS ESS inbox for final approvals."
                    : "Standard employee self-service home."}
              </Text>
            </View>

            <TextField
              label="Company"
              value={
                selectedCompany
                  ? `${selectedCompany.company_name} (${companyCode})`
                  : companyCode
              }
              editable={false}
              style={styles.readOnly}
            />

            <TextField
              label="Employee ID"
              autoCapitalize="characters"
              value={employeeCode}
              onChangeText={(v) => setEmployeeCode(v.toUpperCase())}
              placeholder="e.g. CDPL5352"
            />

            <TextField
              label="Password"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              placeholder="Employee code + DOB"
              hint="Format: Employee Code + DOB (DDMMYYYY)"
            />

            <View style={styles.rowBetween}>
              <Pressable
                onPress={() => setRememberMe((v) => !v)}
                style={styles.remember}
              >
                <View
                  style={[styles.checkbox, rememberMe && styles.checkboxOn]}
                >
                  {rememberMe ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
                <Text style={styles.rememberLabel}>Remember me</Text>
              </Pressable>
              <Pressable onPress={onForgotPassword}>
                <Text style={styles.link}>Forgot Password?</Text>
              </Pressable>
            </View>

            {error ? <AlertBox>{error}</AlertBox> : null}
            {info ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>{info}</Text>
              </View>
            ) : null}

            <Button
              title={loading ? "Signing in…" : "Sign In"}
              loading={loading}
              disabled={!employeeCode.trim() || !password.trim()}
              onPress={() => void onSubmitLogin()}
              style={styles.loginBtn}
            />

            <Pressable onPress={backToStep1}>
              <Text style={styles.backLink}>← Back to phone verification</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.footer}>
          Need an account? <Text style={styles.footerLink}>Contact HR</Text>
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const ACCENT = colors.loginAccent;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: 36, justifyContent: "center" },
  hero: { alignItems: "center", marginBottom: 24 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: ACCENT,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  logoGlyph: { color: "#fff", fontSize: 26, fontWeight: "700" },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#6b7280",
    textAlign: "center",
    maxWidth: 300,
  },
  steps: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepPill: {
    overflow: "hidden",
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#e5e7eb",
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
  },
  stepPillActive: {
    backgroundColor: ACCENT,
    color: "#fff",
  },
  stepArrow: { color: "#6b7280", fontSize: 12 },
  form: { gap: 14, overflow: "visible" },
  fieldBlock: { gap: 6 },
  companyFieldBlock: {
    zIndex: 30,
    elevation: 30,
    overflow: "visible",
  },
  gapSm: { gap: 8 },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  pickerRoot: {
    zIndex: 1,
    position: "relative",
    overflow: "visible",
  },
  pickerRootOpen: { zIndex: 40, elevation: 40 },
  pickerBtn: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pickerBtnOpen: {
    borderColor: ACCENT,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  pickerTextWrap: { flex: 1, minWidth: 0 },
  pickerTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  pickerSub: { fontSize: 12, color: "#6b7280", fontWeight: "400" },
  placeholder: { fontSize: 15, color: "#9ca3af" },
  chevron: { color: "#6b7280", fontSize: 14 },
  chevronOpen: { transform: [{ rotate: "180deg" }], color: ACCENT },
  disabled: { opacity: 0.6 },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: -1,
    borderWidth: 1,
    borderColor: ACCENT,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: "#fff",
    overflow: "hidden",
    zIndex: 50,
    shadowColor: "#0f172a",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  dropdownScroll: { maxHeight: 220 },
  dropdownEmpty: { paddingHorizontal: 14, paddingVertical: 12 },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
  },
  dropdownItemActive: { backgroundColor: "#f3efff" },
  warnText: { fontSize: 12, color: "#b45309" },
  captchaCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd6fe",
    backgroundColor: "#faf8ff",
    padding: 14,
    gap: 12,
  },
  captchaTitle: { fontSize: 14, fontWeight: "600", color: "#5b3fd4" },
  captchaMeta: { marginTop: 2, fontSize: 12, color: "#6b7280" },
  captchaCodeBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#c4b5fd",
    backgroundColor: "#fff",
    paddingVertical: 14,
    alignItems: "center",
  },
  captchaCode: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 8,
    color: "#5b3fd4",
  },
  hint: { fontSize: 12, color: "#6b7280", lineHeight: 18 },
  roleRow: { flexDirection: "row", gap: 8 },
  roleBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    paddingVertical: 10,
    alignItems: "center",
  },
  roleBtnActive: {
    borderColor: ACCENT,
    backgroundColor: "#f3efff",
  },
  roleLabel: { fontSize: 13, fontWeight: "500", color: "#4b5563" },
  roleLabelActive: { fontWeight: "700", color: "#5b3fd4" },
  readOnly: { backgroundColor: "#f9fafb", color: "#6b7280" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  remember: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  checkMark: { color: "#fff", fontSize: 11, fontWeight: "700" },
  rememberLabel: { fontSize: 14, color: "#4b5563" },
  link: { fontSize: 14, fontWeight: "600", color: ACCENT },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(124,92,252,0.2)",
    backgroundColor: "#f3efff",
    padding: 12,
  },
  infoText: { color: "#5b3fd4", fontSize: 14 },
  loginBtn: {
    borderRadius: 12,
    backgroundColor: ACCENT,
    shadowColor: ACCENT,
  },
  backLink: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 4,
  },
  demoBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(124,92,252,0.2)",
    backgroundColor: "#f3efff",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  demoTitle: { fontWeight: "700", color: "#5b3fd4", fontSize: 12 },
  demoBody: { marginTop: 2, color: "#5b3fd4", fontSize: 12, lineHeight: 18 },
  footer: {
    marginTop: 28,
    textAlign: "center",
    fontSize: 14,
    color: "#6b7280",
  },
  footerLink: { fontWeight: "600", color: ACCENT },
});
