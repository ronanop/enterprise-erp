import { notFound } from "next/navigation";

import { CompanyWorkspaceShell } from "@/components/crm/company-workspace-shell";
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

interface PageProps {
  params: Promise<{ row_id: string; section: string }>;
}

export default async function CompanyWorkspaceSectionPage({ params }: PageProps) {
  const { row_id, section } = await params;

  let content: React.ReactNode = null;
  switch (section) {
    case "my-jobs":
      content = <MyJobsPage companyAccountId={row_id} embedded />;
      break;
    case "leads":
      content = <LeadListPage companyAccountId={row_id} embedded />;
      break;
    case "opportunities":
      content = <OpportunityListPage companyAccountId={row_id} embedded />;
      break;
    case "oem-quotes":
      content = <DocumentRegistryListPage category="oem_quote" companyAccountId={row_id} embedded />;
      break;
    case "quotes":
      content = <QuoteListPage companyAccountId={row_id} embedded />;
      break;
    case "purchase-orders":
      content = (
        <DocumentRegistryListPage category="customer_po" companyAccountId={row_id} embedded />
      );
      break;
    case "ovf":
      content = <OvfListPage companyAccountId={row_id} embedded />;
      break;
    case "contacts":
      content = <ContactsListPage companyAccountId={row_id} embedded />;
      break;
    case "products":
      content = <ProductsListPage companyAccountId={row_id} embedded />;
      break;
    case "meetings":
      content = <MeetingsListPage companyAccountId={row_id} embedded />;
      break;
    case "customer-followups":
    case "followups":
      content = <FollowupsListPage companyAccountId={row_id} embedded />;
      break;
    case "kyc-account-mapping":
      content = <KycAccountMappingPage companyAccountId={row_id} embedded />;
      break;
    case "oem":
      content = <LeadDirectoryListPage kind="oem" companyAccountId={row_id} embedded />;
      break;
    case "distributors":
      content = <LeadDirectoryListPage kind="distributor" companyAccountId={row_id} embedded />;
      break;
    case "boq":
      content = <DocumentRegistryListPage category="boq" companyAccountId={row_id} embedded />;
      break;
    case "sow":
      content = <DocumentRegistryListPage category="sow" companyAccountId={row_id} embedded />;
      break;
    case "entities":
      content = <LeadDirectoryListPage kind="entity" companyAccountId={row_id} embedded />;
      break;
    case "end-customers":
      content = <LeadDirectoryListPage kind="end_customer" companyAccountId={row_id} embedded />;
      break;
    default:
      notFound();
  }

  return <CompanyWorkspaceShell companyAccountId={row_id}>{content}</CompanyWorkspaceShell>;
}
