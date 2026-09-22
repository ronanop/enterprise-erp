import { Stack } from "expo-router";
import { colors } from "@/theme/colors";

export function WorkplaceStack({
  screens,
}: {
  screens: { name: string; title?: string; headerShown?: boolean }[];
}) {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {screens.map((s) => (
        <Stack.Screen key={s.name} name={s.name} />
      ))}
    </Stack>
  );
}
