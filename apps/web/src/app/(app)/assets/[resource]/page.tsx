import { Suspense } from "react";
import { notFound } from "next/navigation";

import { ResourceListView } from "@/components/module/resource-list-view";
import { AssetAuditWorkspace } from "@/components/assets/asset-audit-workspace";
import { AssetInventoryContainer } from "@/components/assets/asset-inventory-container";
import { AssetAssignmentWorkspace } from "@/components/assets/asset-assignment-workspace";
import { AssetDcChallanWorkspace } from "@/components/assets/asset-dc-challan-workspace";
import { AssetDepreciationWorkspace } from "@/components/assets/asset-depreciation-workspace";
import { AssetDisposalWorkspace } from "@/components/assets/asset-disposal-workspace";
import { AssetMaintenanceWorkspace } from "@/components/assets/asset-maintenance-workspace";
import { AssetRevaluationWorkspace } from "@/components/assets/asset-revaluation-workspace";
import { AssetTransferWorkspace } from "@/components/assets/asset-transfer-workspace";
import { AssetInsuranceWorkspace } from "@/components/assets/asset-insurance-workspace";
import { AssetChecklistWorkspace } from "@/components/assets/asset-checklist-workspace";
import { AssetMeterReadingWorkspace } from "@/components/assets/asset-meter-reading-workspace";
import { AssetDocumentWorkspace } from "@/components/assets/asset-document-workspace";
import { AssetComponentsWorkspace } from "@/components/assets/asset-components-workspace";
import { AssetNotificationWorkspace } from "@/components/assets/asset-notification-workspace";
import { AssetReportsWorkspace } from "@/components/assets/asset-reports-workspace";
import { AssetServiceHistoryWorkspace } from "@/components/assets/asset-service-history-workspace";
import { AssetLocationWorkspace } from "@/components/assets/asset-location-workspace";
import { AssetMaintenancePlanWorkspace } from "@/components/assets/asset-maintenance-plan-workspace";
import { AssetWarrantyWorkspace } from "@/components/assets/asset-warranty-workspace";
import { AssetCategoryWorkspace } from "@/components/assets/asset-category-workspace";
import { IncomingAssetsWorkspace } from "@/components/assets/incoming-assets-workspace";
import { IncomingAssetsQcWorkspace } from "@/components/assets/incoming-assets-qc-workspace";
import { AssetRegistrationQueueWorkspace } from "@/components/assets/asset-registration-queue-workspace";
import { AssetLocationsPlaceholderWorkspace } from "@/components/assets/asset-locations-placeholder-workspace";
import { AssetOrgMasterWrapper } from "@/components/assets/asset-org-master-wrapper";
import { AssetQrWorkspacePage } from "@/components/assets/asset-qr-workspace-page";
import { AssetSettingsWorkspace } from "@/components/assets/asset-settings-workspace";
import { AssetTypesWorkspace } from "@/components/assets/asset-types-workspace";
import { getModule, getResource } from "@/config/modules";

interface PageProps {
  params: Promise<{ resource: string }>;
}

export default async function AssetsResourcePage({ params }: PageProps) {
  const { resource: resourceKey } = await params;
  const mod = getModule("assets");
  const resource = getResource("assets", resourceKey);
  if (!mod || !resource) notFound();

  if (resourceKey === "assets") {
    return <AssetInventoryContainer />;
  }

  if (resourceKey === "incoming-assets") {
    return <IncomingAssetsWorkspace />;
  }

  if (resourceKey === "incoming-assets-qc") {
    return <IncomingAssetsQcWorkspace />;
  }

  if (resourceKey === "asset-registration") {
    return <AssetRegistrationQueueWorkspace />;
  }

  if (resourceKey === "asset-categories") {
    return <AssetCategoryWorkspace />;
  }

  if (resourceKey === "asset-assignments") {
    return <AssetAssignmentWorkspace />;
  }

  if (resourceKey === "asset-dc-challans") {
    return (
      <Suspense fallback={null}>
        <AssetDcChallanWorkspace />
      </Suspense>
    );
  }

  if (resourceKey === "asset-transfers") {
    return <AssetTransferWorkspace />;
  }

  if (resourceKey === "asset-maintenances") {
    return <AssetMaintenanceWorkspace />;
  }

  if (resourceKey === "asset-disposals") {
    return <AssetDisposalWorkspace />;
  }

  if (resourceKey === "asset-depreciations") {
    return <AssetDepreciationWorkspace />;
  }

  if (resourceKey === "asset-revaluations") {
    return <AssetRevaluationWorkspace />;
  }

  if (resourceKey === "asset-audits") {
    return <AssetAuditWorkspace />;
  }

  if (resourceKey === "asset-warranties") {
    return <AssetWarrantyWorkspace />;
  }

  if (resourceKey === "asset-insurances") {
    return <AssetInsuranceWorkspace />;
  }

  if (resourceKey === "maintenance-plans") {
    return <AssetMaintenancePlanWorkspace />;
  }

  if (resourceKey === "asset-locations") {
    return <AssetLocationWorkspace />;
  }

  if (resourceKey === "service-histories") {
    return <AssetServiceHistoryWorkspace />;
  }

  if (resourceKey === "asset-checklists") {
    return <AssetChecklistWorkspace />;
  }

  if (resourceKey === "meter-readings") {
    return <AssetMeterReadingWorkspace />;
  }

  if (resourceKey === "asset-documents") {
    return <AssetDocumentWorkspace />;
  }

  if (resourceKey === "asset-components") {
    return <AssetComponentsWorkspace />;
  }

  if (resourceKey === "asset-notifications") {
    return <AssetNotificationWorkspace />;
  }

  if (resourceKey === "reports") {
    return <AssetReportsWorkspace />;
  }

  if (resourceKey === "qr-barcode") {
    return <AssetQrWorkspacePage />;
  }

  if (resourceKey === "asset-types") {
    return <AssetTypesWorkspace />;
  }

  if (resourceKey === "settings") {
    return <AssetSettingsWorkspace />;
  }

  if (resourceKey === "locations") {
    return <AssetLocationsPlaceholderWorkspace />;
  }

  if (resourceKey === "departments") {
    return <AssetOrgMasterWrapper kind="departments" />;
  }

  return (
    <ResourceListView
      moduleKey={mod.key}
      moduleTitle={mod.title}
      title={resource.title}
      description={resource.description}
      apiPath={resource.apiPath}
    />
  );
}
