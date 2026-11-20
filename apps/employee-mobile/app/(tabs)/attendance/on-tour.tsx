import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import { IconPlane } from "@/components/icons";
import { Button, Card, ErrorBox, Screen, TextField } from "@/components/ui";
import {
  TOUR_PURPOSE_PREFIX,
  countByStatusTab,
  formatDateRange,
  isOnTourPurpose,
  matchesStatusTab,
  statusBadge,
  stripTourPrefix,
  type StatusTab,
} from "@/lib/attendance-request-ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors } from "@/theme/colors";
import { RADIUS_FULL } from "@/theme/tokens";
import { todayLocalDate } from "@/utils/datetime";

const TRAVEL_PURPOSES = [
  "Client Meeting",
  "Conference",
  "Training",
  "Branch Visit",
  "Other",
] as const;

const TRAVEL_MODES = ["Flight", "Train", "Bus", "Car", "Other"] as const;

const TABS: { key: StatusTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

type OnDutyRow = {
  id: string;
  duty_date: string;
  end_date: string | null;
  portion: string;
  duty_location: string | null;
  purpose: string | null;
  reason: string | null;
  status: string;
};

export default function OnTourScreen() {
  const [tab, setTab] = useState<StatusTab>("all");
  const [rows, setRows] = useState<OnDutyRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [travelPurpose, setTravelPurpose] =
    useState<string>("Client Meeting");
  const [fromPlace, setFromPlace] = useState("");
  const [toPlace, setToPlace] = useState("");
  const [departure, setDeparture] = useState(todayLocalDate());
  const [returnDate, setReturnDate] = useState(todayLocalDate());
  const [travelMode, setTravelMode] = useState<string>("Flight");
  const [accommodation, setAccommodation] = useState<
    "required" | "not_required"
  >("required");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  const refresh = useCallback(async () => {
    setListLoading(true);
    try {
      const list = await essService.listOnDuty();
      const all = (list.data as OnDutyRow[]) ?? [];
      setRows(all.filter((r) => isOnTourPurpose(r.purpose)));
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load On Tour",
      );
    } finally {
      setListLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => undefined);
    }, [refresh]),
  );

  const filtered = useMemo(
    () => rows.filter((r) => matchesStatusTab(r.status, tab)),
    [rows, tab],
  );
  const counts = useMemo(() => countByStatusTab(rows), [rows]);

  async function onSubmit() {
    setError(null);
    setMessage(null);
    if (!fromPlace.trim() || !toPlace.trim()) {
      setError("Please enter From and To locations.");
      return;
    }
    if (returnDate < departure) {
      setError("Return date must be on or after departure.");
      return;
    }
    setLoading(true);
    try {
      const reasonParts = [
        `Mode: ${travelMode}`,
        `Accommodation: ${accommodation === "required" ? "Required" : "Not Required"}`,
        reason.trim() || null,
      ].filter(Boolean);

      await essService.createOnDuty({
        duty_date: departure,
        end_date: returnDate,
        portion: "full_day",
        duty_location: `${fromPlace.trim()} → ${toPlace.trim()}`,
        purpose: `${TOUR_PURPOSE_PREFIX}${travelPurpose}`,
        reason: reasonParts.join("\n") || undefined,
      });
      setMessage("On Tour request submitted for approval");
      setFromPlace("");
      setToPlace("");
      setReason("");
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="On Tour" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {message ? (
        <View style={styles.okBox}>
          <Text style={styles.okText}>{message}</Text>
        </View>
      ) : null}

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <IconPlane size={24} color="#ffffff" filled />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Business Travel</Text>
          <Text style={styles.heroSubtitle}>
            Track your travel requests and approval status.
          </Text>
        </View>
      </View>

      <Button
        title={showForm ? "Hide apply form" : "Apply On Tour"}
        variant="secondary"
        icon={<IconPlane size={18} color={colors.primary} />}
        onPress={() => setShowForm((v) => !v)}
      />

      {showForm ? (
        <Card style={styles.form}>
          <Text style={styles.fieldLabel}>Travel purpose</Text>
          <View style={styles.chipRow}>
            {TRAVEL_PURPOSES.map((t) => (
              <Pressable
                key={t}
                onPress={() => setTravelPurpose(t)}
                style={[
                  styles.chip,
                  travelPurpose === t && styles.chipActiveTour,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    travelPurpose === t && styles.chipTextActive,
                  ]}
                >
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextField
            label="From (city)"
            value={fromPlace}
            onChangeText={setFromPlace}
            placeholder="Departure city"
          />
          <TextField
            label="To (city)"
            value={toPlace}
            onChangeText={setToPlace}
            placeholder="Destination city"
          />
          <TextField
            label="Departure (YYYY-MM-DD)"
            value={departure}
            onChangeText={setDeparture}
            autoCapitalize="none"
          />
          <TextField
            label="Return (YYYY-MM-DD)"
            value={returnDate}
            onChangeText={setReturnDate}
            autoCapitalize="none"
          />
          <Text style={styles.fieldLabel}>Travel mode</Text>
          <View style={styles.chipRow}>
            {TRAVEL_MODES.map((m) => (
              <Pressable
                key={m}
                onPress={() => setTravelMode(m)}
                style={[
                  styles.chip,
                  travelMode === m && styles.chipActiveTour,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    travelMode === m && styles.chipTextActive,
                  ]}
                >
                  {m}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Accommodation</Text>
          <View style={styles.chipRow}>
            {(
              [
                { key: "required" as const, label: "Required" },
                { key: "not_required" as const, label: "Not Required" },
              ] as const
            ).map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => setAccommodation(opt.key)}
                style={[
                  styles.chip,
                  accommodation === opt.key && styles.chipActiveTour,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    accommodation === opt.key && styles.chipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextField
            label="Reason / details"
            value={reason}
            onChangeText={setReason}
            placeholder="Travel details…"
          />
          <Button
            title="Submit Request"
            loading={loading}
            onPress={() => void onSubmit()}
          />
        </Card>
      ) : null}

      <View style={styles.tabRow}>
        {TABS.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {label}
              {counts[key] > 0 ? ` (${counts[key]})` : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      {listLoading ? (
        <Text style={styles.loading}>Loading…</Text>
      ) : filtered.length === 0 ? (
        <Text style={styles.empty}>
          No On Tour requests. Tap Apply On Tour for business travel approval.
        </Text>
      ) : (
        filtered.map((row) => {
          const badge = statusBadge(row.status);
          return (
            <Card key={row.id} style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={styles.rowTitle}>
                  {stripTourPrefix(row.purpose) || "Business Travel"}
                </Text>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.fg }]}>
                    {badge.label}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {formatDateRange(row.duty_date, row.end_date)}
              </Text>
              {row.duty_location ? (
                <Text style={styles.meta}>{row.duty_location}</Text>
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12, paddingBottom: 32 },
  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 22,
    padding: 20,
    backgroundColor: "#EA580C",
    shadowColor: "#EA580C",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  heroCopy: { flex: 1 },
  heroTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.85)",
  },
  form: { gap: 12 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.onSurfaceVariant,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: RADIUS_FULL,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  chipActiveTour: {
    borderColor: "#EA580C",
    backgroundColor: "#FFEDD5",
  },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.onSurfaceVariant },
  chipTextActive: { color: "#C2410C" },
  tabRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: {
    borderRadius: RADIUS_FULL,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surfaceLow,
  },
  tabActive: { backgroundColor: "#FFEDD5" },
  tabText: { fontSize: 12, fontWeight: "600", color: colors.onSurfaceVariant },
  tabTextActive: { color: "#C2410C" },
  row: { gap: 4 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  rowTitle: { fontWeight: "700", color: colors.onSurface, flex: 1 },
  meta: { fontSize: 12, color: colors.onSurfaceVariant },
  badge: {
    borderRadius: RADIUS_FULL,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  loading: { textAlign: "center", fontSize: 14, color: colors.onSurfaceVariant },
  empty: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
    paddingVertical: 24,
  },
  okBox: {
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0,125,85,0.2)",
  },
  okText: { color: "#007d55", fontWeight: "600", fontSize: 14 },
});