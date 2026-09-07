import { redirect } from "next/navigation";

export default async function PayrollRunEmployeeRoutePage({
  params,
}: {
  params: Promise<{ runId: string; employeeId: string }>;
}) {
  const { runId, employeeId } = await params;
  if (runId === "new") {
    redirect("/hr/payroll?section=run-payroll&generate=1");
  }
  redirect(
    `/hr/payroll?section=run-payroll&run=${encodeURIComponent(runId)}&employee=${encodeURIComponent(employeeId)}`,
  );
}
