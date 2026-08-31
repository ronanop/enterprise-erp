import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, ErrorBox, Screen, TextField } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type {
  EssSupportTicketComment,
  EssSupportTicketDetail,
} from "@/types/api";
import { colors } from "@/theme/colors";
import { formatDateTime } from "@/utils/datetime";

export default function SupportTicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [row, setRow] = useState<EssSupportTicketDetail | null>(null);
  const [comments, setComments] = useState<EssSupportTicketComment[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [ticket, c] = await Promise.all([
      essService.supportTicket(id),
      essService.supportTicketComments(id),
    ]);
    setRow(ticket.data);
    setComments(c.data ?? []);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load().catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load ticket",
        ),
      );
    }, [load]),
  );

  async function onComment() {
    if (!id || !body.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await essService.addSupportTicketComment(id, { body: body.trim() });
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Comment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="Ticket" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {row ? (
        <Card style={{ gap: 6 }}>
          <Text style={styles.title}>{row.subject}</Text>
          <Text style={styles.meta}>
            {row.document_number} · {row.status} · {row.kind}
          </Text>
          {row.description ? (
            <Text style={styles.body}>{row.description}</Text>
          ) : null}
        </Card>
      ) : null}

      <Text style={styles.section}>Comments</Text>
      {comments.map((c) => (
        <Card key={c.id} style={{ gap: 4 }}>
          <Text style={styles.body}>{c.body}</Text>
          <Text style={styles.meta}>{formatDateTime(c.commented_at)}</Text>
        </Card>
      ))}

      <Card style={{ gap: 10 }}>
        <TextField label="Add comment" value={body} onChangeText={setBody} />
        <Button title="Post" loading={loading} onPress={() => void onComment()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  title: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  meta: { fontSize: 12, color: colors.onSurfaceVariant },
  body: { fontSize: 14, color: colors.onSurface, lineHeight: 20 },
  section: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.onSurfaceVariant,
  },
});
