import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, ErrorBox, Screen, TextField } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors } from "@/theme/colors";

export default function EmergencyScreen() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [meta, setMeta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    essService
      .emergency()
      .then((res) => {
        setName(res.data?.name ?? "");
        setMobile(res.data?.mobile ?? "");
        const bits = [
          res.data?.relationship,
          res.data?.blood_group ? `Blood ${res.data.blood_group}` : null,
        ].filter(Boolean);
        setMeta(bits.join(" · "));
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load emergency contact",
        ),
      );
  }, []);

  async function onSave() {
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      await essService.updateEmergency({
        emergency_contact_name: name,
        emergency_contact_mobile: mobile,
      });
      setOk("Emergency contact saved.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="Emergency contact" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {ok ? <Text style={styles.ok}>{ok}</Text> : null}
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      <Card style={styles.form}>
        <TextField label="Name" value={name} onChangeText={setName} />
        <TextField
          label="Mobile"
          value={mobile}
          onChangeText={setMobile}
          keyboardType="phone-pad"
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
  meta: { fontSize: 13, color: colors.onSurfaceVariant },
});
