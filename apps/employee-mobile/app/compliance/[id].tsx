import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, ErrorBox, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssPolicyWalkthrough } from "@/types/api";
import { colors } from "@/theme/colors";

export default function PolicyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<EssPolicyWalkthrough | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    essService
      .policyWalkthrough(id)
      .then((res) => setRow(res.data))
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load policy",
        ),
      );
  }, [id]);

  const current = row?.steps?.[step];
  const last = row ? step >= row.steps.length - 1 : false;

  async function onAck() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      await essService.acknowledgePolicy(id);
      router.back();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Acknowledge failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="Policy" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {row && current ? (
        <Card style={styles.card}>
          <Text style={styles.kicker}>
            Step {step + 1} of {row.steps.length}
          </Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>
          <View style={styles.actions}>
            {step > 0 ? (
              <Button
                title="Back"
                variant="secondary"
                onPress={() => setStep((s) => s - 1)}
                style={{ flex: 1 }}
              />
            ) : null}
            {!last ? (
              <Button
                title="Next"
                onPress={() => setStep((s) => s + 1)}
                style={{ flex: 1 }}
              />
            ) : (
              <Button
                title={row.acknowledged ? "Already acknowledged" : "Acknowledge"}
                loading={loading}
                disabled={row.acknowledged}
                onPress={() => void onAck()}
                style={{ flex: 1 }}
              />
            )}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  card: { gap: 10 },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.onSurfaceVariant,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  body: { fontSize: 15, color: colors.onSurfaceVariant, lineHeight: 22 },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
});
