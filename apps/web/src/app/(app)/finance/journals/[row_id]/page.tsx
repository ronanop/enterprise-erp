import { JournalDetailPage } from "@/components/finance/journals/journal-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function FinanceJournalDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <JournalDetailPage journalId={row_id} />;
}
