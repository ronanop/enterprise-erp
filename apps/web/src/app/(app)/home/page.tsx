import { redirect } from "next/navigation";

/** Standalone HRMS: product home is the HR dashboard. */
export default function HomePage() {
  redirect("/hr");
}
