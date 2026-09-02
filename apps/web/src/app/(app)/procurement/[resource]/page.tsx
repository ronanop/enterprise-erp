import { notFound } from "next/navigation";

import { ResourceListView } from "@/components/module/resource-list-view";
import { DeliveryChallanListPage } from "@/components/procurement/delivery-challan-list-page";
import { DeliveryStatusPage } from "@/components/procurement/delivery-status-page";
import { GrnsListPage } from "@/components/procurement/grns-list-page";
import { InstallationPage } from "@/components/procurement/installation-page";
import { OrdersListPage } from "@/components/procurement/orders-list-page";
import { ProcurementApprovalsPage } from "@/components/procurement/procurement-approvals-page";
import {
  ProcurementAnalyticsPage,
  ProcurementReportsPage,
} from "@/components/procurement/procurement-insight-pages";
import { ScmQueuePage } from "@/components/procurement/scm-queue-page";
import { ProcurementInventoryListPage } from "@/components/procurement/procurement-inventory-list-page";
import { VendorsListPage } from "@/components/procurement/vendors-list-page";
import { getModule, getResource } from "@/config/modules";

interface PageProps {
  params: Promise<{ resource: string }>;
}

export default async function ProcurementResourcePage({ params }: PageProps) {
  const { resource: resourceKey } = await params;
  if (resourceKey === "scm") return <ScmQueuePage />;
  // Legacy "Vendors & PO" route — same unified Purchase Orders list.
  if (resourceKey === "vendor-po" || resourceKey === "orders") return <OrdersListPage />;
  if (resourceKey === "grns") return <GrnsListPage />;
  if (resourceKey === "delivery-challan") return <DeliveryChallanListPage />;
  if (resourceKey === "delivery-status") return <DeliveryStatusPage />;
  if (resourceKey === "installation") return <InstallationPage />;
  if (resourceKey === "vendors") return <VendorsListPage />;
  if (resourceKey === "inventory") return <ProcurementInventoryListPage />;
  if (resourceKey === "approval" || resourceKey === "approvals") return <ProcurementApprovalsPage />;
  if (resourceKey === "reports") return <ProcurementReportsPage />;
  if (resourceKey === "analytics") return <ProcurementAnalyticsPage />;

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
