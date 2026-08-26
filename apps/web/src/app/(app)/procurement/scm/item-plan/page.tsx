"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { ScmOvfItemPlanPage } from "@/components/procurement/scm-ovf-item-plan-page";
import { resolveScmOvfIdFromUrl } from "@/utils/scm-ovf-route";

export default function ProcurementScmItemPlanQueryPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ovfId = resolveScmOvfIdFromUrl(pathname, searchParams);

  if (!ovfId) {
    return (
      <p className="text-sm text-muted-foreground">
        Missing OVF id. Open this page from the SCM queue Item plan column.
      </p>
    );
  }

  return <ScmOvfItemPlanPage ovfId={ovfId} />;
}
