import { notFound } from "next/navigation";

import { CompanyListPage } from "@/components/crm/sales/company-list-page";
import { ContactsListPage } from "@/components/crm/sales/contacts-list-page";
import { LeadListPage } from "@/components/crm/sales/lead-list-page";
import { MyJobsPage } from "@/components/crm/sales/my-jobs-page";
import { OpportunityListPage } from "@/components/crm/sales/opportunity-list-page";
import { OvfListPage } from "@/components/crm/sales/ovf-list-page";
import { ProductsListPage } from "@/components/crm/sales/products-list-page";
import { QuoteListPage } from "@/components/crm/sales/quote-list-page";
import { StubPage } from "@/components/crm/sales/stub-page";
import { ResourceListView } from "@/components/module/resource-list-view";
import { getModule, getResource } from "@/config/modules";

interface PageProps {
  params: Promise<{ resource: string }>;
}

const STUB_RESOURCES: Record<string, string> = {
  calls: "Call logging",
  kyc: "Customer KYC verification",
};

export default async function CrmResourcePage({ params }: PageProps) {
  const { resource: resourceKey } = await params;

  switch (resourceKey) {
    case "my-jobs":
      return <MyJobsPage />;
    case "companies":
      return <CompanyListPage />;
    case "leads":
      return <LeadListPage />;
    case "opportunities":
      return <OpportunityListPage />;
    case "quotes":
      return <QuoteListPage />;
    case "ovf":
      return <OvfListPage />;
    case "contacts":
      return <ContactsListPage />;
    case "products":
      return <ProductsListPage />;
    default:
      break;
  }

  if (resourceKey in STUB_RESOURCES) {
    const mod = getModule("crm");
    const resource = getResource("crm", resourceKey);
    return (
      <StubPage
        title={resource?.title ?? mod?.title ?? resourceKey}
        description={resource?.description ?? STUB_RESOURCES[resourceKey]}
      />
    );
  }

  const mod = getModule("crm");
  const resource = getResource("crm", resourceKey);
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
