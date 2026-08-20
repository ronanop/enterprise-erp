import { redirect } from "next/navigation";

export default function ProcurementInventoryCreatePoRoute() {
  redirect("/procurement/orders/create?from=inventory");
}
