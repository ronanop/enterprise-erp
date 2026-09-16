import { redirect } from "next/navigation";

/** Legacy URL — marketing home now lives at `/`. */
export default function LandingRedirectPage() {
  redirect("/");
}
