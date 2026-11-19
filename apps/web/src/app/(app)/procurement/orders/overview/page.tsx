import { redirect } from "next/navigation";

/** Legacy route — PO breakdown & export live on procurement overview. */
export default function ProcurementOrdersOverviewRoute() {
  redirect("/procurement");
}
