import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader } from "@/components/AppHeader";
import { QuickAction, quickToneColor } from "@/components/QuickAction";
import {
  IconCalendar,
  IconClock,
  IconHelp,
  IconHome,
  IconLocation,
  IconSparkle,
  IconUser,
  IconWallet,
} from "@/components/icons";
import { Card, Screen } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { colors } from "@/theme/colors";
import { text } from "@/theme/tokens";

/** HR services hub — leaves, rooms, WFH, performance, and related tools. */
export default function HubScreen() {
  const router = useRouter();
  const { me } = useAuth();

  return (
    <Screen
      scroll
      tabClearance
      header={<AppHeader name={me?.display_name} title="Hub" />}
      contentStyle={styles.content}
    >
      <View style={styles.intro}>
        <Text style={styles.heading}>Workplace tools</Text>
        <Text style={styles.sub}>
          Leave, rooms, pay, and the rest of your day — one place.
        </Text>
      </View>

      <Card style={styles.section}>
        <Text style={text.sectionTitle}>Time & leave</Text>
        <View style={styles.grid}>
          <QuickAction
            label="Apply Leave"
            tone="default"
            icon={<IconCalendar size={26} color={quickToneColor("default")} />}
            onPress={() => router.push("/(tabs)/leave")}
          />
          <QuickAction
            label="WFH"
            icon={<IconHome size={26} color={quickToneColor("default")} />}
            onPress={() => router.push("/(tabs)/attendance/wfh")}
          />
          <QuickAction
            label="Timesheet"
            tone="amber"
            icon={<IconClock size={26} color={quickToneColor("amber")} />}
            onPress={() => router.push("/timesheet")}
          />
          <QuickAction
            label="Roster"
            tone="default"
            icon={<IconCalendar size={26} color={quickToneColor("default")} />}
            onPress={() => router.push("/roster")}
          />
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={text.sectionTitle}>Pay & growth</Text>
        <View style={styles.grid}>
          <QuickAction
            label="Payslip"
            tone="emerald"
            icon={<IconWallet size={26} color={quickToneColor("emerald")} />}
            onPress={() => router.push("/(tabs)/payslips")}
          />
          <QuickAction
            label="Performance"
            tone="emerald"
            icon={<IconSparkle size={26} color={quickToneColor("emerald")} />}
            onPress={() => router.push("/performance")}
          />
          <QuickAction
            label="Training"
            icon={<IconUser size={26} color={quickToneColor("default")} />}
            onPress={() => router.push("/training")}
          />
          <QuickAction
            label="Documents"
            tone="emerald"
            icon={<IconWallet size={26} color={quickToneColor("emerald")} />}
            onPress={() => router.push("/documents")}
          />
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={text.sectionTitle}>Workplace</Text>
        <View style={styles.grid}>
          <QuickAction
            label="Meeting rooms"
            tone="default"
            icon={<IconLocation size={26} color={quickToneColor("default")} />}
            onPress={() => router.push("/rooms")}
          />
          <QuickAction
            label="Policies"
            tone="emerald"
            icon={<IconWallet size={26} color={quickToneColor("emerald")} />}
            onPress={() => router.push("/compliance")}
          />
          <QuickAction
            label="Announcements"
            icon={<IconSparkle size={26} color={quickToneColor("default")} />}
            onPress={() => router.push("/announcements")}
          />
          <QuickAction
            label="Help"
            tone="amber"
            icon={<IconHelp size={26} color={quickToneColor("amber")} />}
            onPress={() => router.push("/support")}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, gap: 16 },
  intro: { gap: 6, paddingHorizontal: 2, marginBottom: 4 },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.6,
    color: colors.onSurface,
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurfaceVariant,
    maxWidth: 320,
  },
  section: { gap: 14, paddingVertical: 18 },
  grid: {
    flexDirection: "row",
    gap: 6,
  },
});
