export type CompanyShareAccess = "private" | "public";

export type CompanySharePermission = "full_access" | "read_write" | "read_only";

export type CompanyShareMember = {
  userId: string;
  displayName: string;
  permission: CompanySharePermission;
};

export type CompanyShareSettings = {
  accessType: CompanyShareAccess;
  members: CompanyShareMember[];
  withRelatedList: boolean;
};

const STORAGE_PREFIX = "crm-company-share:";

export function loadCompanyShareSettings(companyId: string): CompanyShareSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${companyId}`);
    if (!raw) return null;
    return JSON.parse(raw) as CompanyShareSettings;
  } catch {
    return null;
  }
}

export function saveCompanyShareSettings(companyId: string, settings: CompanyShareSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${STORAGE_PREFIX}${companyId}`, JSON.stringify(settings));
}

export const SHARE_PERMISSION_LABELS: Record<CompanySharePermission, string> = {
  full_access: "Full Access",
  read_write: "Read Write",
  read_only: "Read Only",
};
