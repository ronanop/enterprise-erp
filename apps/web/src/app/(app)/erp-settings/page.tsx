import { redirect } from "next/navigation";

/** ERP Settings hub removed — user management lives under Organization → Users. */
export default function ErpSettingsPage() {
  redirect("/organization/users");
}
