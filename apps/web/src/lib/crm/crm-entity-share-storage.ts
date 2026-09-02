export type CrmShareAccess = "private" | "public";

export type CrmSharePermission = "full_access" | "read_write" | "read_only";

export type CrmShareMember = {
  userId: string;
  permission: CrmSharePermission;
};

export type CrmShareSettings = {
  accessType: CrmShareAccess;
  members: CrmShareMember[];
  withRelatedList: boolean;
};

const STORAGE_PREFIX = "crm-entity-share:";

function storageKey(entityType: string, entityId: string): string {
  return `${STORAGE_PREFIX}${entityType}:${entityId}`;
}

export function loadEntityShareSettings(
  entityType: string,
  entityId: string,
): CrmShareSettings | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(entityType, entityId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CrmShareSettings;
  } catch {
    return null;
  }
}

export function saveEntityShareSettings(
  entityType: string,
  entityId: string,
  settings: CrmShareSettings,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(entityType, entityId), JSON.stringify(settings));
}

export const SHARE_PERMISSION_LABELS: Record<CrmSharePermission, string> = {
  full_access: "Full access",
  read_write: "Read / Write",
  read_only: "Read only",
};
