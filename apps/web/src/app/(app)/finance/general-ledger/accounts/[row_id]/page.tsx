import { GlAccountLedgerPage } from "@/components/finance/gl/gl-account-ledger-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function GeneralLedgerAccountRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <GlAccountLedgerPage accountId={row_id} />;
}
