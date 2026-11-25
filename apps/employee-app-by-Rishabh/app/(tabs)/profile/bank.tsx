import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, ErrorBox, Screen, TextField } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssBank } from "@/types/api";
import { colors } from "@/theme/colors";

export default function BankScreen() {
  const [form, setForm] = useState<EssBank>({
    bank_account_number: "",
    bank_ifsc: "",
    bank_name: "",
    bank_account_holder: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    essService
      .bank()
      .then((res) => {
        if (res.data) setForm(res.data);
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load bank",
        ),
      );
  }, []);

  async function onSave() {
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      await essService.updateBank(form);
      setOk("Bank details saved.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="Bank details" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {ok ? <Text style={styles.ok}>{ok}</Text> : null}
      <Card style={styles.form}>
        <TextField
          label="Account holder"
          value={form.bank_account_holder ?? ""}
          onChangeText={(v) => setForm((f) => ({ ...f, bank_account_holder: v }))}
        />
        <TextField
          label="Bank name"
          value={form.bank_name ?? ""}
          onChangeText={(v) => setForm((f) => ({ ...f, bank_name: v }))}
        />
        <TextField
          label="Account number"
          value={form.bank_account_number ?? ""}
          onChangeText={(v) => setForm((f) => ({ ...f, bank_account_number: v }))}
          autoCapitalize="none"
        />
        <TextField
          label="IFSC"
          value={form.bank_ifsc ?? ""}
          onChangeText={(v) => setForm((f) => ({ ...f, bank_ifsc: v }))}
          autoCapitalize="characters"
        />
        <Button title="Save" loading={loading} onPress={() => void onSave()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  form: { gap: 12 },
  ok: { color: "#007d55", fontWeight: "600" },
});
