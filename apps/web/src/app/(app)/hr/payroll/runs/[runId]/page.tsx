import { redirect } from "next/navigation";

export default async function PayrollRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  redirect(`/hr/payroll?section=run-payroll&run=${encodeURIComponent(runId)}`);
}
