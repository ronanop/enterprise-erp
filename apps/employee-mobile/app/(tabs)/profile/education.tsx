import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SubHeader } from "@/components/AppHeader";
import { Card, EmptyState, ErrorBox, Screen } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssEducationSkills } from "@/types/api";
import { colors } from "@/theme/colors";

export default function EducationScreen() {
  const [data, setData] = useState<EssEducationSkills | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    essService
      .educationSkills()
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load education",
        ),
      );
  }, []);

  return (
    <Screen scroll header={<SubHeader title="Education & skills" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      <Text style={styles.section}>Education</Text>
      {!data?.education?.length ? (
        <EmptyState title="No education" message="Nothing on file yet." />
      ) : (
        data.education.map((e, i) => (
          <Card key={i} style={styles.card}>
            <Text style={styles.title}>{e.degree}</Text>
            <Text style={styles.meta}>
              {[e.institution, e.field_of_study, e.end_year]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </Card>
        ))
      )}

      <Text style={styles.section}>Skills</Text>
      <View style={styles.skills}>
        {(data?.skills ?? []).map((s, i) => (
          <View key={i} style={styles.skill}>
            <Text style={styles.skillText}>
              {s.name}
              {s.level ? ` · ${s.level}` : ""}
            </Text>
          </View>
        ))}
      </View>
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
  title: { fontWeight: "700", color: colors.onSurface },
  meta: { fontSize: 12, color: colors.onSurfaceVariant },
  skills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skill: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  skillText: { fontSize: 12, fontWeight: "600", color: colors.primary },
});
