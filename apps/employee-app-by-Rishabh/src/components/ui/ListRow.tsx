import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors } from "@/theme/colors";

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ListRow({ title, subtitle, right, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.textCol}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(195,198,215,0.35)",
  },
  textCol: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  subtitle: { fontSize: 13, color: colors.onSurfaceVariant },
});
