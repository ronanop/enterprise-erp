import { BgCheckCandidatePortal } from "@/components/hr/recruitment/bg-check-candidate-portal";

export default async function PublicBgCheckPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <BgCheckCandidatePortal token={token} />;
}
