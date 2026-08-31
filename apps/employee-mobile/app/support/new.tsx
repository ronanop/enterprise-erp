import { useState } from "react";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, ErrorBox, Screen, TextField } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";

export default function NewSupportTicketScreen() {
  const router = useRouter();
  const [kind, setKind] = useState("it");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("medium");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await essService.createSupportTicket({
        kind: kind.trim() || "it",
        subject: subject.trim(),
        description: description.trim() || undefined,
        urgency: urgency.trim() || "medium",
      });
      router.replace(`/support/${res.data?.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="New ticket" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      <Card style={styles.form}>
        <TextField label="Kind (it / hr / facilities)" value={kind} onChangeText={setKind} autoCapitalize="none" />
        <TextField label="Subject" value={subject} onChangeText={setSubject} />
        <TextField label="Description" value={description} onChangeText={setDescription} />
        <TextField label="Urgency (low / medium / high)" value={urgency} onChangeText={setUrgency} autoCapitalize="none" />
        <Button title="Create ticket" loading={loading} onPress={() => void onSubmit()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  form: { gap: 12 },
});
