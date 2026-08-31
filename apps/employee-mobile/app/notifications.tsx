import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { OfflineBanner } from "@/components/OfflineBanner";
import { IconBell } from "@/components/icons";
import { Button, EmptyState, ErrorBox, Screen } from "@/components/ui";
import { resolveEssNotificationHref } from "@/lib/notification-href";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssNotification } from "@/types/api";
import { colors } from "@/theme/colors";
import { formatDateTime } from "@/utils/datetime";

export default function NotificationsScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<EssNotification[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await essService.notifications();
      setRows(res.data ?? []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to load notifications",
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onOpen(n: EssNotification) {
    if (!n.read) {
      try {
        await essService.markNotificationRead(n.id);
      } catch {
        // ignore
      }
    }
    router.push(resolveEssNotificationHref(n) as "/(tabs)/home");
    await load();
  }

  return (
    <Screen
      banner={<OfflineBanner />}
      header={<SubHeader title="Notifications" />}
      contentStyle={styles.screenContent}
    >
      <View style={styles.wrap}>
        <View style={styles.topBar}>
          <Button
            title="Mark all read"
            variant="ghost"
            onPress={() =>
              void essService.markAllNotificationsRead().then(load)
            }
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              alignSelf: "flex-end",
            }}
          />
        </View>
        {error ? (
          <View style={{ paddingHorizontal: 16 }}>
            <ErrorBox>{error}</ErrorBox>
          </View>
        ) : null}
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title="No notifications"
              description="You're all caught up. New alerts will show up here."
              icon={<IconBell size={20} color={colors.primary} />}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.title}
              onPress={() => void onOpen(item)}
              style={styles.row}
            >
              <View style={[styles.dot, item.read && styles.dotRead]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowBody}>{item.body}</Text>
                <Text style={styles.rowMeta}>
                  {formatDateTime(item.created_at)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingHorizontal: 0, flex: 1 },
  wrap: { flex: 1, backgroundColor: colors.background },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  row: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.35)",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primaryContainer,
    marginTop: 5,
  },
  dotRead: { backgroundColor: colors.outlineVariant },
  rowTitle: { fontWeight: "700", color: colors.onSurface },
  rowBody: { marginTop: 4, fontSize: 13, color: colors.onSurfaceVariant },
  rowMeta: { marginTop: 6, fontSize: 11, color: colors.outline },
});
