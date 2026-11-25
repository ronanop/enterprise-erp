import { Stack } from "expo-router";
import { colors } from "@/theme/colors";

export default function LeaveLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="history" />
      <Stack.Screen name="holidays" />
      <Stack.Screen name="team" />
    </Stack>
  );
}
