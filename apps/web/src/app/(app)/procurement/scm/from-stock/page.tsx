"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { ScmOvfFromStockPage } from "@/components/procurement/scm-ovf-from-stock-page";
import { resolveScmOvfIdFromUrl } from "@/utils/scm-ovf-route";

export default function ProcurementScmFromStockQueryPage() {
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

  return <ScmOvfFromStockPage ovfId={ovfId} />;
}
