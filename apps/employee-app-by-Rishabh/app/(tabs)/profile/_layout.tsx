import { Stack } from "expo-router";
import { colors } from "@/theme/colors";

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="personal" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="bank" />
      <Stack.Screen name="emergency" />
      <Stack.Screen name="education" />
      <Stack.Screen name="security" />
    </Stack>
  );
}
