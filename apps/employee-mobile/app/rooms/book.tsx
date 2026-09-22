import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, ErrorBox, Screen, TextField } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMeetingRoom } from "@/types/api";
import { colors, radii } from "@/theme/colors";
import { todayLocalDate } from "@/utils/datetime";

export default function BookRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ roomId?: string; roomName?: string }>();
  const [rooms, setRooms] = useState<EssMeetingRoom[]>([]);
  const [roomId, setRoomId] = useState(params.roomId ?? "");
  const [title, setTitle] = useState("");
  const [requestDate, setRequestDate] = useState(todayLocalDate());
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    essService
      .meetingRooms()
      .then((res) => {
        const list = res.data ?? [];
        setRooms(list);
        if (!roomId && list[0]) setRoomId(list[0].id);
      })
      .catch(() => undefined);
  }, [roomId]);

  async function onSubmit() {
    if (!roomId || !title.trim()) {
      setError("Room and title are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await essService.createMeetingBooking({
        room_id: roomId,
        title: title.trim(),
        request_date: requestDate,
        start_time: startTime || undefined,
        end_time: endTime || undefined,
      });
      router.replace("/rooms");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="Book room" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      <Card style={styles.form}>
        <Text style={styles.label}>Room</Text>
        <View style={styles.chips}>
          {rooms.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => setRoomId(r.id)}
              style={[styles.chip, roomId === r.id && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  roomId === r.id && styles.chipTextActive,
                ]}
              >
                {r.room_name}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextField label="Title" value={title} onChangeText={setTitle} />
        <TextField
          label="Date (YYYY-MM-DD)"
          value={requestDate}
          onChangeText={setRequestDate}
          autoCapitalize="none"
        />
        <TextField label="Start (HH:MM)" value={startTime} onChangeText={setStartTime} autoCapitalize="none" />
        <TextField label="End (HH:MM)" value={endTime} onChangeText={setEndTime} autoCapitalize="none" />
        <Button title="Book" loading={loading} onPress={() => void onSubmit()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  form: { gap: 12 },
  label: { fontSize: 14, fontWeight: "500", color: "#374151" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primaryContainer,
  },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.onSurfaceVariant },
  chipTextActive: { color: "#fff" },
});
