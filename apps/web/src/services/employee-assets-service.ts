import { ApiClientError, resourceService } from "@/services/api-client";

export type EmployeeAssetRecord = {
  id: string;
  assignmentId: string | null;
  assetCode: string;
  assetName: string;
  assetType: string;
  serialNumber: string | null;
  assetStatus: string;
  assignmentStatus: string | null;
  documentNumber: string | null;
  allocatedAt: string | null;
  expectedReturnAt: string | null;
  returnedAt: string | null;
};

export type EmployeeAssetOption = {
  id: string;
  assetCode: string;
  assetName: string;
  assetType: string;
  serialNumber: string | null;
};

function mapAsset(row: Record<string, unknown>): EmployeeAssetRecord {
  return {
    id: String(row.id ?? ""),
    assignmentId: row.assignment_id != null ? String(row.assignment_id) : null,
    assetCode: String(row.asset_code ?? ""),
    assetName: String(row.asset_name ?? ""),
    assetType: String(row.asset_type ?? ""),
    serialNumber: row.serial_number != null ? String(row.serial_number) : null,
    assetStatus: String(row.asset_status ?? ""),
    assignmentStatus: row.assignment_status != null ? String(row.assignment_status) : null,
    documentNumber: row.document_number != null ? String(row.document_number) : null,
    allocatedAt: row.allocated_at != null ? String(row.allocated_at) : null,
    expectedReturnAt: row.expected_return_at != null ? String(row.expected_return_at) : null,
    returnedAt: row.returned_at != null ? String(row.returned_at) : null,
  };
}

function mapOption(row: Record<string, unknown>): EmployeeAssetOption {
  return {
    id: String(row.id ?? ""),
    assetCode: String(row.asset_code ?? ""),
    assetName: String(row.asset_name ?? ""),
    assetType: String(row.asset_type ?? ""),
    serialNumber: row.serial_number != null ? String(row.serial_number) : null,
  };
}

function asRows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return [];
  return data.filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
}

export async function loadEmployeeAssets(employeeId: string): Promise<EmployeeAssetRecord[]> {
  const res = await resourceService.list(`/hr/employee-assets/${employeeId}`);
  return asRows(res.data).map(mapAsset);
}

export async function loadAvailableEmployeeAssets(
  employeeId: string,
  branchId?: string,
): Promise<EmployeeAssetOption[]> {
  const res = await resourceService.list(`/hr/employee-assets/${employeeId}/available`, {
    branch_id: branchId || undefined,
  });
  return asRows(res.data).map(mapOption);
}

export async function assignEmployeeAsset(input: {
  employeeId: string;
  assetId: string;
  branchId: string;
  expectedReturnAt?: string;
}): Promise<EmployeeAssetRecord> {
  const res = await resourceService.create(`/hr/employee-assets/${input.employeeId}/assign`, {
    asset_id: input.assetId,
    branch_id: input.branchId,
    expected_return_at: input.expectedReturnAt || null,
  });
  const row = res.data;
  if (!row || typeof row !== "object") {
    throw new ApiClientError("Invalid assign response", 500);
  }
  return mapAsset(row as Record<string, unknown>);
}

export async function returnEmployeeAsset(assignmentId: string): Promise<EmployeeAssetRecord> {
  const res = await resourceService.create(
    `/hr/employee-assets/assignments/${assignmentId}/return`,
    {},
  );
  const row = res.data;
  if (!row || typeof row !== "object") {
    throw new ApiClientError("Invalid return response", 500);
  }
  return mapAsset(row as Record<string, unknown>);
}

export function formatAssetDate(value: string | null | undefined): string {
  if (!value) return "—";
  const datePart = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return value;
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isActiveAssignment(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "active" || s === "approved";
}
