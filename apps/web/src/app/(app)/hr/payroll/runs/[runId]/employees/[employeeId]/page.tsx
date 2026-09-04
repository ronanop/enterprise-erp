import { PayrollRunEmployeePage } from "@/components/hr/payroll/payroll-run-employee-page";

export default async function PayrollRunEmployeeRoutePage({
  params,
}: {
  params: Promise<{ runId: string; employeeId: string }>;
}) {
  const { runId, employeeId } = await params;
  return <PayrollRunEmployeePage runId={runId} employeeId={employeeId} />;
}
