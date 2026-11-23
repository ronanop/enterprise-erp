import { redirect } from "next/navigation";

/** Standalone HRMS: public root goes to the sign-in page. */
export default function RootPage() {
  redirect("/login");
}
