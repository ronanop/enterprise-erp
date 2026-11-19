"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { ScmOvfViewPage } from "@/components/procurement/scm-ovf-view-page";
import { resolveScmOvfIdFromUrl } from "@/utils/scm-ovf-route";

export default function ProcurementScmOvfDetailQueryPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ovfId = resolveScmOvfIdFromUrl(pathname, searchParams);

  if (!ovfId) {
    return (
      <p className="text-sm text-muted-foreground">
        Missing OVF id. Open this page from the SCM queue.
      </p>
    );
  }

  return <ScmOvfViewPage ovfId={ovfId} />;
}
