import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { AppHeader } from "@/components/AppHeader";
import { TaskComposer } from "@/components/task/TaskComposer";
import { TaskDetail } from "@/components/task/TaskDetail";
import {
  taskStatusColor,
  taskStatusLabel,
} from "@/components/task/taskStatus";
import { IconPlus, IconTask } from "@/components/icons";
import { EmptyState, Screen } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors, radii } from "@/theme/colors";
import { formatDateTime } from "@/utils/datetime";
import type { EssTaskItem } from "@/types/api";

type Scope = "all" | "assigned" | "created";

/** Workplace tasks — assign, accept (starts timer), proof, verify. */
export default function TaskScreen() {
  const { me } = useAuth();
  const [scope, setScope] = useState<Scope>("all");
  const [tasks, setTasks] = useState<EssTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    setError(null);
    try {
      const res = await essService.listTasks(scope);
      setTasks(res.data ?? []);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Could not load tasks",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen
      header={<AppHeader name={me?.display_name} title="Tasks" />}
      contentStyle={styles.content}
    >
      <View style={styles.topActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create task"
          onPress={() => setComposerOpen(true)}
          style={styles.addBtn}
        >
          <IconPlus size={18} color="#fff" />
          <Text style={styles.addText}>New task</Text>
        </Pressable>
      </View>
      <View style={styles.scopeRow}>
        {(
          [
            ["all", "All"],
            ["assigned", "Assigned to me"],
            ["created", "Created by me"],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setScope(key)}
            style={[styles.scopeChip, scope === key && styles.scopeOn]}
          >
            <Text
              style={[styles.scopeText, scope === key && styles.scopeTextOn]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && !tasks.length ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load({ soft: true });
              }}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={
            tasks.length ? styles.list : styles.listEmpty
          }
          ListHeaderComponent={
            error ? <Text style={styles.error}>{error}</Text> : undefined
          }
          ListEmptyComponent={
            <EmptyState
              title="No tasks yet"
              description="Assign work to anyone in the company or to a department manager. Assignees accept to start the timer, then submit proof for your review."
              icon={<IconTask size={28} color={colors.primary} />}
            />
          }
          renderItem={({ item }) => {
            const status = item.my_assignee_status || item.status;
            return (
              <Pressable
                onPress={() => setDetailId(item.id)}
                style={({ pressed }) => [
                  styles.card,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      styles.badge,
                      {
                        color: taskStatusColor(status),
                        borderColor: taskStatusColor(status),
                      },
                    ]}
                  >
                    {taskStatusLabel(status)}
                  </Text>
                </View>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  From {item.creator_name}
                  {item.deadline ? ` · Due ${formatDateTime(item.deadline)}` : ""}
                </Text>
                <Text style={styles.cardMeta}>
                  {item.assignment_mode === "department"
                    ? `Dept · ${item.department_name || "—"}`
                    : `${item.assignee_count} assignee${item.assignee_count === 1 ? "" : "s"}`}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      <TaskComposer
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={() => void load({ soft: true })}
      />
      <TaskDetail
        taskId={detailId}
        visible={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        onChanged={() => void load({ soft: true })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, flex: 1 },
  topActions: {
    paddingHorizontal: 16,
    paddingTop: 4,
    alignItems: "flex-end",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  addText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  scopeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  scopeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainer,
  },
  scopeOn: { backgroundColor: colors.primary },
  scopeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurface,
  },
  scopeTextOn: { color: "#fff" },
  list: { paddingHorizontal: 16, paddingBottom: 120, gap: 10 },
  listEmpty: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 120 },
  card: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: 6,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: colors.onSurface,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: "700",
    overflow: "hidden",
  },
  cardMeta: { fontSize: 12, color: colors.onSurfaceVariant },
  error: { color: colors.error, fontSize: 13, marginBottom: 8 },
});
