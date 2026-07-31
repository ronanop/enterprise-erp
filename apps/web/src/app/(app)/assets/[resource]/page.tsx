import { notFound } from "next/navigation";

import { AssetAssignmentWorkspacePage } from "@/components/assets/asset-assignment-workspace-page";
import { AssetCategoryWorkspace } from "@/components/assets/asset-category-workspace";
import { AssetListWorkspace } from "@/components/assets/asset-list-workspace";
import { AssetMaintenanceWorkspacePage } from "@/components/assets/asset-maintenance-workspace-page";
import { AssetOrgMasterWrapper } from "@/components/assets/asset-org-master-wrapper";
import { AssetQrWorkspacePage } from "@/components/assets/asset-qr-workspace-page";
import { AssetReportsWorkspace } from "@/components/assets/asset-reports-workspace";
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
    return <AssetListWorkspace />;
  }

  if (resourceKey === "asset-categories") {
    return <AssetCategoryWorkspace />;
  }

  if (resourceKey === "asset-assignments") {
    return <AssetAssignmentWorkspacePage />;
  }

  if (resourceKey === "asset-maintenances") {
    return <AssetMaintenanceWorkspacePage />;
  }

  if (resourceKey === "asset-types") {
    return <AssetTypesWorkspace />;
  }

  if (resourceKey === "locations") {
    return <AssetOrgMasterWrapper kind="locations" />;
  }

  if (resourceKey === "departments") {
    return <AssetOrgMasterWrapper kind="departments" />;
  }

  if (resourceKey === "qr-barcode") {
    return <AssetQrWorkspacePage />;
  }

  if (resourceKey === "reports") {
    return <AssetReportsWorkspace />;
  }

  if (resourceKey === "settings") {
    return <AssetSettingsWorkspace />;
  }

  if (resourceKey === "assets-new") {
    const { redirect } = await import("next/navigation");
    redirect("/assets/assets/new");
  }

  notFound();
}
