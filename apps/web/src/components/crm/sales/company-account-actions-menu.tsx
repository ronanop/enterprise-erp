"use client";

import { useRouter } from "next/navigation";

import { CrmRecordActionsMenu } from "@/components/crm/sales/crm-record-actions-menu";
import {
  cloneCompanyRecord,
  printCompanyPreview,
} from "@/lib/crm/crm-record-actions";
import { deleteCompany, type Company } from "@/services/sales-crm-service";

export function CompanyAccountActionsMenu({ company }: { company: Company }) {
  const router = useRouter();

  return (
    <CrmRecordActionsMenu
      entityType="company"
      entityId={company.id}
      entityLabel="Company"
      entityName={company.customer_name}
      shareTitle={company.customer_name}
      onClone={() => cloneCompanyRecord(company, router)}
      onPrintPreview={() => printCompanyPreview(company)}
      onDelete={() => deleteCompany(company.id)}
      onDeleted={() => router.push("/crm/companies")}
    />
  );
}
