import { redirect } from "next/navigation";

export default function NewPayrollRunPage() {
  redirect("/hr/payroll?section=run-payroll&generate=1");
}
