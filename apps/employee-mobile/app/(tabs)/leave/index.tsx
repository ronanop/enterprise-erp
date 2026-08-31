import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { AppHeader } from "@/components/AppHeader";
import { OfflineBanner } from "@/components/OfflineBanner";
import {
  IconCalendar,
  IconChevronRight,
  IconClose,
  IconPlus,
} from "@/components/icons";
import { MonthRangeCalendar } from "@/components/MonthRangeCalendar";
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Screen,
  StatusBadge,
  leaveStatusTone,
  TextField,
} from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type {
  EssLeaveBalance,
  EssLeaveRequest,
  EssLeaveType,
} from "@/types/api";
import { colors, radii } from "@/theme/colors";
import { GUTTER, RADIUS_CARD, RADIUS_FULL } from "@/theme/tokens";
import {
  formatDisplayDateDDMMYYYY,
  formatLeaveRangeLine,
} from "@/utils/datetime";
import { leaveStatusDisplay } from "@/utils/leave-status";

export default function LeaveScreen() {
  const router = useRouter();
  const { me } = useAuth();
  const [types, setTypes] = useState<EssLeaveType[]>([]);
  const [balances, setBalances] = useState<EssLeaveBalance[]>([]);
  const [requests, setRequests] = useState<EssLeaveRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [applyCalendarCursor, setApplyCalendarCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daysCount, setDaysCount] = useState("1");
  const [reason, setReason] = useState("");

  const typeName = useMemo(() => {
    const map = new Map(types.map((t) => [t.id, t.leave_type_name]));
    return (id: string) => map.get(id) ?? "Leave";
  }, [types]);
  const balanceCards = useMemo(
    () =>
      balances.slice(0, 2).map((row, index) => {
        const closing = Number(row.closing_balance) || 0;
        const used = Number(row.used) || 0;
        const leaveType = types.find((t) => t.id === row.leave_type_id);
        const total = Math.max(
          closing + used,
          Number(leaveType?.max_days_per_year) || closing + used,
          1,
        );
        const themes = [
          { stroke: "#2563eb", soft: "#dbe1ff" },
          { stroke: "#ba1a1a", soft: "#ffdad6" },
        ];
        return {
          id: row.id,
          leaveTypeId: row.leave_type_id,
          name: typeName(row.leave_type_id),
          closing,
          total,
          pct: (closing / total) * 100,
          perMonth: Number(leaveType?.monthly_credit_days) || 0,
          ...themes[index % themes.length],
        };
      }),
    [balances, types, typeName],
  );
  const pending = requests.filter((r) =>
    ["draft", "submitted", "pending"].includes(r.status.toLowerCase()),
  );
  const dateSummaryLine = useMemo(() => {
    if (!startDate) return "Tap start day, then end day on the calendar";
    if (!endDate) {
      return `${formatDisplayDateDDMMYYYY(startDate)} → select end date`;
    }
    return formatLeaveRangeLine(startDate, endDate, daysCount);
  }, [startDate, endDate, daysCount]);
  const selectedTypeLabel =
    types
      .find((type) => type.id === leaveTypeId)
      ?.leave_type_name.replace(/ Leave$/i, "") ?? "Leave";

  const refresh = useCallback(async () => {
    const [t, b, r] = await Promise.all([
      essService.leaveTypes(),
      essService.leaveBalances(),
      essService.leaveRequests(),
    ]);
    const visibleTypes = (t.data ?? []).filter((row) => {
      const code = (row.leave_type_code ?? "").toUpperCase();
      const name = (row.leave_type_name ?? "").toLowerCase();
      return code !== "CO" && !name.includes("comp off");
    });
    setTypes(visibleTypes);
    setBalances(b.data ?? []);
    setRequests(r.data ?? []);
    if (!leaveTypeId && visibleTypes.length > 0) {
      setLeaveTypeId(visibleTypes[0].id);
    }
  }, [leaveTypeId]);

  useFocusEffect(
    useCallback(() => {
      refresh().catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load leave",
        ),
      );
    }, [refresh]),
  );

  useEffect(() => {
    if (!startDate || !endDate) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end < start
    ) {
      return;
    }
    const days =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    setDaysCount(String(days));
  }, [startDate, endDate]);

  function openApply(typeId?: string) {
    if (typeId) setLeaveTypeId(typeId);
    setStartDate("");
    setEndDate("");
    setDaysCount("1");
    setReason("");
    setStep(1);
    const now = new Date();
    setApplyCalendarCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setShowApply(true);
  }

  function closeApply() {
    setShowApply(false);
    setStep(1);
  }

  async function onSubmit() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await essService.createLeaveRequest({
        leave_type_id: leaveTypeId,
        start_date: startDate,
        end_date: endDate,
        days_count: daysCount,
        reason: reason.trim() || undefined,
      });
      closeApply();
      setReason("");
      setStartDate("");
      setEndDate("");
      setMessage("Leave submitted");
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to submit leave",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      scroll
      tabClearance
      banner={<OfflineBanner />}
      header={<AppHeader title="Leave Management" name={me?.display_name} />}
      contentStyle={styles.content}
      overlay={
        !showApply ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Apply leave"
            onPress={() => openApply()}
            style={({ pressed }) => [
              styles.fab,
              pressed ? styles.fabPressed : null,
            ]}
          >
            <IconPlus size={28} color="#ffffff" />
          </Pressable>
        ) : null
      }
    >
      {error && !showApply ? <ErrorBox>{error}</ErrorBox> : null}
      {message ? (
        <View style={styles.okBox}>
          <Text style={styles.okText}>{message}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeading}>Your Balances</Text>
          <Pressable onPress={() => router.push("/(tabs)/leave/history")}>
            <Text style={styles.actionLink}>Details</Text>
          </Pressable>
        </View>
        {balanceCards.length === 0 ? (
          <EmptyState
            title="No balances yet"
            icon={<IconCalendar size={20} color={colors.primary} />}
          />
        ) : (
          <View style={styles.balanceRow}>
            {balanceCards.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => openApply(b.leaveTypeId)}
                style={[styles.balanceCard, { backgroundColor: b.soft }]}
              >
                <View style={styles.balanceTop}>
                  <View style={styles.balanceIcon}>
                    <IconCalendar size={18} color={b.stroke} />
                  </View>
                  <Text style={styles.balanceFraction}>
                    {b.closing}/{b.total}
                  </Text>
                </View>
                <Text style={styles.balanceName}>{b.name}</Text>
                {b.perMonth > 0 ? (
                  <Text style={styles.balanceHint}>
                    {b.perMonth} day(s) / month
                  </Text>
                ) : null}
                <View style={styles.balanceTrack}>
                  <View
                    style={[
                      styles.balanceFill,
                      {
                        width: `${Math.min(100, b.pct)}%`,
                        backgroundColor: b.stroke,
                      },
                    ]}
                  />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Active Applications</Text>
        {pending.length === 0 ? (
          <EmptyState title="No active applications" />
        ) : (
          <View style={styles.list}>
            {pending.slice(0, 3).map((row) => (
              <Pressable
                key={row.id}
                onPress={() => router.push(`/(tabs)/leave/${row.id}`)}
              >
                <Card style={styles.activeRow}>
                  <View style={styles.activeIcon}>
                    <IconCalendar size={20} color={colors.secondary} />
                  </View>
                  <View style={styles.activeCopy}>
                    <View style={styles.reqTop}>
                      <Text style={styles.reqTitle}>
                        {typeName(row.leave_type_id)}
                      </Text>
                      <StatusBadge
                        status={leaveStatusDisplay(row.status)}
                        tone={leaveStatusTone(row.status)}
                      />
                    </View>
                    <Text style={styles.reqMeta}>
                      {formatLeaveRangeLine(
                        row.start_date,
                        row.end_date,
                        row.days_count,
                      )}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Card style={styles.quickApply}>
        <View style={styles.sectionHeader}>
          <Text style={styles.quickTitle}>Quick apply</Text>
          <Pressable onPress={() => openApply()}>
            <Text style={styles.actionLink}>Open calendar</Text>
          </Pressable>
        </View>
        <Text style={styles.quickCopy}>
          Use the + button to pick leave type and dates on the calendar
          (dd/mm/yyyy).
        </Text>
      </Card>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeading}>Upcoming Holidays</Text>
          <Pressable onPress={() => router.push("/(tabs)/leave/holidays")}>
            <Text style={styles.actionLink}>View All</Text>
          </Pressable>
        </View>
        {HOLIDAYS.map((holiday) => (
          <Pressable
            key={holiday.name}
            onPress={() => router.push("/(tabs)/leave/holidays")}
            style={styles.holiday}
          >
            <View style={[styles.holidayDot, { borderColor: holiday.color }]}>
              <Text style={[styles.holidayGlyph, { color: holiday.color }]}>
                •
              </Text>
            </View>
            <View style={styles.holidayCopy}>
              <Text style={styles.holidayName}>{holiday.name}</Text>
              <Text style={styles.holidayDate}>{holiday.date}</Text>
            </View>
            <StatusBadge status={holiday.tag} tone="info" />
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeading}>History</Text>
          <View style={styles.linkGroup}>
            {me?.is_manager || me?.can_approve_team_leave ? (
              <Pressable onPress={() => router.push("/(tabs)/leave/team")}>
                <Text style={styles.actionLink}>Team</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => router.push("/(tabs)/leave/history")}>
              <Text style={styles.actionLink}>See all</Text>
            </Pressable>
          </View>
        </View>
        {requests.length === 0 ? (
          <EmptyState title="No leave history yet" />
        ) : (
          <View style={styles.list}>
            {requests.slice(0, 4).map((row) => (
              <Pressable
                key={row.id}
                onPress={() => router.push(`/(tabs)/leave/${row.id}`)}
              >
                <Card style={styles.historyRow}>
                  <View>
                    <Text style={styles.reqTitle}>
                      {typeName(row.leave_type_id)}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {formatLeaveRangeLine(row.start_date, row.end_date)}
                    </Text>
                  </View>
                  <View style={styles.historyStatus}>
                    <StatusBadge
                      status={leaveStatusDisplay(row.status)}
                      tone={leaveStatusTone(row.status)}
                    />
                    <IconChevronRight size={14} color={colors.outlineVariant} />
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Modal visible={showApply} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalSpacer} />
              <Text style={styles.modalTitle}>Apply leave</Text>
              <Pressable
                accessibilityLabel="Close"
                onPress={closeApply}
                style={styles.closeButton}
              >
                <IconClose size={18} color={colors.onSurface} />
              </Pressable>
            </View>

            <View style={styles.stepRow}>
              {[
                { n: 1, label: "Type" },
                { n: 2, label: "Dates" },
                { n: 3, label: "Reason" },
              ].map((item, index) => (
                <View key={item.n} style={styles.stepItem}>
                  <Pressable
                    onPress={() => setStep(item.n)}
                    style={styles.stepButton}
                  >
                    <View
                      style={[
                        styles.stepBadge,
                        step >= item.n ? styles.stepBadgeActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepBadgeText,
                          step >= item.n ? styles.stepBadgeTextActive : null,
                        ]}
                      >
                        {item.n}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        step >= item.n ? styles.stepLabelActive : null,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                  {index < 2 ? <View style={styles.stepLine} /> : null}
                </View>
              ))}
            </View>

            <ScrollView
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
            >
              {error && showApply ? <ErrorBox>{error}</ErrorBox> : null}

              {step === 1 ? (
                <View style={styles.stepContent}>
                  <Text style={styles.pickerLabel}>Leave type</Text>
                  <View style={styles.typeChips}>
                    {types.map((type) => {
                      const active = leaveTypeId === type.id;
                      return (
                        <Pressable
                          key={type.id}
                          onPress={() => setLeaveTypeId(type.id)}
                          style={[styles.chip, active ? styles.chipActive : null]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              active ? styles.chipTextActive : null,
                            ]}
                          >
                            {type.leave_type_name.replace(/ Leave$/i, "")}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Button
                    title="Next: Select dates"
                    icon={<IconChevronRight size={18} color="#ffffff" />}
                    disabled={!leaveTypeId}
                    onPress={() => setStep(2)}
                  />
                </View>
              ) : null}

              {step === 2 ? (
                <View style={styles.stepContent}>
                  <Card style={styles.summaryCard}>
                    <Text style={styles.summaryKicker}>Selected dates</Text>
                    <Text style={styles.summaryValue}>{dateSummaryLine}</Text>
                  </Card>
                  <MonthRangeCalendar
                    cursor={applyCalendarCursor}
                    onCursorChange={setApplyCalendarCursor}
                    startDate={startDate}
                    endDate={endDate}
                    onRangeChange={(start, end) => {
                      setStartDate(start);
                      setEndDate(end);
                    }}
                  />
                  <Text style={styles.calendarHint}>
                    Tap once for start, again for end (same day = 1 day leave)
                  </Text>
                  <View style={styles.modalActions}>
                    <Button
                      title="Back"
                      variant="secondary"
                      onPress={() => setStep(1)}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Next: Reason"
                      icon={<IconChevronRight size={18} color="#ffffff" />}
                      disabled={!startDate || !endDate}
                      onPress={() => setStep(3)}
                      style={{ flex: 2 }}
                    />
                  </View>
                </View>
              ) : null}

              {step === 3 ? (
                <View style={styles.stepContent}>
                  <View style={styles.reviewCard}>
                    <Text style={styles.reviewType}>{selectedTypeLabel}</Text>
                    <Text style={styles.reviewDates}>{dateSummaryLine}</Text>
                  </View>
                  <TextField
                    label="Reason (optional)"
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Reason for leave"
                    multiline
                    numberOfLines={4}
                    style={styles.reasonField}
                  />
                  <View style={styles.modalActions}>
                    <Button
                      title="Back"
                      variant="secondary"
                      onPress={() => setStep(2)}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Submit leave"
                      loading={loading}
                      disabled={!leaveTypeId || !startDate || !endDate}
                      onPress={() => void onSubmit()}
                      style={{ flex: 2 }}
                    />
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, gap: 24 },
  section: { gap: 12 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  sectionHeading: { fontSize: 18, fontWeight: "600", color: colors.onSurface },
  actionLink: { fontSize: 14, fontWeight: "500", color: colors.primary },
  linkGroup: { flexDirection: "row", gap: 12 },
  balanceRow: { flexDirection: "row", gap: 12 },
  balanceCard: {
    flex: 1,
    gap: 10,
    borderRadius: RADIUS_CARD,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  balanceTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  balanceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  balanceFraction: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  balanceName: { fontSize: 14, color: colors.onSurface, fontWeight: "600" },
  balanceHint: { marginTop: -6, fontSize: 11, color: "#5b6b7c" },
  balanceTrack: {
    height: 6,
    overflow: "hidden",
    borderRadius: RADIUS_FULL,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  balanceFill: { height: "100%", borderRadius: RADIUS_FULL },
  list: { gap: 8 },
  activeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  activeIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS_FULL,
    backgroundColor: "#eaddff",
  },
  activeCopy: { flex: 1, gap: 2 },
  reqTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  reqTitle: { fontWeight: "700", color: colors.onSurface, flex: 1 },
  reqMeta: { fontSize: 13, color: colors.onSurfaceVariant },
  quickApply: { padding: 20, gap: 10 },
  quickTitle: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  quickCopy: { fontSize: 14, lineHeight: 20, color: colors.onSurfaceVariant },
  holiday: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: RADIUS_CARD,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.2)",
    backgroundColor: colors.surfaceLow,
    padding: 16,
  },
  holidayDot: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#ffffff",
  },
  holidayGlyph: { fontSize: 24, lineHeight: 26 },
  holidayCopy: { flex: 1 },
  holidayName: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  holidayDate: { marginTop: 2, fontSize: 12, color: colors.onSurfaceVariant },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  historyMeta: { marginTop: 2, fontSize: 12, color: colors.onSurfaceVariant },
  historyStatus: { flexDirection: "row", alignItems: "center", gap: 4 },
  fab: {
    position: "absolute",
    // The tab bar renders outside the screen area, so a single gutter of
    // clearance reproduces the PWA's gap above the nav.
    right: GUTTER,
    bottom: GUTTER,
    width: 56,
    height: 56,
    borderRadius: RADIUS_FULL,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryContainer,
    shadowColor: colors.primaryContainer,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabPressed: { opacity: 0.92, transform: [{ scale: 0.96 }] },
  okBox: {
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0,125,85,0.2)",
  },
  okText: { color: "#007d55", fontWeight: "600", fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(11,28,48,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalSpacer: { width: 40 },
  modalTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: colors.onSurface,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  stepRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  stepItem: { flex: 1, flexDirection: "row", alignItems: "center" },
  stepButton: { alignItems: "center", gap: 4 },
  stepBadge: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS_FULL,
    backgroundColor: "#e5eeff",
  },
  stepBadgeActive: { backgroundColor: colors.primary },
  stepBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurfaceVariant,
  },
  stepBadgeTextActive: { color: "#ffffff" },
  stepLabel: { fontSize: 12, fontWeight: "500", color: colors.onSurfaceVariant },
  stepLabelActive: { color: colors.primary },
  stepLine: {
    flex: 1,
    height: 1,
    marginHorizontal: 8,
    marginBottom: 16,
    backgroundColor: "rgba(195,198,215,0.5)",
  },
  modalBody: { gap: 12, paddingBottom: 8 },
  stepContent: { gap: 12 },
  pickerLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: colors.onSurfaceVariant,
  },
  typeChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.onSurfaceVariant },
  chipTextActive: { color: "#fff" },
  summaryCard: { gap: 4, padding: 14 },
  summaryKicker: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: colors.onSurfaceVariant,
  },
  summaryValue: { fontSize: 16, fontWeight: "600", color: colors.onSurface },
  calendarHint: {
    textAlign: "center",
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  reviewCard: {
    borderRadius: 12,
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  reviewType: { fontSize: 14, fontWeight: "600", color: colors.primary },
  reviewDates: { fontSize: 14, fontWeight: "500", color: colors.onSurface },
  reasonField: { minHeight: 88, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
});

const HOLIDAYS = [
  {
    name: "Diwali — Festival of Lights",
    date: "Oct 31, Thursday",
    tag: "Mandatory",
    color: "#f59e0b",
  },
  {
    name: "Christmas Day",
    date: "Dec 25, Wednesday",
    tag: "Restricted",
    color: "#10B981",
  },
  {
    name: "New Year's Eve",
    date: "Dec 31, Tuesday",
    tag: "Mandatory",
    color: "#2563eb",
  },
];
