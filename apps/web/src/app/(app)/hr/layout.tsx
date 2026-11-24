import { redirect } from "next/navigation";

/**
 * HRMS UI was removed from this ERP — workforce lives in the separate HRMS app.
 * Employee data is imported via Organization → Users → API settings.
 */
export default function HrLayout() {
  redirect("/organization/users/hrms-api");
}
