import { ArCustomerLedgerPage } from "@/components/finance/ar/ar-customer-ledger-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ArCustomerLedgerRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <ArCustomerLedgerPage customerId={row_id} />;
}
