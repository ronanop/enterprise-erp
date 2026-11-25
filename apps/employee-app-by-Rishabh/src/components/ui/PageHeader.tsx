import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { colors } from "@/theme/colors";
import { text } from "@/theme/tokens";

/** Mirrors the PWA PageHeader: big title, optional subtitle, optional action row. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.titleCol}>
        <Text style={text.pageTitle}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.actionRow}>{action}</View> : null}
    </View>
  );
}

/** Mirrors the PWA SectionLabel: heading with an optional "See all" link. */
export function SectionLabel({
  title,
  href,
  linkLabel = "See all",
  onPress,
}: {
  title: string;
  href?: Href;
  linkLabel?: string;
  onPress?: () => void;
}) {
  const router = useRouter();
  const handler = onPress ?? (href ? () => router.push(href) : undefined);

  return (
    <View style={styles.sectionRow}>
      <Text style={text.sectionHeading}>{title}</Text>
      {handler ? (
        <Pressable onPress={handler} hitSlop={8}>
          <Text style={styles.link}>{linkLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 16 },
  titleCol: { gap: 6 },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.onSurfaceVariant,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  sectionRow: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 2,
  },
  link: { fontSize: 14, fontWeight: "500", color: colors.primary },
});
