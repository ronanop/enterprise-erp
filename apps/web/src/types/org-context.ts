export type OrgCompanyOption = {
  id: string;
  company_code: string;
  company_name: string;
  legal_name?: string;
  status?: string;
};

export type OrgBranchOption = {
  id: string;
  company_id: string;
  branch_code: string;
  branch_name: string;
  status?: string;
};

export type OrgLocationOption = {
  id: string;
  company_id: string;
  branch_id: string;
  location_code: string;
  location_name: string;
  branch_name?: string;
  status?: string;
};

export type OrgSessionContext = {
  tenant_id: string | null;
  user_id: string | null;
  company_id: string | null;
  branch_id: string | null;
  user_type?: string | null;
};

export type StoredOrgContext = {
  companyId: string;
  companyName: string;
  branchId?: string;
  branchName?: string;
};
