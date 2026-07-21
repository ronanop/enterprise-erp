import { notFound } from "next/navigation";

import { FinanceReports } from "@/components/finance/finance-reports";
import { CoaHubPage } from "@/components/finance/coa/coa-hub-page";
import { FiscalHubPage } from "@/components/finance/fiscal/fiscal-hub-page";
import { ApHubPage } from "@/components/finance/ap/ap-hub-page";
import { ArHubPage } from "@/components/finance/ar/ar-hub-page";
import { GlHubPage } from "@/components/finance/gl/gl-hub-page";
import { JournalListPage } from "@/components/finance/journals/journal-list-page";
import { ResourceListView } from "@/components/module/resource-list-view";
import { getModule, getResource } from "@/config/modules";

interface PageProps {
  params: Promise<{ resource: string }>;
}

export default async function FinanceResourcePage({ params }: PageProps) {
  const { resource: resourceKey } = await params;
  const mod = getModule("finance");
  const resource = getResource("finance", resourceKey);
  if (!mod || !resource) notFound();

  if (resourceKey === "journals") {
    return <JournalListPage />;
  }

  if (resourceKey === "chart-of-accounts") {
    return <CoaHubPage />;
  }

  if (resourceKey === "fiscal-years") {
    return <FiscalHubPage />;
  }

  if (resourceKey === "periods") {
    return <FiscalHubPage initialTab="periods" />;
  }

  if (resourceKey === "gl") {
    return <GlHubPage />;
  }

  if (resourceKey === "ar") {
    return <ArHubPage />;
  }

  if (resourceKey === "ap") {
    return <ApHubPage />;
  }

  if (resourceKey === "reports") {
    return <FinanceReports />;
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
