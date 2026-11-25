import { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { IconClose } from "@/components/icons";
import { DeadlineDateTimePicker } from "@/components/task/DeadlineDateTimePicker";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors, radii } from "@/theme/colors";
import type {
  EssDepartmentDirectoryItem,
  EssEmployeeDirectoryItem,
} from "@/types/api";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
};

/** Create a workplace task — assign to people or a department. */
export function TaskComposer({ visible, onClose, onCreated }: Props) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [mode, setMode] = useState<"users" | "department">("users");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<EssEmployeeDirectoryItem[]>([]);
  const [depts, setDepts] = useState<EssDepartmentDirectoryItem[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<EssEmployeeDirectoryItem[]>(
    [],
  );
  const [selectedDept, setSelectedDept] =
    useState<EssDepartmentDirectoryItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setDeadline(null);
    setMode("users");
    setQuery("");
    setPeople([]);
    setDepts([]);
    setSelectedPeople([]);
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

  function togglePerson(p: EssEmployeeDirectoryItem) {
    setSelectedPeople((prev) => {
      if (prev.some((x) => x.employee_id === p.employee_id)) {
        return prev.filter((x) => x.employee_id !== p.employee_id);
      }
      return [...prev, p].slice(0, 25);
    });
  }

  async function submit() {
    const name = title.trim();
    if (!name) {
      setError("Task name is required.");
      return;
    }
    if (mode === "users" && selectedPeople.length === 0) {
      setError("Select at least one person.");
      return;
    }
    if (mode === "department" && !selectedDept) {
      setError("Select a department.");
      return;
    }
    const deadlineIso = deadline ? deadline.toISOString() : null;
    if (deadline && deadline.getTime() < Date.now()) {
      setError("Deadline cannot be in the past.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await essService.createTask({
        title: name,
        description: description.trim(),
        deadline: deadlineIso,
        assignment_mode: mode,
        assignee_employee_ids:
          mode === "users" ? selectedPeople.map((p) => p.employee_id) : [],
        department_id: mode === "department" ? selectedDept!.department_id : null,
      });
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create task");
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
          <Text style={styles.title}>New task</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Task name</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What needs to be done?"
            placeholderTextColor={colors.outline}
            style={styles.input}
            maxLength={200}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Details (optional)"
            placeholderTextColor={colors.outline}
            style={[styles.input, styles.area]}
            multiline
            maxLength={5000}
          />

          <Text style={styles.label}>Deadline</Text>
          <DeadlineDateTimePicker
            value={deadline}
            onChange={setDeadline}
            minimumDate={new Date()}
            disabled={busy}
          />

          <Text style={styles.label}>Assign to</Text>
          <View style={styles.modeRow}>
            <Pressable
              onPress={() => setMode("users")}
              style={[styles.modeChip, mode === "users" && styles.modeOn]}
            >
              <Text style={styles.modeText}>People</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("department")}
              style={[styles.modeChip, mode === "department" && styles.modeOn]}
            >
              <Text style={styles.modeText}>Department</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            {mode === "users"
              ? "Pick anyone in the company directory."
              : "Goes to the department head/manager, who can reassign inside the team."}
          </Text>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={mode === "users" ? "Search people…" : "Search departments…"}
            placeholderTextColor={colors.outline}
            style={styles.input}
          />

          {mode === "users" ? (
            <FlatList
              data={people}
              keyExtractor={(item) => item.employee_id}
              scrollEnabled={false}
              ListEmptyComponent={
                <Text style={styles.empty}>No matching people</Text>
              }
              renderItem={({ item }) => {
                const on = selectedPeople.some(
                  (p) => p.employee_id === item.employee_id,
                );
                return (
                  <Pressable
                    onPress={() => togglePerson(item)}
                    style={[styles.row, on && styles.rowOn]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{item.name}</Text>
                      <Text style={styles.rowSub}>
                        {item.employee_code}
                        {item.department_name ? ` · ${item.department_name}` : ""}
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
              scrollEnabled={false}
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

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title="Assign task"
            loading={busy}
            onPress={() => void submit()}
          />
        </ScrollView>
      </View>
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
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurfaceVariant,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.onSurface,
    backgroundColor: colors.surfaceLowest,
  },
  area: { minHeight: 88, textAlignVertical: "top" },
  modeRow: { flexDirection: "row", gap: 8 },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainer,
  },
  modeOn: { backgroundColor: colors.primary },
  modeText: { color: colors.onSurface, fontWeight: "700", fontSize: 13 },
  hint: { fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 17 },
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
  error: { color: colors.error, fontSize: 13 },
});
