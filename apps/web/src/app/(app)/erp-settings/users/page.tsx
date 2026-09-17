import { redirect } from "next/navigation";

/** Legacy ERP Settings users route — use Organization → Users. */
export default function ErpSettingsUsersPage() {
  redirect("/organization/users");
}
