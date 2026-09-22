import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, ErrorBox, Screen, TextField } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors } from "@/theme/colors";

export default function AssetReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    assetId?: string;
    assetName?: string;
  }>();
  const [subject, setSubject] = useState("Asset issue");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("medium");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!params.assetId) {
      setError("Missing asset.");
      return;
    }
    if (!description.trim()) {
      setError("Describe the issue.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await essService.createAssetTicket(params.assetId, {
        subject: subject.trim() || "Asset issue",
        description: description.trim(),
        urgency: urgency.trim() || "medium",
      });
      router.replace(`/support/${res.data?.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Report failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="Report issue" />} contentStyle={styles.content}>
      {params.assetName ? (
        <Text style={styles.hint}>Reporting: {params.assetName}</Text>
      ) : null}
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      <Card style={styles.form}>
        <TextField label="Subject" value={subject} onChangeText={setSubject} />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
        />
        <TextField
          label="Urgency"
          value={urgency}
          onChangeText={setUrgency}
          autoCapitalize="none"
        />
        <Button
          title="Submit ticket"
          loading={loading}
          onPress={() => void onSubmit()}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  hint: { fontSize: 13, color: colors.onSurfaceVariant },
  form: { gap: 12 },
});
