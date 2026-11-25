import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, Button } from "@/components/ui";
import { IconClose } from "@/components/icons";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors, radii } from "@/theme/colors";
import { formatRelativeShort } from "@/utils/datetime";
import type { EssFeedComment, EssFeedPost } from "@/types/api";

type Props = {
  post: EssFeedPost | null;
  visible: boolean;
  onClose: () => void;
  onCommentAdded: (postId: string) => void;
};

export function FeedCommentsSheet({
  post,
  visible,
  onClose,
  onCommentAdded,
}: Props) {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<EssFeedComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !post) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setText("");
    essService
      .feedComments(post.id)
      .then((res) => {
        if (!cancelled) setRows(res.data ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setRows([]);
          setError(err instanceof ApiClientError ? err.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, post?.id]);

  async function send() {
    if (!post || !text.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await essService.addFeedComment(post.id, {
        body: text.trim(),
      });
      if (res.data) setRows((prev) => [...prev, res.data!]);
      setText("");
      onCommentAdded(post.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not comment");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(12, insets.bottom + 8) },
          ]}
        >
          <View style={styles.handleRow}>
            <View style={styles.handle} />
            <Text style={styles.title}>Comments</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close comments"
              style={styles.close}
            >
              <IconClose size={18} color={colors.onSurface} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <Text style={styles.empty}>No comments yet — be the first.</Text>
              }
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <Avatar name={item.author_name} size="sm" />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowText}>
                      <Text style={styles.rowName}>{item.author_name} </Text>
                      {item.body}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {formatRelativeShort(item.created_at)}
                    </Text>
                  </View>
                </View>
              )}
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Add a comment…"
              placeholderTextColor={colors.outline}
              style={styles.input}
              maxLength={2000}
              multiline
            />
            <Button
              title="Post"
              loading={sending}
              disabled={!text.trim()}
              onPress={() => void send()}
              style={styles.send}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(11,28,48,0.35)",
  },
  dismiss: { flex: 1 },
  sheet: {
    maxHeight: "72%",
    backgroundColor: colors.surfaceLowest,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
  },
  handleRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 8,
    minHeight: 40,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outlineVariant,
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onSurface,
  },
  close: {
    position: "absolute",
    right: 14,
    top: 10,
    padding: 6,
  },
  list: { paddingHorizontal: 14, paddingBottom: 8, flexGrow: 1 },
  empty: {
    textAlign: "center",
    color: colors.onSurfaceVariant,
    marginTop: 28,
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurface,
  },
  rowName: { fontWeight: "700" },
  rowMeta: {
    marginTop: 3,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  error: {
    color: colors.error,
    fontSize: 12,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.onSurface,
    backgroundColor: colors.surfaceLow,
  },
  send: { minWidth: 84 },
});
