import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { Button, Card, EmptyState, ErrorBox, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type {
  EssMeetingBooking,
  EssMeetingRoomAvailability,
} from "@/types/api";
import { colors } from "@/theme/colors";
import { formatDisplayDateDDMMYYYY, todayLocalDate } from "@/utils/datetime";

export default function RoomsScreen() {
  const router = useRouter();
  const [avail, setAvail] = useState<EssMeetingRoomAvailability[]>([]);
  const [bookings, setBookings] = useState<EssMeetingBooking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const onDate = todayLocalDate();

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        essService.meetingRoomAvailability(onDate),
        essService.myMeetingBookings(),
      ])
        .then(([a, b]) => {
          setAvail(a.data ?? []);
          setBookings(b.data ?? []);
        })
        .catch((err) =>
          setError(
            err instanceof ApiClientError ? err.message : "Failed to load rooms",
          ),
        );
    }, [onDate]),
  );

  return (
    <Screen scroll header={<SubHeader title="Meeting rooms" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      <Text style={styles.section}>
        Availability · {formatDisplayDateDDMMYYYY(onDate)}
      </Text>
      {avail.length === 0 ? (
        <EmptyState title="No rooms" message="No meeting rooms configured." />
      ) : (
        avail.map((row) => (
          <Pressable
            key={row.room.id}
            onPress={() =>
              router.push({
                pathname: "/rooms/book",
                params: { roomId: row.room.id, roomName: row.room.room_name },
              })
            }
          >
            <Card style={styles.card}>
              <View style={styles.top}>
                <Text style={styles.title}>{row.room.room_name}</Text>
                <Text
                  style={{
                    color: row.is_busy ? colors.error : "#007d55",
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {row.is_busy ? "Busy" : "Free"}
                </Text>
              </View>
              <Text style={styles.meta}>
                {row.room.room_code} · {row.room.capacity} seats
                {row.room.notes ? ` · ${row.room.notes}` : ""}
              </Text>
            </Card>
          </Pressable>
        ))
      )}

      <Button title="Book a room" onPress={() => router.push("/rooms/book")} />

      <Text style={styles.section}>My bookings</Text>
      {bookings.map((b) => (
        <Card key={b.id} style={styles.card}>
          <Text style={styles.title}>{b.title}</Text>
          <Text style={styles.meta}>
            {b.room_name} · {formatDisplayDateDDMMYYYY(b.request_date)}
            {b.start_time ? ` · ${b.start_time}` : ""}
            {b.end_time ? `–${b.end_time}` : ""}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  section: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.onSurfaceVariant,
  },
  card: { gap: 4 },
  top: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { fontWeight: "700", color: colors.onSurface, flex: 1 },
  meta: { fontSize: 12, color: colors.onSurfaceVariant },
});
