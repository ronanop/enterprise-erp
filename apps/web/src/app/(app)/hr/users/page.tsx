import { redirect } from "next/navigation";

/** Module membership is managed from the Superadmin Panel in standalone HRMS. */
export default function HrUsersPage() {
  redirect("/hr/superadmin");
}
