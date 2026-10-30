import { BgVendorDownloadPortal } from "@/components/hr/recruitment/bg-vendor-download-portal";

export default async function PublicBgVendorPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <BgVendorDownloadPortal token={token} />;
}
