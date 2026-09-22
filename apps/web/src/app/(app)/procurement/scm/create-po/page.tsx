"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { ScmCreatePoPage } from "@/components/procurement/scm-create-po-page";
import { resolveScmOvfIdFromUrl } from "@/utils/scm-ovf-route";

export default function ProcurementScmCreatePoQueryPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ovfId = resolveScmOvfIdFromUrl(pathname, searchParams);

  if (!ovfId) {
    return (
      <p className="text-sm text-muted-foreground">
        Missing OVF id. Open this page from the SCM queue or OVF detail.
      </p>
    );
  }

  return <ScmCreatePoPage ovfId={ovfId} />;
}
