/**
 * Procurement Installation queue — delivered DCs marked requiresInstallation,
 * with manual site fields and share-to-project state (localStorage).
 */

export type InstallationManualFields = {
  projectName: string;
  circleName: string;
  site: string;
  contactPerson: string;
  contactNumber: string;
  rackQuantity: string;
  serverType: string;
};

export type InstallationRecord = InstallationManualFields & {
  challanId: string;
  sharedToProject: boolean;
  projectId: string | null;
  projectHref: string | null;
  sharedAt: string | null;
  updatedAt: string;
};

const STORAGE_KEY = "erp.procurement.installation";

function asText(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function normalize(raw: Partial<InstallationRecord> & { challanId: string }): InstallationRecord {
  return {
    challanId: raw.challanId,
    projectName: asText(raw.projectName).trim(),
    circleName: asText(raw.circleName).trim(),
    site: asText(raw.site).trim(),
    contactPerson: asText(raw.contactPerson).trim(),
    contactNumber: asText(raw.contactNumber).trim(),
    rackQuantity: asText(raw.rackQuantity).trim(),
    serverType: asText(raw.serverType).trim(),
    sharedToProject: Boolean(raw.sharedToProject),
    projectId: asText(raw.projectId).trim() || null,
    projectHref: asText(raw.projectHref).trim() || null,
    sharedAt: asText(raw.sharedAt).trim() || null,
    updatedAt: asText(raw.updatedAt).trim(),
  };
}

function readAll(): InstallationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InstallationRecord[];
    return Array.isArray(parsed)
      ? parsed.flatMap((row) => {
          try {
            if (!row?.challanId) return [];
            return [normalize(row)];
          } catch {
            return [];
          }
        })
      : [];
  } catch {
    return [];
  }
}

function writeAll(rows: InstallationRecord[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function emptyInstallationManual(): InstallationManualFields {
  return {
    projectName: "",
    circleName: "",
    site: "",
    contactPerson: "",
    contactNumber: "",
    rackQuantity: "",
    serverType: "",
  };
}

export function getInstallation(challanId: string): InstallationRecord | null {
  return readAll().find((row) => row.challanId === challanId) ?? null;
}

export function resolveInstallation(challanId: string): InstallationRecord {
  return (
    getInstallation(challanId) ?? {
      challanId,
      ...emptyInstallationManual(),
      sharedToProject: false,
      projectId: null,
      projectHref: null,
      sharedAt: null,
      updatedAt: "",
    }
  );
}

export function upsertInstallation(
  input: Omit<InstallationRecord, "updatedAt"> & { updatedAt?: string },
): InstallationRecord {
  const next = normalize({
    ...input,
    updatedAt: input.updatedAt || new Date().toISOString(),
  });
  const rows = readAll().filter((row) => row.challanId !== next.challanId);
  rows.unshift(next);
  writeAll(rows);
  return next;
}

export function markInstallationSharedToProject(
  challanId: string,
  projectId: string,
): InstallationRecord {
  const existing = resolveInstallation(challanId);
  return upsertInstallation({
    ...existing,
    sharedToProject: true,
    projectId,
    projectHref: `/projects/projects/${projectId}`,
    sharedAt: new Date().toISOString(),
  });
}

/** Shared to Projects PO Queue (project not created yet). */
export function markInstallationSharedToPoQueue(challanId: string): InstallationRecord {
  const existing = resolveInstallation(challanId);
  return upsertInstallation({
    ...existing,
    sharedToProject: true,
    projectId: null,
    projectHref: "/projects/po-queue",
    sharedAt: new Date().toISOString(),
  });
}

export function validateInstallationManual(
  fields: InstallationManualFields,
): Partial<Record<keyof InstallationManualFields, string>> {
  const errors: Partial<Record<keyof InstallationManualFields, string>> = {};
  if (!fields.projectName.trim()) errors.projectName = "Project name is required.";
  if (!fields.circleName.trim()) errors.circleName = "Circle name is required.";
  if (!fields.site.trim()) errors.site = "Site is required.";
  if (!fields.contactPerson.trim()) errors.contactPerson = "Contact person is required.";
  if (!fields.contactNumber.trim()) errors.contactNumber = "Contact number is required.";
  if (!fields.rackQuantity.trim()) errors.rackQuantity = "Rack quantity is required.";
  if (!fields.serverType.trim()) errors.serverType = "Server type is required.";
  return errors;
}

export function firstInstallationError(
  errors: Partial<Record<keyof InstallationManualFields, string>>,
): string | null {
  for (const message of Object.values(errors)) {
    if (message) return message;
  }
  return null;
}
