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
import { Screen } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { colors } from "@/theme/colors";

/** HR services hub — leaves, rooms, WFH, performance, and related tools. */
export default function HubScreen() {
  const router = useRouter();
  const { me } = useAuth();

  return (
    <Screen
      header={<AppHeader name={me?.display_name} />}
      contentStyle={styles.content}
    >
      <Text style={styles.heading}>HR services</Text>
      <Text style={styles.sub}>
        Leaves, rooms, WFH, performance, and other workplace tools.
      </Text>

      <View style={styles.grid}>
        <QuickAction
          label="Apply Leave"
          tone="violet"
          icon={<IconCalendar size={28} color={quickToneColor("violet")} />}
          onPress={() => router.push("/(tabs)/leave")}
        />
        <QuickAction
          label="WFH"
          icon={<IconHome size={28} color={quickToneColor("default")} />}
          onPress={() => router.push("/(tabs)/attendance/wfh")}
        />
        <QuickAction
          label="Meeting rooms"
          tone="violet"
          icon={<IconLocation size={28} color={quickToneColor("violet")} />}
          onPress={() => router.push("/rooms")}
        />
        <QuickAction
          label="Performance"
          tone="emerald"
          icon={<IconSparkle size={28} color={quickToneColor("emerald")} />}
          onPress={() => router.push("/performance")}
        />
      </View>

      <View style={styles.grid}>
        <QuickAction
          label="Payslip"
          tone="emerald"
          icon={<IconWallet size={28} color={quickToneColor("emerald")} />}
          onPress={() => router.push("/(tabs)/payslips")}
        />
        <QuickAction
          label="Timesheet"
          tone="amber"
          icon={<IconClock size={28} color={quickToneColor("amber")} />}
          onPress={() => router.push("/timesheet")}
        />
        <QuickAction
          label="Training"
          icon={<IconUser size={28} color={quickToneColor("default")} />}
          onPress={() => router.push("/training")}
        />
        <QuickAction
          label="Policies"
          tone="emerald"
          icon={<IconWallet size={28} color={quickToneColor("emerald")} />}
          onPress={() => router.push("/compliance")}
        />
      </View>

      <View style={styles.grid}>
        <QuickAction
          label="Roster"
          tone="violet"
          icon={<IconCalendar size={28} color={quickToneColor("violet")} />}
          onPress={() => router.push("/roster")}
        />
        <QuickAction
          label="Help"
          tone="amber"
          icon={<IconHelp size={28} color={quickToneColor("amber")} />}
          onPress={() => router.push("/support")}
        />
        <QuickAction
          label="Announcements"
          icon={<IconSparkle size={28} color={quickToneColor("default")} />}
          onPress={() => router.push("/announcements")}
        />
        <QuickAction
          label="Documents"
          tone="emerald"
          icon={<IconWallet size={28} color={quickToneColor("emerald")} />}
          onPress={() => router.push("/documents")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14 },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.onSurface,
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
    marginTop: -6,
    marginBottom: 4,
  },
  grid: {
    flexDirection: "row",
    gap: 10,
  },
});
