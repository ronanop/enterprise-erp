import { Stack } from "expo-router";
import { colors } from "@/theme/colors";

export default function AttendanceLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="history" />
      <Stack.Screen name="correction" />
      <Stack.Screen name="wfh" />
      <Stack.Screen name="on-duty" />
      <Stack.Screen name="compoff" />
    </Stack>
  );
}
