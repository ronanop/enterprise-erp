import { notFound } from "next/navigation";

import { ResourceListView } from "@/components/module/resource-list-view";
import { ScmQueuePage } from "@/components/procurement/scm-queue-page";
import { VendorPoListPage } from "@/components/procurement/vendor-po-list-page";
import { getModule, getResource } from "@/config/modules";

interface PageProps {
  params: Promise<{ resource: string }>;
}

export default async function ProcurementResourcePage({ params }: PageProps) {
  const { resource: resourceKey } = await params;
  if (resourceKey === "scm") return <ScmQueuePage />;
  if (resourceKey === "vendor-po") return <VendorPoListPage />;

  const mod = getModule("procurement");
  const resource = getResource("procurement", resourceKey);
  if (!mod || !resource) notFound();

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
