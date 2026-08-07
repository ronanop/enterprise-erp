import { apiClient } from "@/services/api-client";

export type HrEssInboxCategory =
  | "leave"
  | "compoff"
  | "attendance_correction"
  | "ot_allotment"
  | "on_duty";

export type HrEssInboxItem = {
  id: string;
  source_id: string;
  category: HrEssInboxCategory;
  status: string;
  title: string;
  employee_id: string;
  employee_name: string;
  document_number: string | null;
  occurred_at: string;
  detail: string;
  pending: boolean;
  available_actions: string[];
  api_path: string;
};

export const INBOX_CATEGORY_LABELS: Record<HrEssInboxCategory, string> = {
  leave: "Leave",
  compoff: "Comp Off (OT)",
  attendance_correction: "Attendance",
  ot_allotment: "OT / Overday",
  on_duty: "On duty",
};

export async function loadHrEssInbox(): Promise<HrEssInboxItem[]> {
  const res = await apiClient<HrEssInboxItem[]>("/hr/ess-inbox");
  return Array.isArray(res.data) ? res.data : [];
}

export async function runInboxAction(
  item: HrEssInboxItem,
  action: string,
): Promise<void> {
  const path = `${item.api_path}/${item.source_id}/${action}`;
  await apiClient(path, { method: "POST", body: {} });
}

export function inboxItemHref(item: HrEssInboxItem): string {
  switch (item.category) {
    case "leave":
    case "compoff":
      return "/hr/leave";
    case "attendance_correction":
    case "ot_allotment":
    case "on_duty":
      return "/hr/time";
    default:
      return `/hr/workforce/${item.employee_id}`;
  }
}
