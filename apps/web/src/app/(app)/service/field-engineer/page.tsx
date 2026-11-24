import { redirect } from "next/navigation";

/** Field Engineer portal removed — FE work is managed on the ticket. */
export default function Page() {
  redirect("/service/service-request-tickets");
}
