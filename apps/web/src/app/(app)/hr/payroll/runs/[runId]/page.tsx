import { PayrollRunDetailPage } from "@/components/hr/payroll/payroll-run-detail-page";

export default async function PayrollRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return <PayrollRunDetailPage runId={runId} />;
}
