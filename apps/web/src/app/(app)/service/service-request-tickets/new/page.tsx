import { redirect } from "next/navigation";

/** Manual ticket create is disabled — tickets come from the support mailbox. */
export default function Page() {
  redirect("/service/service-request-tickets");
}
