"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { ReturnWizardContainer } from "@/components/assets/assignment-wizard/return-wizard-container";
import {
  hasReturnTarget,
  returnPropsFromSearchParams,
} from "@/components/assets/assignment-wizard/assignment-wizard-page-props";
import { WizardLoadErrorBanner } from "@/components/assets/assignment-wizard/wizard-load-error-banner";
import {
  buildReturnSuccessToast,
  stashInventoryArrival,
} from "@/components/assets/inventory/inventory-arrival";
import { markInventoryStale } from "@/components/assets/inventory/inventory-refresh";
import {
  assignmentNavigationPaths,
  createAssignmentNavigation,
} from "@/components/assets/navigation/assignment-navigation";

/**
 * Return-asset page host.
 * Query → props mapping only; navigation via AssignmentNavigation SSOT.
 */
export default function ReturnAssetWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapped = returnPropsFromSearchParams(searchParams);
  const assignmentNav = createAssignmentNavigation((href) => router.push(href));

  if (mapped.hasInvalidIntent) {
    return (
      <div className="space-y-4">
        <WizardLoadErrorBanner
          message={`Unsupported intent "${mapped.query.intent}". Use intent=return.`}
          onRetry={() => assignmentNav.openInventory(mapped.query.assetId)}
        />
      </div>
    );
  }

  if (!hasReturnTarget(mapped)) {
    return (
      <div className="space-y-4">
        <WizardLoadErrorBanner
          message="assignmentId or assetId is required to open the return wizard."
          onRetry={() => assignmentNav.openInventory()}
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

  return (
    <div className="space-y-4">
      <ReturnWizardContainer
        assetId={mapped.assetId}
        assignmentId={mapped.assignmentId}
        onCancel={() => assignmentNav.openInventory(mapped.query.assetId)}
        onSuccess={(result) => {
          const assetId =
            (result.assetId || mapped.query.assetId || "").trim() || undefined;
          if (assetId) {
            stashInventoryArrival({
              reason: "return",
              assetId,
              toastMessage: buildReturnSuccessToast(result.assetName || result.assetCode),
            });
            markInventoryStale({ reason: "return", assetId });
          } else {
            markInventoryStale({ reason: "return" });
          }
          assignmentNav.openInventory(assetId);
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
