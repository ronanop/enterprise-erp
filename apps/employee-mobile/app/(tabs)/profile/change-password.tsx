import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, ErrorBox, Screen, TextField } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors } from "@/theme/colors";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setOk(null);
    if (next.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    setLoading(true);
    try {
      await essService.changePassword({
        current_password: current,
        new_password: next,
      });
      setOk("Password updated.");
      setCurrent("");
      setNext("");
      setConfirm("");
      setTimeout(() => router.back(), 800);
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
    <Screen scroll header={<SubHeader title="Change password" />} contentStyle={styles.content}>
      <View style={styles.form}>
        <TextField
          label="Current password"
          secureTextEntry
          value={current}
          onChangeText={setCurrent}
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
        {ok ? (
          <View style={styles.okBox}>
            <Text style={styles.okText}>{ok}</Text>
          </View>
        ) : null}
        <Button
          title="Update password"
          loading={loading}
          onPress={() => void onSubmit()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16 },
  form: { gap: 14 },
  okBox: {
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0,125,85,0.2)",
  },
  okText: { color: "#007d55", fontWeight: "600", fontSize: 14 },
});
