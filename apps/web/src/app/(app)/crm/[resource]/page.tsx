import { notFound } from "next/navigation";

import { CompanyListPage } from "@/components/crm/sales/company-list-page";
import { ContactsListPage } from "@/components/crm/sales/contacts-list-page";
import { DocumentRegistryListPage } from "@/components/crm/sales/document-registry-list-page";
import { FollowupsListPage } from "@/components/crm/sales/followups-list-page";
import { KycAccountMappingPage } from "@/components/crm/sales/kyc-account-mapping-page";
import { LeadDirectoryListPage } from "@/components/crm/sales/lead-directory-list-page";
import { LeadListPage } from "@/components/crm/sales/lead-list-page";
import { MeetingsListPage } from "@/components/crm/sales/meetings-list-page";
import { MyJobsPage } from "@/components/crm/sales/my-jobs-page";
import { OpportunityListPage } from "@/components/crm/sales/opportunity-list-page";
import { OvfListPage } from "@/components/crm/sales/ovf-list-page";
import { ProductsListPage } from "@/components/crm/sales/products-list-page";
import { QuoteListPage } from "@/components/crm/sales/quote-list-page";
import { ResourceListView } from "@/components/module/resource-list-view";
import { getModule, getResource } from "@/config/modules";

interface PageProps {
  params: Promise<{ resource: string }>;
}

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
    case "oem-quotes":
      return <DocumentRegistryListPage category="oem_quote" />;
    case "quotes":
      return <QuoteListPage />;
    case "purchase-orders":
      return <DocumentRegistryListPage category="customer_po" />;
    case "ovf":
      return <OvfListPage />;
    case "contacts":
      return <ContactsListPage />;
    case "products":
      return <ProductsListPage />;
    case "meetings":
      return <MeetingsListPage />;
    case "customer-followups":
    case "followups":
      return <FollowupsListPage />;
    case "kyc-account-mapping":
      return <KycAccountMappingPage />;
    case "oem":
      return <LeadDirectoryListPage kind="oem" />;
    case "distributors":
      return <LeadDirectoryListPage kind="distributor" />;
    case "boq":
      return <DocumentRegistryListPage category="boq" />;
    case "sow":
      return <DocumentRegistryListPage category="sow" />;
    case "entities":
      return <LeadDirectoryListPage kind="entity" />;
    case "end-customers":
      return <LeadDirectoryListPage kind="end_customer" />;
    default:
      break;
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
