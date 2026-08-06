"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AssignmentWizardContainer } from "@/components/assets/assignment-wizard/assignment-wizard-container";
import { assignmentPropsFromSearchParams } from "@/components/assets/assignment-wizard/assignment-wizard-page-props";
import { markInventoryStale } from "@/components/assets/inventory/inventory-refresh";
import {
  assignmentNavigationPaths,
  createAssignmentNavigation,
} from "@/components/assets/navigation/assignment-navigation";

/**
 * Issue-asset page host.
 * Query → props mapping only; navigation via AssignmentNavigation SSOT.
 */
export default function IssueAssetWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapped = assignmentPropsFromSearchParams(searchParams);
  const assignmentNav = createAssignmentNavigation((href) => router.push(href));

  return (
    <div className="space-y-4">
      <AssignmentWizardContainer
        draftId={mapped.draftId}
        initialState={mapped.initialState}
        onCancel={() => assignmentNav.openInventory(mapped.query.assetId)}
        onSuccess={(assignmentId) => {
          markInventoryStale({
            reason: "issue",
            assetId: mapped.query.assetId,
          });
          void assignmentId;
          assignmentNav.openInventory(mapped.query.assetId);
        }}
      />
      <p className="text-center text-xs text-muted-foreground">
        <Link
          href={assignmentNavigationPaths.inventory}
          className="text-xs text-primary underline-offset-4 hover:underline"
        >
          Back to inventory
        </Link>
      </p>
    </div>
  );
}
