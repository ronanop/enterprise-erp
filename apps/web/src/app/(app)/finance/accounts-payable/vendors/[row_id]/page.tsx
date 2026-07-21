import { ApVendorLedgerPage } from "@/components/finance/ap/ap-vendor-ledger-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ApVendorLedgerRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <ApVendorLedgerPage vendorId={row_id} />;
}
