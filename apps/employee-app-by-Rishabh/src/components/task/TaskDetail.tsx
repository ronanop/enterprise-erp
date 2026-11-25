import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { IconClose } from "@/components/icons";
import {
  formatElapsed,
  taskStatusColor,
  taskStatusLabel,
} from "@/components/task/taskStatus";
import { TaskTransferSheet } from "@/components/task/TaskTransferSheet";
import { useAuth } from "@/context/auth-context";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors, radii } from "@/theme/colors";
import { formatDateTime } from "@/utils/datetime";
import type { EssTaskItem } from "@/types/api";

type Props = {
  taskId: string | null;
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
};

/** Task detail — accept/reject/transfer, timer, proof, verify. */
export function TaskDetail({ taskId, visible, onClose, onChanged }: Props) {
  const insets = useSafeAreaInsets();
  const { me } = useAuth();
  const [task, setTask] = useState<EssTaskItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [redoReason, setRedoReason] = useState("");
  const [tick, setTick] = useState(0);
  const [transferOpen, setTransferOpen] = useState(false);

  const myRow = useMemo(() => {
    if (!task || !me?.employee_id) return null;
    return (
      task.assignees.find((a) => a.employee_id === me.employee_id) ?? null
    );
  }, [task, me?.employee_id]);

  async function load() {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await essService.getTask(taskId);
      setTask((res.data as EssTaskItem | undefined) ?? null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not load task");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!visible || !taskId) {
      setTask(null);
      setTransferOpen(false);
      return;
    }
    void load();
  }, [visible, taskId]);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [visible]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitProof() {
    if (!taskId) return;
    const picked = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.length) return;
    const files: {
      file_base64: string;
      file_name: string;
      content_type: string | null;
    }[] = [];
    for (const asset of picked.assets.slice(0, 5)) {
      const content_base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      files.push({
        file_base64: content_base64,
        file_name: asset.name || `proof-${Date.now()}.bin`,
        content_type: asset.mimeType ?? null,
      });
    }
    await run(() =>
      essService.completeTask(taskId, { note: note.trim(), files }),
    );
    setNote("");
  }

  const status = myRow?.status || task?.my_assignee_status || task?.status;
  const startedAt = myRow?.started_at || null;
  void tick; // refresh elapsed label

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <View style={styles.top}>
          <Pressable onPress={onClose} hitSlop={10}>
            <IconClose size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Task</Text>
          <View style={{ width: 22 }} />
        </View>

        {loading && !task ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : task ? (
          <ScrollView
            contentContainerStyle={[
              styles.body,
              { paddingBottom: insets.bottom + 24 },
            ]}
          >
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text
              style={[
                styles.badge,
                { color: taskStatusColor(status), borderColor: taskStatusColor(status) },
              ]}
            >
              {taskStatusLabel(status)}
            </Text>
            {task.description ? (
              <Text style={styles.desc}>{task.description}</Text>
            ) : null}
            <Text style={styles.meta}>
              From {task.creator_name}
              {task.deadline ? ` · Due ${formatDateTime(task.deadline)}` : ""}
            </Text>
            {task.assignment_mode === "department" ? (
              <Text style={styles.meta}>
                Department: {task.department_name || "—"}
              </Text>
            ) : null}

            {startedAt &&
            status &&
            ["started", "in_progress", "pending_verification", "redo_requested"].includes(
              status,
            ) ? (
              <View style={styles.timerCard}>
                <Text style={styles.timerLabel}>Work timer</Text>
                <Text style={styles.timerValue}>{formatElapsed(startedAt)}</Text>
              </View>
            ) : null}

            {status === "redo_requested" && myRow?.review_note ? (
              <View style={styles.rejectBox}>
                <Text style={styles.rejectTitle}>
                  Your proof was rejected — please submit again
                </Text>
                <Text style={styles.rejectBody}>{myRow.review_note}</Text>
              </View>
            ) : null}

            <Text style={styles.section}>Assignees</Text>
            {task.assignees.map((a) => (
              <View key={a.id} style={styles.assigneeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.assigneeName}>{a.name}</Text>
                  <Text style={styles.assigneeStatus}>
                    {taskStatusLabel(a.status)}
                    {a.started_at ? ` · ${formatElapsed(a.started_at)}` : ""}
                  </Text>
                </View>
                {task.can_verify && a.status === "pending_verification" ? (
                  <View style={styles.verifyRow}>
                    <Button
                      title="Accept proof"
                      variant="secondary"
                      disabled={busy}
                      onPress={() =>
                        void run(() =>
                          essService.verifyTaskAssignee(task.id, a.id),
                        )
                      }
                      style={styles.smallBtn}
                    />
                    <TextInput
                      value={redoReason}
                      onChangeText={setRedoReason}
                      placeholder="Reject reason"
                      placeholderTextColor={colors.outline}
                      style={styles.redoInput}
                    />
                    <Button
                      title="Reject"
                      variant="danger"
                      disabled={busy || !redoReason.trim()}
                      onPress={() =>
                        void run(async () => {
                          await essService.requestTaskRedo(task.id, a.id, {
                            reason: redoReason.trim(),
                          });
                          setRedoReason("");
                        })
                      }
                      style={styles.smallBtn}
                    />
                  </View>
                ) : null}
              </View>
            ))}

            {status === "assigned" ? (
              <View style={styles.actions}>
                <Text style={styles.section}>Your response</Text>
                <Button
                  title="Accept"
                  loading={busy}
                  onPress={() => void run(() => essService.acceptTask(task.id))}
                />
                <Button
                  title="Reject"
                  variant="danger"
                  disabled={busy}
                  onPress={() => void run(() => essService.declineTask(task.id))}
                />
                <Button
                  title="Transfer to someone else"
                  variant="secondary"
                  disabled={busy}
                  onPress={() => setTransferOpen(true)}
                />
              </View>
            ) : null}

            {status &&
            ["started", "in_progress", "accepted", "redo_requested"].includes(
              status,
            ) ? (
              <View style={styles.actions}>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Proof note (optional)"
                  placeholderTextColor={colors.outline}
                  style={styles.input}
                />
                <Button
                  title="Submit proof"
                  loading={busy}
                  onPress={() => void submitProof()}
                />
              </View>
            ) : null}

            {task.can_reassign_within_department && status !== "assigned" ? (
              <Text style={styles.hint}>
                As department head you can still reassign within the team after
                accepting, via Transfer when the task is pending accept.
              </Text>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
        ) : (
          <Text style={styles.error}>{error || "Task not found"}</Text>
        )}
      </View>

      {taskId ? (
        <TaskTransferSheet
          visible={transferOpen}
          taskId={taskId}
          onClose={() => setTransferOpen(false)}
          onTransferred={() => {
            void load();
            onChanged();
          }}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
  body: { paddingHorizontal: 16, gap: 10 },
  taskTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.onSurface,
  },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
  },
  desc: { color: colors.onSurfaceVariant, fontSize: 14, lineHeight: 20 },
  meta: { color: colors.onSurfaceVariant, fontSize: 12 },
  timerCard: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  timerLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurfaceVariant,
  },
  timerValue: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: "800",
    color: colors.primary,
  },
  rejectBox: {
    backgroundColor: colors.errorContainer,
    borderRadius: radii.md,
    padding: 12,
    gap: 4,
  },
  rejectTitle: { color: colors.error, fontWeight: "800", fontSize: 13 },
  rejectBody: { color: colors.onSurface, fontSize: 13 },
  section: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
  },
  assigneeRow: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.sm,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  assigneeName: { fontWeight: "700", color: colors.onSurface },
  assigneeStatus: { color: colors.onSurfaceVariant, fontSize: 12, marginTop: 2 },
  verifyRow: { gap: 8 },
  smallBtn: { alignSelf: "stretch" },
  redoInput: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.onSurface,
    backgroundColor: colors.background,
  },
  actions: { gap: 8, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.onSurface,
    backgroundColor: colors.surfaceLowest,
  },
  hint: { fontSize: 12, color: colors.onSurfaceVariant },
  error: { color: colors.error, fontSize: 13, padding: 16 },
});
