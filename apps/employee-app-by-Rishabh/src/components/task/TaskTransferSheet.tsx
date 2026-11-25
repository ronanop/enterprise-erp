import { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { IconClose } from "@/components/icons";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors, radii } from "@/theme/colors";
import type {
  EssDepartmentDirectoryItem,
  EssEmployeeDirectoryItem,
} from "@/types/api";

type Props = {
  visible: boolean;
  taskId: string;
  onClose: () => void;
  onTransferred: () => void;
};

/** Search people or department and transfer a pending task assignment. */
export function TaskTransferSheet({
  visible,
  taskId,
  onClose,
  onTransferred,
}: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"users" | "department">("users");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<EssEmployeeDirectoryItem[]>([]);
  const [depts, setDepts] = useState<EssDepartmentDirectoryItem[]>([]);
  const [selectedPerson, setSelectedPerson] =
    useState<EssEmployeeDirectoryItem | null>(null);
  const [selectedDept, setSelectedDept] =
    useState<EssDepartmentDirectoryItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode("users");
    setQuery("");
    setPeople([]);
    setDepts([]);
    setSelectedPerson(null);
    setSelectedDept(null);
    setError(null);
    setBusy(false);
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      if (mode === "users") {
        void essService
          .searchEmployees(query, { limit: 30 })
          .then((res) => setPeople(res.data ?? []))
          .catch(() => setPeople([]));
      } else {
        void essService
          .listDepartments(query)
          .then((res) => setDepts(res.data ?? []))
          .catch(() => setDepts([]));
      }
    }, 200);
    return () => clearTimeout(t);
  }, [visible, mode, query]);

  async function submit() {
    if (mode === "users" && !selectedPerson) {
      setError("Select a person.");
      return;
    }
    if (mode === "department" && !selectedDept) {
      setError("Select a department.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await essService.transferTask(taskId, {
        assignment_mode: mode,
        assignee_employee_ids:
          mode === "users" && selectedPerson
            ? [selectedPerson.employee_id]
            : [],
        department_id:
          mode === "department" ? selectedDept!.department_id : null,
      });
      reset();
      onTransferred();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Could not transfer task",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <View style={styles.top}>
          <Pressable onPress={close} hitSlop={10} disabled={busy}>
            <IconClose size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Transfer task</Text>
          <View style={{ width: 22 }} />
        </View>

        <Text style={styles.hint}>
          Hand this assignment to another person or a department manager. They
          will get Accept / Reject / Transfer options.
        </Text>

        <View style={styles.modeRow}>
          <Pressable
            onPress={() => {
              setMode("users");
              setSelectedDept(null);
            }}
            style={[styles.modeChip, mode === "users" && styles.modeOn]}
          >
            <Text style={styles.modeText}>Person</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMode("department");
              setSelectedPerson(null);
            }}
            style={[styles.modeChip, mode === "department" && styles.modeOn]}
          >
            <Text style={styles.modeText}>Department</Text>
          </Pressable>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={
            mode === "users" ? "Search people…" : "Search departments…"
          }
          placeholderTextColor={colors.outline}
          style={styles.input}
        />

        {mode === "users" ? (
          <FlatList
            data={people}
            keyExtractor={(item) => item.employee_id}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
            ListEmptyComponent={
              <Text style={styles.empty}>No matching people</Text>
            }
            renderItem={({ item }) => {
              const on = selectedPerson?.employee_id === item.employee_id;
              return (
                <Pressable
                  onPress={() => setSelectedPerson(item)}
                  style={[styles.row, on && styles.rowOn]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.name}</Text>
                    <Text style={styles.rowSub}>
                      {item.employee_code}
                      {item.department_name
                        ? ` · ${item.department_name}`
                        : ""}
                    </Text>
                  </View>
                  <Text style={styles.check}>{on ? "✓" : ""}</Text>
                </Pressable>
              );
            }}
          />
        ) : (
          <FlatList
            data={depts}
            keyExtractor={(item) => item.department_id}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
            ListEmptyComponent={
              <Text style={styles.empty}>No matching departments</Text>
            }
            renderItem={({ item }) => {
              const on = selectedDept?.department_id === item.department_id;
              return (
                <Pressable
                  onPress={() =>
                    item.assignable ? setSelectedDept(item) : undefined
                  }
                  style={[
                    styles.row,
                    on && styles.rowOn,
                    !item.assignable && styles.rowDisabled,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.department_name}</Text>
                    <Text style={styles.rowSub}>
                      {item.assignable
                        ? `Head: ${item.head_name || item.head_employee_code || "—"}`
                        : "No head/manager — not assignable"}
                    </Text>
                  </View>
                  <Text style={styles.check}>{on ? "✓" : ""}</Text>
                </Pressable>
              );
            }}
          />
        )}

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title="Transfer"
            loading={busy}
            onPress={() => void submit()}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
  hint: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    lineHeight: 17,
    marginBottom: 10,
  },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainer,
  },
  modeOn: { backgroundColor: colors.primary },
  modeText: { color: colors.onSurface, fontWeight: "700", fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.onSurface,
    backgroundColor: colors.surfaceLowest,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLowest,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  rowOn: { borderColor: colors.primary, backgroundColor: colors.surfaceLow },
  rowDisabled: { opacity: 0.45 },
  rowTitle: { fontWeight: "700", color: colors.onSurface, fontSize: 14 },
  rowSub: { color: colors.onSurfaceVariant, fontSize: 12, marginTop: 2 },
  check: { color: colors.primary, fontWeight: "800", fontSize: 16, width: 20 },
  empty: { color: colors.onSurfaceVariant, paddingVertical: 12 },
  footer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 0,
    backgroundColor: colors.background,
    paddingTop: 8,
    gap: 8,
  },
  error: { color: colors.error, fontSize: 13 },
});
