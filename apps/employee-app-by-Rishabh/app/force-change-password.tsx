import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BrandMark } from "@/components/brand-mark";
import { Button, ErrorBox, Screen, TextField } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors } from "@/theme/colors";

/**
 * Mandatory first-login password change. Cannot be dismissed until complete.
 */
export default function ForceChangePasswordScreen() {
  const router = useRouter();
  const { status, me, refreshMe, signOut } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (status === "signedOut") {
    return <Redirect href="/login" />;
  }

  if (status === "signedIn" && me && me.must_change_password !== true) {
    return <Redirect href="/(tabs)/feed" />;
  }

  async function onSubmit() {
    setError(null);
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (next === current) {
      setError("Choose a password different from your temporary password.");
      return;
    }
    setLoading(true);
    try {
      await essService.changePassword({
        current_password: current,
        new_password: next,
      });
      await refreshMe();
      router.replace("/(tabs)/feed");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to change password",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.hero}>
        <BrandMark size={56} style={styles.logo} />
        <Text style={styles.title}>Create a new password</Text>
        <Text style={styles.subtitle}>
          For security, you must replace the default password (employee code +
          date of birth) before using the app.
        </Text>
      </View>

      <View style={styles.form}>
        <TextField
          label="Current password"
          secureTextEntry
          value={current}
          onChangeText={setCurrent}
          placeholder="Your default / current password"
        />
        <TextField
          label="New password"
          secureTextEntry
          value={next}
          onChangeText={setNext}
        />
        <TextField
          label="Confirm new password"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />
        {error ? <ErrorBox>{error}</ErrorBox> : null}
        <Button
          title="Save and continue"
          loading={loading}
          onPress={() => void onSubmit()}
        />
        <Button
          title="Sign out"
          variant="secondary"
          onPress={() => void signOut().then(() => router.replace("/login"))}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 36, justifyContent: "center" },
  hero: { alignItems: "center", marginBottom: 24 },
  logo: { marginBottom: 16 },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.onSurface,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    maxWidth: 300,
  },
  form: { gap: 14 },
});
