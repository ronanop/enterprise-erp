import { AuditDetailPage } from "@/components/quality/quality-extra-detail-pages";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function QualityAuditDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <AuditDetailPage auditId={row_id} />;
}
