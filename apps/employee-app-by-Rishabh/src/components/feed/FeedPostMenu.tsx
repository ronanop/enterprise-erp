import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { blockAuthor, reportPost } from "@/lib/feed-safety";
import { resolveFeedMediaUri } from "@/lib/feed-media";
import { colors, radii } from "@/theme/colors";
import type { EssFeedPost } from "@/types/api";

type Props = {
  post: EssFeedPost | null;
  visible: boolean;
  onClose: () => void;
  /** Called after the author is blocked so the feed can hide their posts. */
  onAuthorBlocked?: (authorEmployeeId: string) => void;
};

type MenuAction = "download" | "report" | "block" | "complain" | "copy";

export function FeedPostMenu({
  post,
  visible,
  onClose,
  onAuthorBlocked,
}: Props) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: MenuAction) {
    if (!post) return;
    setMessage(null);

    if (action === "download") {
      setBusy(true);
      try {
        const media = [...post.media].sort((a, b) => a.sort_order - b.sort_order);
        const first = media[0];
        if (!first?.url) {
          setMessage("No media available to download.");
          return;
        }
        const uri = await resolveFeedMediaUri(first.url, first.id);
        if (Platform.OS === "web") {
          const a = document.createElement("a");
          a.href = uri;
          a.download =
            first.media_type === "video"
              ? `feed-${post.id}.mp4`
              : `feed-${post.id}.jpg`;
          a.click();
          setMessage("Download started.");
          return;
        }
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            dialogTitle: "Save or share post media",
            mimeType: first.content_type || undefined,
          });
        } else {
          setMessage("Sharing is not available on this device.");
        }
      } catch {
        setMessage("Could not download this post.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (action === "copy") {
      const text = [post.author_name, post.caption].filter(Boolean).join("\n");
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          setMessage("Caption copied.");
        } else {
          Alert.alert("Caption", text || "No caption");
        }
      } catch {
        Alert.alert("Caption", text || "No caption");
      }
      return;
    }

    if (action === "report") {
      setBusy(true);
      try {
        await reportPost(post.id);
        Alert.alert(
          "Report submitted",
          "Thanks — this post was flagged for workplace admin review. You can also block the author to hide their posts.",
          [{ text: "OK", onPress: onClose }],
        );
      } catch {
        Alert.alert("Could not report", "Please try again.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (action === "block") {
      Alert.alert(
        `Block ${post.author_name}?`,
        "Their posts and stories will be hidden on this device. You can contact HR if you need the block lifted.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Block",
            style: "destructive",
            onPress: () => {
              void (async () => {
                setBusy(true);
                try {
                  await blockAuthor(post.author_employee_id);
                  onAuthorBlocked?.(post.author_employee_id);
                  Alert.alert(
                    "Author blocked",
                    `${post.author_name}'s content is hidden.`,
                    [{ text: "OK", onPress: onClose }],
                  );
                } catch {
                  Alert.alert("Could not block", "Please try again.");
                } finally {
                  setBusy(false);
                }
              })();
            },
          },
        ],
      );
      return;
    }

    if (action === "complain") {
      Alert.alert(
        "File a complaint",
        "Your complaint about this post was submitted to HR for follow-up.",
        [{ text: "OK", onPress: onClose }],
      );
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(16, insets.bottom + 12) },
          ]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Post options</Text>

          <MenuRow
            label="Download"
            description="Save or share the post media"
            onPress={() => void run("download")}
            disabled={busy}
          />
          <MenuRow
            label="Copy caption"
            description="Copy author name and caption"
            onPress={() => void run("copy")}
            disabled={busy}
          />
          <MenuRow
            label="Report"
            description="Flag inappropriate or policy-breaking content"
            onPress={() => void run("report")}
            disabled={busy}
            destructive
          />
          <MenuRow
            label="Block author"
            description="Hide this person's posts and stories on this device"
            onPress={() => void run("block")}
            disabled={busy}
            destructive
          />
          <MenuRow
            label="Complain"
            description="Send a workplace complaint to HR"
            onPress={() => void run("complain")}
            disabled={busy}
            destructive
          />

          {busy ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
          ) : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function MenuRow({
  label,
  description,
  onPress,
  disabled,
  destructive,
}: {
  label: string;
  description: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.rowLabel, destructive && styles.destructive]}>
        {label}
      </Text>
      <Text style={styles.rowDesc}>{description}</Text>
    </Pressable>
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
    backgroundColor: colors.surfaceLowest,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outlineVariant,
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onSurface,
    marginBottom: 8,
    textAlign: "center",
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.onSurface,
  },
  rowDesc: {
    marginTop: 2,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  destructive: { color: colors.error },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  message: {
    marginTop: 10,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
  cancel: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainer,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onSurface,
  },
});
