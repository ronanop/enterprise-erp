import { redirect } from "next/navigation";

/** Cold start → cinematic splash (pack 5), then onboarding (pack 4) or app. */
export default function RootPage() {
  redirect("/splash");
}
