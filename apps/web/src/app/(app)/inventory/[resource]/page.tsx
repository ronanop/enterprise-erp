import { notFound } from "next/navigation";

import { InventoryReports } from "@/components/inventory/inventory-reports";
import { ResourceListView } from "@/components/module/resource-list-view";
import { getModule, getResource } from "@/config/modules";

interface PageProps {
  params: Promise<{ resource: string }>;
}

export default async function InventoryResourcePage({ params }: PageProps) {
  const { resource: resourceKey } = await params;
  const mod = getModule("inventory");
  const resource = getResource("inventory", resourceKey);
  if (!mod || !resource) notFound();

  if (resourceKey === "reports") {
    return <InventoryReports />;
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
