import { ApiClientError, apiClient, apiGetBlob, apiUpload, resourceService } from "@/services/api-client";

export type AssetsRow = Record<string, unknown>;

export type ServiceHistoryRow = {
  id: string;
  branch_id?: string | null;
  asset_id: string;
  maintenance_id: string;
  service_summary: string;
  parts_replaced_json?: Record<string, unknown> | unknown[] | null;
  cost_amount?: number | null;
  serviced_at?: string | null;
  status: string;
  company_id: string;
  version: number;
};

export type ServiceHistoryListResult = {
  items: ServiceHistoryRow[];
  total: number;
  page: number;
  page_size: number;
};

const SERVICE_HISTORIES_PATH = "/assets/service-histories";

function parseServiceHistoryList(data: unknown): ServiceHistoryListResult {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as ServiceHistoryListResult;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      page_size: payload.page_size ?? 25,
    };
  }
  return { items: [], total: 0, page: 1, page_size: 25 };
}

export const serviceHistoryService = {
  async search(params: {
    page?: number;
    page_size?: number;
    asset_id?: string;
    maintenance_id?: string;
    branch_id?: string;
    serviced_from?: string;
    serviced_to?: string;
    q?: string;
  }): Promise<ServiceHistoryListResult> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.page_size) query.set("page_size", String(params.page_size));
    if (params.asset_id) query.set("asset_id", params.asset_id);
    if (params.maintenance_id) query.set("maintenance_id", params.maintenance_id);
    if (params.branch_id) query.set("branch_id", params.branch_id);
    if (params.serviced_from) query.set("serviced_from", params.serviced_from);
    if (params.serviced_to) query.set("serviced_to", params.serviced_to);
    if (params.q) query.set("q", params.q);
    const res = await resourceService.list<ServiceHistoryListResult>(
      `${SERVICE_HISTORIES_PATH}?${query.toString()}`,
    );
    return parseServiceHistoryList(res.data);
  },

  async get(id: string): Promise<ServiceHistoryRow> {
    const res = await resourceService.get<ServiceHistoryRow>(SERVICE_HISTORIES_PATH, id);
    return res.data as ServiceHistoryRow;
  },

  async create(body: {
    asset_id: string;
    maintenance_id: string;
    service_summary: string;
    branch_id?: string;
    parts_replaced_json?: Record<string, unknown> | unknown[];
    cost_amount?: number;
    serviced_at?: string;
  }): Promise<ServiceHistoryRow> {
    const res = await resourceService.create<ServiceHistoryRow>(SERVICE_HISTORIES_PATH, body);
    return res.data as ServiceHistoryRow;
  },
};

export type AssetChecklistRow = {
  id: string;
  branch_id?: string | null;
  asset_id?: string | null;
  maintenance_id?: string | null;
  audit_id?: string | null;
  checklist_code: string;
  checklist_name: string;
  items_json?: { items: ChecklistItem[] } | null;
  completed_at?: string | null;
  status: string;
  company_id: string;
  version: number;
};

export type ChecklistItem = {
  code?: string;
  label: string;
  required?: boolean;
  result?: "pass" | "fail" | "na" | null;
  notes?: string;
};

export type AssetChecklistListResult = {
  items: AssetChecklistRow[];
  total: number;
  page: number;
  page_size: number;
};

const ASSET_CHECKLISTS_PATH = "/assets/asset-checklists";

function parseAssetChecklistList(data: unknown): AssetChecklistListResult {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as AssetChecklistListResult;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      page_size: payload.page_size ?? 25,
    };
  }
  return { items: [], total: 0, page: 1, page_size: 25 };
}

export const checklistService = {
  async search(params: {
    page?: number;
    page_size?: number;
    asset_id?: string;
    maintenance_id?: string;
    audit_id?: string;
    branch_id?: string;
    status?: string;
    q?: string;
  }): Promise<AssetChecklistListResult> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.page_size) query.set("page_size", String(params.page_size));
    if (params.asset_id) query.set("asset_id", params.asset_id);
    if (params.maintenance_id) query.set("maintenance_id", params.maintenance_id);
    if (params.audit_id) query.set("audit_id", params.audit_id);
    if (params.branch_id) query.set("branch_id", params.branch_id);
    if (params.status) query.set("status", params.status);
    if (params.q) query.set("q", params.q);
    const res = await resourceService.list<AssetChecklistListResult>(
      `${ASSET_CHECKLISTS_PATH}?${query.toString()}`,
    );
    return parseAssetChecklistList(res.data);
  },

  async get(id: string): Promise<AssetChecklistRow> {
    const res = await resourceService.get<AssetChecklistRow>(ASSET_CHECKLISTS_PATH, id);
    return res.data as AssetChecklistRow;
  },

  async create(body: {
    checklist_code: string;
    checklist_name: string;
    asset_id?: string;
    maintenance_id?: string;
    audit_id?: string;
    branch_id?: string;
    items_json?: { items: ChecklistItem[] };
  }): Promise<AssetChecklistRow> {
    const res = await resourceService.create<AssetChecklistRow>(ASSET_CHECKLISTS_PATH, body);
    return res.data as AssetChecklistRow;
  },

  async update(
    id: string,
    body: {
      checklist_name?: string;
      items_json?: { items: ChecklistItem[] };
      branch_id?: string | null;
      version: number;
    },
  ): Promise<AssetChecklistRow> {
    const res = await resourceService.update<AssetChecklistRow>(ASSET_CHECKLISTS_PATH, id, body);
    return res.data as AssetChecklistRow;
  },

  async complete(id: string): Promise<AssetChecklistRow> {
    const res = await resourceService.action<AssetChecklistRow>(
      ASSET_CHECKLISTS_PATH,
      id,
      "complete",
    );
    return res.data as AssetChecklistRow;
  },

  async cancel(id: string): Promise<AssetChecklistRow> {
    const res = await resourceService.action<AssetChecklistRow>(
      ASSET_CHECKLISTS_PATH,
      id,
      "cancel",
    );
    return res.data as AssetChecklistRow;
  },
};

export type MeterReadingRow = {
  id: string;
  branch_id?: string | null;
  asset_id: string;
  meter_type: string;
  reading_value: number | string;
  reading_at: string;
  recorded_by_employee_id?: string | null;
  status: string;
  company_id: string;
  version: number;
};

export type MeterReadingListResult = {
  items: MeterReadingRow[];
  total: number;
  page: number;
  page_size: number;
};

const METER_READINGS_PATH = "/assets/meter-readings";

function parseMeterReadingList(data: unknown): MeterReadingListResult {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as MeterReadingListResult;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      page_size: payload.page_size ?? 25,
    };
  }
  return { items: [], total: 0, page: 1, page_size: 25 };
}

export const meterReadingService = {
  async search(params: {
    page?: number;
    page_size?: number;
    asset_id?: string;
    meter_type?: string;
    branch_id?: string;
    status?: string;
    reading_from?: string;
    reading_to?: string;
    q?: string;
  }): Promise<MeterReadingListResult> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.page_size) query.set("page_size", String(params.page_size));
    if (params.asset_id) query.set("asset_id", params.asset_id);
    if (params.meter_type) query.set("meter_type", params.meter_type);
    if (params.branch_id) query.set("branch_id", params.branch_id);
    if (params.status) query.set("status", params.status);
    if (params.reading_from) query.set("reading_from", params.reading_from);
    if (params.reading_to) query.set("reading_to", params.reading_to);
    if (params.q) query.set("q", params.q);
    const res = await resourceService.list<MeterReadingListResult>(
      `${METER_READINGS_PATH}?${query.toString()}`,
    );
    return parseMeterReadingList(res.data);
  },

  async get(id: string): Promise<MeterReadingRow> {
    const res = await resourceService.get<MeterReadingRow>(METER_READINGS_PATH, id);
    return res.data as MeterReadingRow;
  },

  async create(body: {
    asset_id: string;
    meter_type: string;
    reading_value: number | string;
    reading_at: string;
    branch_id?: string;
    recorded_by_employee_id?: string;
  }): Promise<MeterReadingRow> {
    const res = await resourceService.create<MeterReadingRow>(METER_READINGS_PATH, body);
    return res.data as MeterReadingRow;
  },

  async void(id: string): Promise<MeterReadingRow> {
    const res = await resourceService.action<MeterReadingRow>(METER_READINGS_PATH, id, "void");
    return res.data as MeterReadingRow;
  },
};

export type DocumentRow = {
  id: string;
  branch_id?: string | null;
  asset_id: string;
  document_type: string;
  document_name: string;
  storage_uri?: string | null;
  content_hash?: string | null;
  status: string;
  company_id: string;
  version: number;
};

export type DocumentListResult = {
  items: DocumentRow[];
  total: number;
  page: number;
  page_size: number;
};

const ASSET_DOCUMENTS_PATH = "/assets/asset-documents";

function parseDocumentList(data: unknown): DocumentListResult {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as DocumentListResult;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      page_size: payload.page_size ?? 25,
    };
  }
  return { items: [], total: 0, page: 1, page_size: 25 };
}

export const documentService = {
  async search(params: {
    page?: number;
    page_size?: number;
    asset_id?: string;
    document_type?: string;
    branch_id?: string;
    status?: string;
    q?: string;
  }): Promise<DocumentListResult> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.page_size) query.set("page_size", String(params.page_size));
    if (params.asset_id) query.set("asset_id", params.asset_id);
    if (params.document_type) query.set("document_type", params.document_type);
    if (params.branch_id) query.set("branch_id", params.branch_id);
    if (params.status) query.set("status", params.status);
    if (params.q) query.set("q", params.q);
    const res = await resourceService.list<DocumentListResult>(
      `${ASSET_DOCUMENTS_PATH}?${query.toString()}`,
    );
    return parseDocumentList(res.data);
  },

  async get(id: string): Promise<DocumentRow> {
    const res = await resourceService.get<DocumentRow>(ASSET_DOCUMENTS_PATH, id);
    return res.data as DocumentRow;
  },

  async create(body: {
    asset_id: string;
    document_type: string;
    document_name: string;
    storage_uri?: string;
    content_hash?: string;
    branch_id?: string;
  }): Promise<DocumentRow> {
    const res = await resourceService.create<DocumentRow>(ASSET_DOCUMENTS_PATH, body);
    return res.data as DocumentRow;
  },

  async update(
    id: string,
    body: {
      document_name?: string;
      storage_uri?: string | null;
      content_hash?: string | null;
      branch_id?: string | null;
      version: number;
    },
  ): Promise<DocumentRow> {
    const res = await resourceService.update<DocumentRow>(ASSET_DOCUMENTS_PATH, id, body);
    return res.data as DocumentRow;
  },

  async supersede(id: string): Promise<DocumentRow> {
    const res = await resourceService.action<DocumentRow>(ASSET_DOCUMENTS_PATH, id, "supersede");
    return res.data as DocumentRow;
  },

  async archive(id: string): Promise<DocumentRow> {
    const res = await resourceService.action<DocumentRow>(ASSET_DOCUMENTS_PATH, id, "archive");
    return res.data as DocumentRow;
  },
};

export type ComponentType =
  | "CHARGER"
  | "MOUSE"
  | "KEYBOARD"
  | "CABLE"
  | "PENDRIVE"
  | "LAPTOP_BAG"
  | "OTHER";

export const COMPONENT_TYPE_OPTIONS: { value: ComponentType; label: string }[] = [
  { value: "CHARGER", label: "Charger" },
  { value: "MOUSE", label: "Mouse" },
  { value: "KEYBOARD", label: "Keyboard" },
  { value: "CABLE", label: "Cable" },
  { value: "PENDRIVE", label: "Pendrive" },
  { value: "LAPTOP_BAG", label: "Laptop Bag" },
  { value: "OTHER", label: "Other" },
];

export function componentTypeLabel(type: string | null | undefined): string {
  const found = COMPONENT_TYPE_OPTIONS.find((o) => o.value === type);
  return found?.label ?? (type?.trim() || "Other");
}

export type ComponentRow = {
  id: string;
  branch_id?: string | null;
  asset_id: string;
  component_code: string;
  component_name: string;
  component_type?: ComponentType | string;
  product_id?: string | null;
  serial_number?: string | null;
  quantity?: string | number | null;
  status: string;
  company_id: string;
  version: number;
  availability?: "available" | "unavailable" | string | null;
};

export type ComponentListResult = {
  items: ComponentRow[];
  total: number;
  page: number;
  page_size: number;
};

export type ComponentTreeResult = {
  asset: {
    id: string;
    asset_code: string;
    asset_name: string;
    status: string;
    company_id: string;
  };
  components: Array<{
    id: string;
    component_code: string;
    component_name: string;
    component_type?: string;
    serial_number?: string | null;
    quantity?: string | null;
    status: string;
    product_id?: string | null;
    version: number;
  }>;
  depth: number;
};

export type ComponentHistoryResult = {
  component_id: string;
  asset_id: string;
  component_code: string;
  current_status: string;
  lineage: Array<{
    id: string;
    status: string;
    component_name: string;
    serial_number?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    version: number;
  }>;
};

export type ComponentReplaceResult = {
  replaced: ComponentRow;
  successor: ComponentRow;
};

export type AssignmentComponentRow = {
  id: string;
  assignment_id: string;
  component_id: string;
  issue_status: string;
  issued_at?: string | null;
  returned_at?: string | null;
  return_condition?: string | null;
  return_remarks?: string | null;
  company_id: string;
  version: number;
  component_code?: string | null;
  component_name?: string | null;
  component_type?: string | null;
  serial_number?: string | null;
  component_status?: string | null;
};

const ASSET_COMPONENTS_PATH = "/assets/asset-components";
const ASSET_ASSIGNMENTS_PATH = "/assets/asset-assignments";

function parseComponentList(data: unknown): ComponentListResult {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as ComponentListResult;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      page_size: payload.page_size ?? 25,
    };
  }
  return { items: [], total: 0, page: 1, page_size: 25 };
}

export const componentService = {
  async search(params: {
    page?: number;
    page_size?: number;
    asset_id?: string;
    asset_ids?: string[];
    status?: string;
    product_id?: string;
    branch_id?: string;
    component_type?: string;
    q?: string;
    sort?: string;
    include_availability?: boolean;
  }): Promise<ComponentListResult> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.page_size) query.set("page_size", String(params.page_size));
    if (params.asset_id) query.set("asset_id", params.asset_id);
    if (params.asset_ids?.length) query.set("asset_ids", params.asset_ids.join(","));
    if (params.status) query.set("status", params.status);
    if (params.product_id) query.set("product_id", params.product_id);
    if (params.branch_id) query.set("branch_id", params.branch_id);
    if (params.component_type) query.set("component_type", params.component_type);
    if (params.q) query.set("q", params.q);
    if (params.sort) query.set("sort", params.sort);
    if (params.include_availability) query.set("include_availability", "true");
    const res = await resourceService.list<ComponentListResult>(
      `${ASSET_COMPONENTS_PATH}?${query.toString()}`,
    );
    return parseComponentList(res.data);
  },

  async get(id: string): Promise<ComponentRow> {
    const res = await resourceService.get<ComponentRow>(ASSET_COMPONENTS_PATH, id);
    return res.data as ComponentRow;
  },

  async tree(assetId: string): Promise<ComponentTreeResult> {
    const res = await resourceService.list<ComponentTreeResult>(
      `${ASSET_COMPONENTS_PATH}/tree?asset_id=${encodeURIComponent(assetId)}`,
    );
    return res.data as ComponentTreeResult;
  },

  async history(id: string): Promise<ComponentHistoryResult> {
    const res = await resourceService.list<ComponentHistoryResult>(
      `${ASSET_COMPONENTS_PATH}/${id}/history`,
    );
    return res.data as ComponentHistoryResult;
  },

  async install(body: {
    asset_id: string;
    component_code: string;
    component_name: string;
    component_type?: string;
    product_id?: string;
    serial_number?: string;
    quantity?: number | string;
    branch_id?: string;
  }): Promise<ComponentRow> {
    const res = await resourceService.create<ComponentRow>(ASSET_COMPONENTS_PATH, body);
    return res.data as ComponentRow;
  },

  async update(
    id: string,
    body: {
      component_name?: string;
      component_type?: string;
      product_id?: string | null;
      serial_number?: string | null;
      quantity?: number | string | null;
      branch_id?: string | null;
      version: number;
    },
  ): Promise<ComponentRow> {
    const res = await resourceService.update<ComponentRow>(ASSET_COMPONENTS_PATH, id, body);
    return res.data as ComponentRow;
  },

  async replace(
    id: string,
    body: {
      component_code?: string;
      component_name?: string;
      component_type?: string;
      product_id?: string;
      serial_number?: string;
      quantity?: number | string;
      branch_id?: string;
    } = {},
  ): Promise<ComponentReplaceResult> {
    const res = await resourceService.action<ComponentReplaceResult>(
      ASSET_COMPONENTS_PATH,
      id,
      "replace",
      body,
    );
    return res.data as ComponentReplaceResult;
  },

  async dispose(id: string): Promise<ComponentRow> {
    const res = await resourceService.action<ComponentRow>(
      ASSET_COMPONENTS_PATH,
      id,
      "dispose",
    );
    return res.data as ComponentRow;
  },

  async listForAssignment(assignmentId: string): Promise<AssignmentComponentRow[]> {
    const res = await resourceService.list<{ items: AssignmentComponentRow[] }>(
      `${ASSET_ASSIGNMENTS_PATH}/${assignmentId}/components`,
    );
    const data = res.data as { items?: AssignmentComponentRow[] };
    return Array.isArray(data?.items) ? data.items : [];
  },
};

export type NotificationRow = {
  id: string;
  branch_id?: string | null;
  asset_id: string;
  notification_type: string;
  recipient_user_id?: string | null;
  recipient_employee_id?: string | null;
  payload_json?: Record<string, unknown> | null;
  sent_at?: string | null;
  delivery_status: string;
  status: string;
  company_id: string;
  version: number;
};

export type NotificationListResult = {
  items: NotificationRow[];
  total: number;
  page: number;
  page_size: number;
};

const ASSET_NOTIFICATIONS_PATH = "/assets/asset-notifications";

function parseNotificationList(data: unknown): NotificationListResult {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as NotificationListResult;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      page_size: payload.page_size ?? 25,
    };
  }
  return { items: [], total: 0, page: 1, page_size: 25 };
}

export const notificationService = {
  async search(params: {
    page?: number;
    page_size?: number;
    asset_id?: string;
    notification_type?: string;
    delivery_status?: string;
    status?: string;
    recipient_user_id?: string;
    branch_id?: string;
    sort?: string;
    q?: string;
  }): Promise<NotificationListResult> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.page_size) query.set("page_size", String(params.page_size));
    if (params.asset_id) query.set("asset_id", params.asset_id);
    if (params.notification_type) query.set("notification_type", params.notification_type);
    if (params.delivery_status) query.set("delivery_status", params.delivery_status);
    if (params.status) query.set("status", params.status);
    if (params.recipient_user_id) query.set("recipient_user_id", params.recipient_user_id);
    if (params.branch_id) query.set("branch_id", params.branch_id);
    if (params.sort) query.set("sort", params.sort);
    if (params.q) query.set("q", params.q);
    const res = await resourceService.list<NotificationListResult>(
      `${ASSET_NOTIFICATIONS_PATH}?${query.toString()}`,
    );
    return parseNotificationList(res.data);
  },

  async get(id: string): Promise<NotificationRow> {
    const res = await resourceService.get<NotificationRow>(ASSET_NOTIFICATIONS_PATH, id);
    return res.data as NotificationRow;
  },

  async create(body: {
    asset_id: string;
    notification_type: string;
    recipient_user_id?: string;
    recipient_employee_id?: string;
    payload_json?: Record<string, unknown>;
    branch_id?: string;
  }): Promise<NotificationRow> {
    const res = await resourceService.create<NotificationRow>(ASSET_NOTIFICATIONS_PATH, body);
    return res.data as NotificationRow;
  },

  async update(
    id: string,
    body: {
      branch_id?: string | null;
      recipient_user_id?: string | null;
      recipient_employee_id?: string | null;
      payload_json?: Record<string, unknown> | null;
      version: number;
    },
  ): Promise<NotificationRow> {
    const res = await resourceService.update<NotificationRow>(ASSET_NOTIFICATIONS_PATH, id, body);
    return res.data as NotificationRow;
  },

  async archive(id: string): Promise<NotificationRow> {
    const res = await resourceService.action<NotificationRow>(
      ASSET_NOTIFICATIONS_PATH,
      id,
      "archive",
    );
    return res.data as NotificationRow;
  },

  async markRead(id: string): Promise<NotificationRow> {
    const res = await resourceService.action<NotificationRow>(
      ASSET_NOTIFICATIONS_PATH,
      id,
      "mark-read",
    );
    return res.data as NotificationRow;
  },

  async markSent(id: string): Promise<NotificationRow> {
    const res = await resourceService.action<NotificationRow>(
      ASSET_NOTIFICATIONS_PATH,
      id,
      "mark-sent",
    );
    return res.data as NotificationRow;
  },

  async markFailed(id: string): Promise<NotificationRow> {
    const res = await resourceService.action<NotificationRow>(
      ASSET_NOTIFICATIONS_PATH,
      id,
      "mark-failed",
    );
    return res.data as NotificationRow;
  },
};

export type ReportCatalogItem = {
  key: string;
  title: string;
  category: string;
};

export type ReportDashboard = {
  generated_at: string;
  horizon_days: number;
  kpis: Record<string, number>;
  by_category: Array<Record<string, unknown>>;
  by_department: Array<Record<string, unknown>>;
  recent_transfers: Array<Record<string, unknown>>;
  recent_notifications: Array<Record<string, unknown>>;
  health: Record<string, unknown>;
};

export type ReportRunResult = {
  report_key: string;
  generated_at: string;
  filters: Record<string, unknown>;
  totals: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  total: number;
  page: number;
  page_size: number;
};

export type ReportExportResult = {
  report_key: string;
  generated_at: string;
  format_hints: string[];
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
  row_count: number;
  filters: Record<string, unknown>;
};

export type ReportSnapshotRow = {
  id: string;
  branch_id?: string | null;
  report_code: string;
  report_type: string;
  period_start?: string | null;
  period_end?: string | null;
  department_id?: string | null;
  category_id?: string | null;
  metrics_json?: Record<string, unknown> | null;
  generated_at?: string | null;
  status: string;
  company_id: string;
  version: number;
};

export type ReportSnapshotListResult = {
  items: ReportSnapshotRow[];
  total: number;
  page: number;
  page_size: number;
};

const ASSET_REPORTS_PATH = "/assets/reports";

function parseSnapshotList(data: unknown): ReportSnapshotListResult {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as ReportSnapshotListResult;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      page_size: payload.page_size ?? 25,
    };
  }
  return { items: [], total: 0, page: 1, page_size: 25 };
}

export const reportService = {
  async catalog(): Promise<ReportCatalogItem[]> {
    const res = await resourceService.list<ReportCatalogItem[]>(
      `${ASSET_REPORTS_PATH}/catalog`,
    );
    return Array.isArray(res.data) ? res.data : [];
  },

  async dashboard(params?: {
    branch_id?: string;
    category_id?: string;
    department_id?: string;
    horizon_days?: number;
  }): Promise<ReportDashboard> {
    const query = new URLSearchParams();
    if (params?.branch_id) query.set("branch_id", params.branch_id);
    if (params?.category_id) query.set("category_id", params.category_id);
    if (params?.department_id) query.set("department_id", params.department_id);
    if (params?.horizon_days) query.set("horizon_days", String(params.horizon_days));
    const qs = query.toString();
    const res = await resourceService.list<ReportDashboard>(
      `${ASSET_REPORTS_PATH}/dashboard${qs ? `?${qs}` : ""}`,
    );
    return res.data as ReportDashboard;
  },

  async run(
    reportKey: string,
    params?: {
      page?: number;
      page_size?: number;
      status?: string;
      period_start?: string;
      period_end?: string;
      category_id?: string;
      department_id?: string;
      branch_id?: string;
    },
  ): Promise<ReportRunResult> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.page_size) query.set("page_size", String(params.page_size));
    if (params?.status) query.set("status", params.status);
    if (params?.period_start) query.set("period_start", params.period_start);
    if (params?.period_end) query.set("period_end", params.period_end);
    if (params?.category_id) query.set("category_id", params.category_id);
    if (params?.department_id) query.set("department_id", params.department_id);
    if (params?.branch_id) query.set("branch_id", params.branch_id);
    const res = await resourceService.list<ReportRunResult>(
      `${ASSET_REPORTS_PATH}/run/${reportKey}?${query.toString()}`,
    );
    return res.data as ReportRunResult;
  },

  async export(
    reportKey: string,
    params?: {
      status?: string;
      period_start?: string;
      period_end?: string;
      category_id?: string;
      department_id?: string;
      branch_id?: string;
    },
  ): Promise<ReportExportResult> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.period_start) query.set("period_start", params.period_start);
    if (params?.period_end) query.set("period_end", params.period_end);
    if (params?.category_id) query.set("category_id", params.category_id);
    if (params?.department_id) query.set("department_id", params.department_id);
    if (params?.branch_id) query.set("branch_id", params.branch_id);
    const res = await resourceService.list<ReportExportResult>(
      `${ASSET_REPORTS_PATH}/export/${reportKey}?${query.toString()}`,
    );
    return res.data as ReportExportResult;
  },

  async searchSnapshots(params?: {
    page?: number;
    page_size?: number;
    report_type?: string;
    status?: string;
    q?: string;
  }): Promise<ReportSnapshotListResult> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.page_size) query.set("page_size", String(params.page_size));
    if (params?.report_type) query.set("report_type", params.report_type);
    if (params?.status) query.set("status", params.status);
    if (params?.q) query.set("q", params.q);
    const res = await resourceService.list<ReportSnapshotListResult>(
      `${ASSET_REPORTS_PATH}?${query.toString()}`,
    );
    return parseSnapshotList(res.data);
  },

  async getSnapshot(id: string): Promise<ReportSnapshotRow> {
    const res = await resourceService.get<ReportSnapshotRow>(ASSET_REPORTS_PATH, id);
    return res.data as ReportSnapshotRow;
  },

  async generate(body: {
    report_key: string;
    period_start?: string;
    period_end?: string;
    category_id?: string;
    department_id?: string;
    branch_id?: string;
  }): Promise<ReportSnapshotRow> {
    const res = await resourceService.create<ReportSnapshotRow>(
      `${ASSET_REPORTS_PATH}/generate`,
      body,
    );
    return res.data as ReportSnapshotRow;
  },

  async finalize(id: string): Promise<ReportSnapshotRow> {
    const res = await resourceService.action<ReportSnapshotRow>(
      ASSET_REPORTS_PATH,
      id,
      "finalize",
    );
    return res.data as ReportSnapshotRow;
  },
};

export type AssetLocationRow = {
  id: string;
  branch_id?: string | null;
  asset_id: string;
  location_label: string;
  org_location_id?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  is_current: boolean;
  status: string;
  company_id: string;
  version: number;
};

export type AssetLocationListResult = {
  items: AssetLocationRow[];
  total: number;
  page: number;
  page_size: number;
};

const ASSET_LOCATIONS_PATH = "/assets/asset-locations";

function parseAssetLocationList(data: unknown): AssetLocationListResult {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as AssetLocationListResult;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      page_size: payload.page_size ?? 25,
    };
  }
  return { items: [], total: 0, page: 1, page_size: 25 };
}

export const assetLocationService = {
  async search(params: {
    page?: number;
    page_size?: number;
    status?: string;
    is_current?: boolean;
    asset_id?: string;
    branch_id?: string;
    q?: string;
  }): Promise<AssetLocationListResult> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.page_size) query.set("page_size", String(params.page_size));
    if (params.status) query.set("status", params.status);
    if (params.is_current !== undefined) query.set("is_current", String(params.is_current));
    if (params.asset_id) query.set("asset_id", params.asset_id);
    if (params.branch_id) query.set("branch_id", params.branch_id);
    if (params.q) query.set("q", params.q);
    const res = await resourceService.list<AssetLocationListResult>(
      `${ASSET_LOCATIONS_PATH}?${query.toString()}`,
    );
    return parseAssetLocationList(res.data);
  },

  async get(id: string): Promise<AssetLocationRow> {
    const res = await resourceService.get<AssetLocationRow>(ASSET_LOCATIONS_PATH, id);
    return res.data as AssetLocationRow;
  },

  async create(body: {
    asset_id: string;
    branch_id?: string;
    location_label: string;
    org_location_id?: string;
    effective_from?: string;
  }): Promise<AssetLocationRow> {
    const res = await resourceService.create<AssetLocationRow>(ASSET_LOCATIONS_PATH, body);
    return res.data as AssetLocationRow;
  },

  async update(
    id: string,
    body: {
      location_label?: string;
      org_location_id?: string | null;
      effective_from?: string | null;
      effective_to?: string | null;
      branch_id?: string | null;
      version: number;
    },
  ): Promise<AssetLocationRow> {
    const res = await resourceService.update<AssetLocationRow>(ASSET_LOCATIONS_PATH, id, body);
    return res.data as AssetLocationRow;
  },

  async complete(id: string): Promise<AssetLocationRow> {
    const res = await resourceService.action<AssetLocationRow>(
      ASSET_LOCATIONS_PATH,
      id,
      "complete",
    );
    return res.data as AssetLocationRow;
  },
};

export type MaintenancePlanRow = {
  id: string;
  branch_id?: string | null;
  document_number: string;
  asset_id: string;
  plan_name: string;
  maintenance_type: string;
  frequency_days?: number | null;
  frequency_meter_units?: number | null;
  next_due_date?: string | null;
  status: string;
  company_id: string;
  version: number;
};

export type MaintenancePlanListResult = {
  items: MaintenancePlanRow[];
  total: number;
  page: number;
  page_size: number;
};

const MAINTENANCE_PLANS_PATH = "/assets/maintenance-plans";

function parseMaintenancePlanList(data: unknown): MaintenancePlanListResult {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as MaintenancePlanListResult;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      page_size: payload.page_size ?? 25,
    };
  }
  return { items: [], total: 0, page: 1, page_size: 25 };
}

export const maintenancePlanService = {
  async search(params: {
    page?: number;
    page_size?: number;
    status?: string;
    maintenance_type?: string;
    asset_id?: string;
    branch_id?: string;
    next_due_date?: string;
    q?: string;
  }): Promise<MaintenancePlanListResult> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.page_size) query.set("page_size", String(params.page_size));
    if (params.status) query.set("status", params.status);
    if (params.maintenance_type) query.set("maintenance_type", params.maintenance_type);
    if (params.asset_id) query.set("asset_id", params.asset_id);
    if (params.branch_id) query.set("branch_id", params.branch_id);
    if (params.next_due_date) query.set("next_due_date", params.next_due_date);
    if (params.q) query.set("q", params.q);
    const res = await resourceService.list<MaintenancePlanListResult>(
      `${MAINTENANCE_PLANS_PATH}?${query.toString()}`,
    );
    return parseMaintenancePlanList(res.data);
  },

  async get(id: string): Promise<MaintenancePlanRow> {
    const res = await resourceService.get<MaintenancePlanRow>(MAINTENANCE_PLANS_PATH, id);
    return res.data as MaintenancePlanRow;
  },

  async create(body: {
    asset_id: string;
    branch_id?: string;
    plan_name: string;
    maintenance_type: string;
    frequency_days?: number;
    frequency_meter_units?: number;
    next_due_date?: string;
  }): Promise<MaintenancePlanRow> {
    const res = await resourceService.create<MaintenancePlanRow>(MAINTENANCE_PLANS_PATH, body);
    return res.data as MaintenancePlanRow;
  },

  async update(
    id: string,
    body: {
      plan_name?: string;
      maintenance_type?: string;
      frequency_days?: number | null;
      frequency_meter_units?: number | null;
      next_due_date?: string | null;
      branch_id?: string | null;
      version: number;
    },
  ): Promise<MaintenancePlanRow> {
    const res = await resourceService.update<MaintenancePlanRow>(
      MAINTENANCE_PLANS_PATH,
      id,
      body,
    );
    return res.data as MaintenancePlanRow;
  },

  async lifecycle(
    id: string,
    action: "activate" | "pause" | "resume" | "close",
  ): Promise<MaintenancePlanRow> {
    const res = await resourceService.action<MaintenancePlanRow>(
      MAINTENANCE_PLANS_PATH,
      id,
      action,
    );
    return res.data as MaintenancePlanRow;
  },
};

export type AssetsOverview = {
  categories: AssetsRow[];
  assets: AssetsRow[];
  components: AssetsRow[];
  assignments: AssetsRow[];
  transfers: AssetsRow[];
  locations: AssetsRow[];
  warranties: AssetsRow[];
  insurances: AssetsRow[];
  maintenancePlans: AssetsRow[];
  maintenances: AssetsRow[];
  depreciations: AssetsRow[];
  disposals: AssetsRow[];
  audits: AssetsRow[];
  meterReadings: AssetsRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): AssetsRow[] {
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is AssetsRow => !!row && typeof row === "object",
    );
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.rows)) return normalizeRows(obj.rows);
    for (const key of ["items", "results", "records", "data", "lines"]) {
      if (Array.isArray(obj[key])) return normalizeRows(obj[key]);
    }
    return [obj];
  }
  return [];
}

/** FP-ASSET-REG-001: GET /assets/assets returns AssetListResult { items, total, page, page_size }. */
export function parseAssetListPayload(data: unknown): AssetsRow[] {
  return normalizeRows(data);
}

async function safeList(
  apiPath: string,
): Promise<{ rows: AssetsRow[]; error?: string; status?: number }> {
  try {
    const response = await resourceService.list(apiPath);
    return { rows: normalizeRows(response.data) };
  } catch (err) {
    if (err instanceof ApiClientError) {
      return { rows: [], error: err.message, status: err.status };
    }
    return { rows: [], error: `Failed to load ${apiPath}`, status: 500 };
  }
}

export function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function asStatus(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function sumField(rows: AssetsRow[], field: string): number {
  return rows.reduce((sum, row) => sum + asNumber(row[field]), 0);
}

export function countByStatus(rows: AssetsRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countOpenDocs(
  rows: AssetsRow[],
  closedStatuses: string[],
): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export type AssetPortalAssignmentSummary = {
  document_number?: string | null;
  allocation_type?: string | null;
  status?: string | null;
  assignee_label?: string | null;
};

export type AssetPortalWarrantySummary = {
  warranty_type?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

export type AssetPortalInsuranceSummary = {
  policy_number?: string | null;
  insurer_name?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

export type AssetInformationPortal = {
  asset_id: string;
  asset_code: string;
  asset_name: string;
  category_code?: string | null;
  category_name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  asset_type: string;
  status: string;
  assignment?: AssetPortalAssignmentSummary | null;
  warranty?: AssetPortalWarrantySummary | null;
  insurance?: AssetPortalInsuranceSummary | null;
  self_service_path: string;
  discovery_profile_json?: Record<string, unknown> | null;
  version?: number | null;
};

export type DiscoveryPlatform = "windows" | "linux" | "macos";

export type DiscoveryChangeItem = {
  path: string;
  before?: unknown;
  after?: unknown;
};

export type DiscoveryParseResult = {
  asset_id: string;
  platform: string;
  profile: Record<string, unknown>;
  changes: DiscoveryChangeItem[];
  current_serial_number?: string | null;
  proposed_serial_number?: string | null;
  persisted: boolean;
};

export type DiscoveryApplyResult = {
  asset_id: string;
  version: number;
  serial_number?: string | null;
  discovery_profile_json?: Record<string, unknown> | null;
  changes: DiscoveryChangeItem[];
  applied: boolean;
};

export const assetDiscoveryService = {
  async getCommand(platform: DiscoveryPlatform): Promise<{ platform: string; command: string }> {
    const res = await apiClient<{ platform: string; command: string }>(
      "/assets/assets/discovery/command",
      { method: "GET", query: { platform } },
    );
    return res.data as { platform: string; command: string };
  },

  async parse(
    assetId: string,
    body: { platform: DiscoveryPlatform; raw_output: string },
  ): Promise<DiscoveryParseResult> {
    const res = await apiClient<DiscoveryParseResult>(
      `/assets/assets/${assetId}/discovery/parse`,
      { method: "POST", body },
    );
    return res.data as DiscoveryParseResult;
  },

  async apply(
    assetId: string,
    body: {
      platform: DiscoveryPlatform;
      raw_output: string;
      version: number;
      preview_confirmed: boolean;
    },
  ): Promise<DiscoveryApplyResult> {
    const res = await apiClient<DiscoveryApplyResult>(
      `/assets/assets/${assetId}/discovery/apply`,
      { method: "POST", body },
    );
    return res.data as DiscoveryApplyResult;
  },
};

/** Absolute self-service URL for QR payload (CR-002). Never persist QR images. */
export function buildSelfServiceUrl(assetId: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/$/, "")}/assets/self-service/${assetId}`;
}

export const assetInformationPortalService = {
  async getPortal(assetId: string): Promise<AssetInformationPortal> {
    const res = await apiClient<AssetInformationPortal>(
      `/assets/assets/${assetId}/information-portal`,
      { method: "GET" },
    );
    return res.data as AssetInformationPortal;
  },

  async getSelfService(assetId: string): Promise<AssetInformationPortal> {
    const res = await apiClient<AssetInformationPortal>(
      `/assets/assets/${assetId}/self-service`,
      { method: "GET" },
    );
    return res.data as AssetInformationPortal;
  },
};

export type AssetCategoryRow = {
  id: string;
  branch_id?: string | null;
  category_code: string;
  category_name: string;
  default_useful_life_months?: number | null;
  default_depreciation_method?: string | null;
  gl_asset_account_id?: string | null;
  gl_accum_depr_account_id?: string | null;
  gl_expense_account_id?: string | null;
  status: string;
  company_id: string;
  version: number;
};

export type AssetCategoryListResult = {
  items: AssetCategoryRow[];
  total: number;
  page: number;
  page_size: number;
};

const ASSET_CATEGORIES_PATH = "/assets/asset-categories";

function parseAssetCategoryList(data: unknown): AssetCategoryListResult {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as AssetCategoryListResult;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      page_size: payload.page_size ?? 25,
    };
  }
  if (Array.isArray(data)) {
    return {
      items: data as AssetCategoryRow[],
      total: data.length,
      page: 1,
      page_size: data.length,
    };
  }
  return { items: [], total: 0, page: 1, page_size: 25 };
}

/** Keep only active categories for registration dropdowns (CR-001). */
export function filterActiveCategories<T extends { status?: string }>(
  categories: T[],
): T[] {
  return categories.filter(
    (row) => String(row.status ?? "").toLowerCase() === "active",
  );
}

export const assetCategoryService = {
  async search(params: {
    page?: number;
    page_size?: number;
    status?: string;
    q?: string;
  }): Promise<AssetCategoryListResult> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.page_size) query.set("page_size", String(params.page_size));
    if (params.status) query.set("status", params.status);
    if (params.q) query.set("q", params.q);
    const res = await resourceService.list<AssetCategoryListResult>(
      `${ASSET_CATEGORIES_PATH}?${query.toString()}`,
    );
    return parseAssetCategoryList(res.data);
  },

  async get(id: string): Promise<AssetCategoryRow> {
    const res = await resourceService.get<AssetCategoryRow>(ASSET_CATEGORIES_PATH, id);
    return res.data as AssetCategoryRow;
  },

  async create(body: {
    category_code: string;
    category_name: string;
    default_useful_life_months?: number | null;
    default_depreciation_method?: string | null;
    branch_id?: string;
  }): Promise<AssetCategoryRow> {
    const res = await resourceService.create<AssetCategoryRow>(ASSET_CATEGORIES_PATH, body);
    return res.data as AssetCategoryRow;
  },

  async update(
    id: string,
    body: {
      category_name?: string;
      default_useful_life_months?: number | null;
      default_depreciation_method?: string | null;
      branch_id?: string | null;
      version: number;
    },
  ): Promise<AssetCategoryRow> {
    const res = await resourceService.update<AssetCategoryRow>(
      ASSET_CATEGORIES_PATH,
      id,
      body,
    );
    return res.data as AssetCategoryRow;
  },

  async deactivate(id: string): Promise<AssetCategoryRow> {
    const res = await resourceService.action<AssetCategoryRow>(
      ASSET_CATEGORIES_PATH,
      id,
      "deactivate",
    );
    return res.data as AssetCategoryRow;
  },

  async reactivate(id: string): Promise<AssetCategoryRow> {
    const res = await resourceService.action<AssetCategoryRow>(
      ASSET_CATEGORIES_PATH,
      id,
      "reactivate",
    );
    return res.data as AssetCategoryRow;
  },
};

export async function loadAssetsOverview(): Promise<AssetsOverview> {
  const [
    categories,
    assets,
    components,
    assignments,
    transfers,
    locations,
    warranties,
    insurances,
    maintenancePlans,
    maintenances,
    depreciations,
    disposals,
    audits,
    meterReadings,
  ] = await Promise.all([
    safeList("/assets/asset-categories"),
    safeList("/assets/assets"),
    safeList("/assets/asset-components"),
    safeList("/assets/asset-assignments"),
    safeList("/assets/asset-transfers"),
    safeList("/assets/asset-locations"),
    safeList("/assets/asset-warranties"),
    safeList("/assets/asset-insurances"),
    safeList("/assets/maintenance-plans"),
    safeList("/assets/asset-maintenances"),
    safeList("/assets/asset-depreciations"),
    safeList("/assets/asset-disposals"),
    safeList("/assets/asset-audits"),
    safeList("/assets/meter-readings"),
  ]);

  const results = [
    categories,
    assets,
    components,
    assignments,
    transfers,
    locations,
    warranties,
    insurances,
    maintenancePlans,
    maintenances,
    depreciations,
    disposals,
    audits,
    meterReadings,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    categories: categories.rows,
    assets: assets.rows,
    components: components.rows,
    assignments: assignments.rows,
    transfers: transfers.rows,
    locations: locations.rows,
    warranties: warranties.rows,
    insurances: insurances.rows,
    maintenancePlans: maintenancePlans.rows,
    maintenances: maintenances.rows,
    depreciations: depreciations.rows,
    disposals: disposals.rows,
    audits: audits.rows,
    meterReadings: meterReadings.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}

// --- CR-004 Asset Operations dashboard (read APIs) ---

export type AssetDashboardSummaryDto = {
  company_id: string;
  branch_id?: string | null;
  total_assets: number;
  ready_to_move: number;
  assigned: number;
  retired: number;
  pending_disposal: number;
  disposed: number;
  by_branch?: Array<{
    branch_id: string;
    total_assets: number;
    ready_to_move: number;
    assigned: number;
    retired: number;
    pending_disposal: number;
    disposed: number;
  }>;
};

export type AssetPaginatedListResult = {
  items: AssetsRow[];
  total: number;
  page: number;
  page_size: number;
};

function parsePaginatedAssetList(data: unknown): AssetPaginatedListResult {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as AssetPaginatedListResult;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: asNumber(payload.total),
      page: asNumber(payload.page) || 1,
      page_size: asNumber(payload.page_size) || 25,
    };
  }
  return { items: normalizeRows(data), total: normalizeRows(data).length, page: 1, page_size: 25 };
}

export type AssetOperationsListParams = {
  page?: number;
  page_size?: number;
  branch_id?: string;
  operational_status?: string;
  status?: string;
  asset_category_id?: string;
  q?: string;
  asset_type?: string;
  department_id?: string;
  location_id?: string;
  employee_id?: string;
  assignment_state?: string;
  make?: string;
  model?: string;
};

function buildAssetListQuery(params: AssetOperationsListParams): Record<string, string | number> {
  const query: Record<string, string | number> = {
    page: params.page ?? 1,
    page_size: params.page_size ?? 10,
  };
  if (params.branch_id) query.branch_id = params.branch_id;
  if (params.operational_status) query.operational_status = params.operational_status;
  if (params.status) query.status = params.status;
  if (params.asset_category_id) query.asset_category_id = params.asset_category_id;
  if (params.q) query.q = params.q;
  if (params.asset_type) query.asset_type = params.asset_type;
  if (params.department_id) query.department_id = params.department_id;
  if (params.location_id) query.location_id = params.location_id;
  if (params.employee_id) query.employee_id = params.employee_id;
  if (params.assignment_state) query.assignment_state = params.assignment_state;
  if (params.make) query.make = params.make;
  if (params.model) query.model = params.model;
  return query;
}

export const assetOperationsService = {
  async getDashboardSummary(params?: {
    branch_id?: string;
    company_id?: string;
  }): Promise<AssetDashboardSummaryDto> {
    const res = await apiClient<AssetDashboardSummaryDto>("/assets/assets/dashboard-summary", {
      method: "GET",
      query: {
        branch_id: params?.branch_id,
        company_id: params?.company_id,
      },
    });
    if (!res.data) {
      throw new ApiClientError("Dashboard summary returned no data", 500);
    }
    return res.data;
  },

  async importExcelRegister(body: {
    company_id?: string | null;
    batch_size?: number;
    confirm_warnings: boolean;
    defaults: {
      asset_category_id: string;
      asset_type?: string;
      purchase_date?: string | null;
      purchase_cost?: string;
      currency_code?: string;
    };
    rows: Array<Record<string, unknown>>;
  }): Promise<{
    total_rows: number;
    imported: number;
    skipped: number;
    duplicates: number;
    warnings: number;
    failed: number;
    duration_ms: number;
    batch_count: number;
    rows: Array<Record<string, unknown>>;
  }> {
    const res = await apiClient<{
      total_rows: number;
      imported: number;
      skipped: number;
      duplicates: number;
      warnings: number;
      failed: number;
      duration_ms: number;
      batch_count: number;
      rows: Array<Record<string, unknown>>;
    }>("/assets/assets/import", {
      method: "POST",
      body,
    });
    if (!res.data) {
      throw new ApiClientError("Excel import returned no data", 500);
    }
    return res.data;
  },

  async listAssets(params: AssetOperationsListParams = {}): Promise<AssetPaginatedListResult> {
    const res = await resourceService.list<AssetPaginatedListResult>(
      "/assets/assets",
      buildAssetListQuery(params),
    );
    return parsePaginatedAssetList(res.data);
  },

  async listAssignments(params: {
    page?: number;
    page_size?: number;
    branch_id?: string;
    status?: string;
    q?: string;
    asset_id?: string;
    allocation_type?: string;
  } = {}): Promise<AssetPaginatedListResult> {
    const query: Record<string, string | number> = {
      page: params.page ?? 1,
      // Asset module pagination max is 200 (FastAPI Query le=200).
      page_size: Math.min(params.page_size ?? 10, 200),
    };
    if (params.branch_id) query.branch_id = params.branch_id;
    if (params.status) query.status = params.status;
    if (params.q) query.q = params.q;
    if (params.asset_id) query.asset_id = params.asset_id;
    if (params.allocation_type) query.allocation_type = params.allocation_type;
    const res = await resourceService.list<AssetPaginatedListResult>(
      "/assets/asset-assignments",
      query,
    );
    return parsePaginatedAssetList(res.data);
  },
};

const ASSETS_REGISTER_PATH = "/assets/assets";

/** Asset register CRUD + search (inventory and detail flows). */
export const assetRegisterService = {
  search(params: AssetOperationsListParams = {}): Promise<AssetPaginatedListResult> {
    return assetOperationsService.listAssets(params);
  },

  async get(id: string): Promise<AssetsRow> {
    const res = await resourceService.get<AssetsRow>(ASSETS_REGISTER_PATH, id);
    return res.data as AssetsRow;
  },

  async create(body: Record<string, unknown>): Promise<AssetsRow> {
    const res = await resourceService.create<AssetsRow>(ASSETS_REGISTER_PATH, body);
    return res.data as AssetsRow;
  },

  async update(id: string, body: Record<string, unknown>): Promise<AssetsRow> {
    const res = await resourceService.update<AssetsRow>(ASSETS_REGISTER_PATH, id, body);
    return res.data as AssetsRow;
  },

  async action(id: string, actionName: string, body?: unknown): Promise<AssetsRow> {
    const res = await resourceService.action<AssetsRow>(
      ASSETS_REGISTER_PATH,
      id,
      actionName,
      body,
    );
    return res.data as AssetsRow;
  },

  /** Phase 5D: RETIRED → PENDING_DISPOSAL */
  async startDisposal(id: string, comments?: string): Promise<AssetsRow> {
    return this.action(id, "start-disposal", comments ? { comments } : undefined);
  },

  /** Phase 5E: PENDING_DISPOSAL → READY_TO_MOVE */
  async reinstate(id: string, comments?: string): Promise<AssetsRow> {
    return this.action(id, "reinstate", comments ? { comments } : undefined);
  },
};

const INCOMING_ASSETS_PATH = "/assets/incoming-assets";

export type IncomingArrivalStatus = "EXPECTED" | "PARTIALLY_ARRIVED" | "ARRIVED";

export type IncomingAssetUnitRow = {
  id: string;
  unit_index: number;
  serial_number?: string | null;
  status: "PENDING" | "ARRIVED" | string;
  arrived_at?: string | null;
  arrived_by?: string | null;
};

export type IncomingAssetLineRow = {
  id: string;
  company_id: string;
  branch_id: string;
  grn_id: string;
  grn_line_id: string;
  purchase_order_id?: string | null;
  product_id: string;
  vendor_id?: string | null;
  grn_document_number: string;
  po_document_number?: string | null;
  product_code?: string | null;
  product_name?: string | null;
  document_date?: string | null;
  expected_quantity: number | string;
  arrived_quantity: number | string;
  pending_quantity: number | string;
  status: IncomingArrivalStatus | string;
  version: number;
  units?: IncomingAssetUnitRow[];
};

export type IncomingAssetListResult = {
  items: IncomingAssetLineRow[];
  total: number;
  page: number;
  page_size: number;
};

export type IncomingAssetSummary = {
  expected_lines: number;
  pending_arrival_lines: number;
  partially_arrived_lines: number;
  arrived_lines: number;
  expected_quantity_total: number;
  arrived_quantity_total: number;
  pending_quantity_total: number;
};

function parseIncomingList(data: unknown): IncomingAssetListResult {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as IncomingAssetListResult;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      page_size: payload.page_size ?? 25,
    };
  }
  return { items: [], total: 0, page: 1, page_size: 25 };
}

export const incomingAssetService = {
  async summary(params?: {
    branch_id?: string;
    company_id?: string;
  }): Promise<IncomingAssetSummary> {
    const res = await apiClient<IncomingAssetSummary>(`${INCOMING_ASSETS_PATH}/summary`, {
      method: "GET",
      query: {
        branch_id: params?.branch_id,
        company_id: params?.company_id,
      },
    });
    if (!res.data) {
      throw new ApiClientError("Incoming assets summary returned no data", 500);
    }
    return res.data;
  },

  async search(params: {
    page?: number;
    page_size?: number;
    branch_id?: string;
    company_id?: string;
    status?: string;
    grn_id?: string;
    purchase_order_id?: string;
    document_date_from?: string;
    document_date_to?: string;
    q?: string;
  } = {}): Promise<IncomingAssetListResult> {
    const query: Record<string, string | number> = {
      page: params.page ?? 1,
      page_size: params.page_size ?? 25,
    };
    if (params.branch_id) query.branch_id = params.branch_id;
    if (params.company_id) query.company_id = params.company_id;
    if (params.status) query.status = params.status;
    if (params.grn_id) query.grn_id = params.grn_id;
    if (params.purchase_order_id) query.purchase_order_id = params.purchase_order_id;
    if (params.document_date_from) query.document_date_from = params.document_date_from;
    if (params.document_date_to) query.document_date_to = params.document_date_to;
    if (params.q) query.q = params.q;
    const res = await resourceService.list<IncomingAssetListResult>(INCOMING_ASSETS_PATH, query);
    return parseIncomingList(res.data);
  },

  async get(id: string): Promise<IncomingAssetLineRow> {
    const res = await resourceService.get<IncomingAssetLineRow>(INCOMING_ASSETS_PATH, id);
    return res.data as IncomingAssetLineRow;
  },

  async arrive(
    id: string,
    body: {
      quantity?: number;
      mark_all?: boolean;
      units?: Array<{ unit_index: number; serial_number?: string }>;
      notes?: string;
    },
  ): Promise<IncomingAssetLineRow> {
    const res = await resourceService.action<IncomingAssetLineRow>(
      INCOMING_ASSETS_PATH,
      id,
      "arrive",
      body,
    );
    return res.data as IncomingAssetLineRow;
  },
};

export type IncomingQcStatus = "PENDING" | "IN_PROGRESS" | "ACCEPTED" | "REJECTED";
export type IncomingUnitQcStatus = "PENDING_QC" | "ACCEPTED" | "REJECTED";

export type IncomingAssetQcLineRow = IncomingAssetLineRow & {
  accepted_quantity: number | string;
  rejected_quantity: number | string;
  pending_qc_quantity: number | string;
  qc_status: IncomingQcStatus | string;
  qc_started_at?: string | null;
  qc_started_by?: string | null;
  qc_notes?: string | null;
  quality_inspection_id?: string | null;
  units?: Array<
    IncomingAssetUnitRow & {
      qc_status?: IncomingUnitQcStatus | string | null;
      tested_at?: string | null;
      tested_by?: string | null;
      qc_notes?: string | null;
      rejection_reason?: string | null;
      evidence_uri?: string | null;
      quality_inspection_id?: string | null;
    }
  >;
};

export type IncomingAssetQcListResult = {
  items: IncomingAssetQcLineRow[];
  total: number;
  page: number;
  page_size: number;
};

function parseIncomingQcList(data: unknown): IncomingAssetQcListResult {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as IncomingAssetQcListResult;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      page_size: payload.page_size ?? 25,
    };
  }
  return { items: [], total: 0, page: 1, page_size: 25 };
}

export const incomingAssetQcService = {
  async search(params: {
    page?: number;
    page_size?: number;
    branch_id?: string;
    company_id?: string;
    qc_status?: string;
    grn_id?: string;
    purchase_order_id?: string;
    q?: string;
  } = {}): Promise<IncomingAssetQcListResult> {
    const query: Record<string, string | number> = {
      page: params.page ?? 1,
      page_size: params.page_size ?? 25,
    };
    if (params.branch_id) query.branch_id = params.branch_id;
    if (params.company_id) query.company_id = params.company_id;
    if (params.qc_status) query.qc_status = params.qc_status;
    if (params.grn_id) query.grn_id = params.grn_id;
    if (params.purchase_order_id) query.purchase_order_id = params.purchase_order_id;
    if (params.q) query.q = params.q;
    const res = await resourceService.list<IncomingAssetQcListResult>(
      `${INCOMING_ASSETS_PATH}/qc`,
      query,
    );
    return parseIncomingQcList(res.data);
  },

  async get(id: string): Promise<IncomingAssetQcLineRow> {
    const res = await apiClient<IncomingAssetQcLineRow>(`${INCOMING_ASSETS_PATH}/${id}/qc`, {
      method: "GET",
    });
    return res.data as IncomingAssetQcLineRow;
  },

  async start(id: string): Promise<IncomingAssetQcLineRow> {
    const res = await resourceService.action<IncomingAssetQcLineRow>(
      INCOMING_ASSETS_PATH,
      id,
      "qc/start",
      {},
    );
    return res.data as IncomingAssetQcLineRow;
  },

  async accept(
    id: string,
    body: {
      quantity?: number;
      unit_ids?: string[];
      mark_all_pending?: boolean;
      notes?: string;
      evidence_uri?: string;
      quality_inspection_id?: string;
    },
  ): Promise<IncomingAssetQcLineRow> {
    const res = await resourceService.action<IncomingAssetQcLineRow>(
      INCOMING_ASSETS_PATH,
      id,
      "qc/accept",
      body,
    );
    return res.data as IncomingAssetQcLineRow;
  },

  async reject(
    id: string,
    body: {
      quantity?: number;
      unit_ids?: string[];
      mark_all_pending?: boolean;
      notes?: string;
      rejection_reason: string;
      evidence_uri?: string;
      quality_inspection_id?: string;
    },
  ): Promise<IncomingAssetQcLineRow> {
    const res = await resourceService.action<IncomingAssetQcLineRow>(
      INCOMING_ASSETS_PATH,
      id,
      "qc/reject",
      body,
    );
    return res.data as IncomingAssetQcLineRow;
  },
};

const REGISTRATION_QUEUE_PATH = "/assets/registration-queue";

export type RegistrationStatus =
  | "PENDING_REGISTRATION"
  | "PARTIALLY_REGISTERED"
  | "REGISTERED"
  | string;

export type RegistrationQueueItem = {
  incoming_unit_id: string;
  incoming_line_id: string;
  unit_index: number;
  unit_reference: string;
  product_name?: string | null;
  product_code?: string | null;
  serial_number?: string | null;
  grn_id: string;
  grn_document_number: string;
  purchase_order_id?: string | null;
  po_document_number?: string | null;
  branch_id: string;
  qc_status: string;
  registration_status: RegistrationStatus;
  line_registration_status: RegistrationStatus;
  registered_asset_id?: string | null;
};

export type RegistrationQueueSummary = {
  accepted: number;
  registered: number;
  pending_registration: number;
};

export type IncomingRegistrationPrefill = {
  incoming_line_id: string;
  incoming_unit_id: string;
  unit_index: number;
  grn_id: string;
  grn_document_number: string;
  purchase_order_id?: string | null;
  po_document_number?: string | null;
  branch_id: string;
  product_id: string;
  supplier_vendor_id?: string | null;
  quality_inspection_id?: string | null;
  asset_name: string;
  serial_number?: string | null;
  purchase_date?: string | null;
  purchase_cost?: number | string | null;
  currency_code?: string;
  asset_category_id?: string | null;
  asset_type?: string;
  qc_status: string;
  registration_status: string;
  registered_asset_id?: string | null;
};

export type RegistrationExcelRow = {
  incoming_unit_id?: string | null;
  asset_name?: string | null;
  serial_number?: string | null;
  branch_id?: string | null;
  asset_category_id?: string | null;
  asset_type?: string | null;
  purchase_date?: string | null;
  purchase_cost?: string | null;
  currency_code?: string | null;
  make?: string | null;
  model?: string | null;
  configuration?: string | null;
  location?: string | null;
};

export type RegistrationExcelRowResult = RegistrationExcelRow & {
  row_number: number;
  status: string;
  errors: string[];
  grn_document_number?: string | null;
  po_document_number?: string | null;
  qc_status?: string | null;
};

export const assetRegistrationQueueService = {
  async summary(params: { branch_id?: string; company_id?: string } = {}) {
    const query: Record<string, string> = {};
    if (params.branch_id) query.branch_id = params.branch_id;
    if (params.company_id) query.company_id = params.company_id;
    const res = await apiClient<RegistrationQueueSummary>(`${REGISTRATION_QUEUE_PATH}/summary`, {
      method: "GET",
      query,
    });
    return res.data as RegistrationQueueSummary;
  },

  async search(params: {
    page?: number;
    page_size?: number;
    branch_id?: string;
    grn_id?: string;
    purchase_order_id?: string;
    registration_status?: string;
    q?: string;
  } = {}) {
    const query: Record<string, string | number> = {
      page: params.page ?? 1,
      page_size: params.page_size ?? 25,
    };
    if (params.branch_id) query.branch_id = params.branch_id;
    if (params.grn_id) query.grn_id = params.grn_id;
    if (params.purchase_order_id) query.purchase_order_id = params.purchase_order_id;
    if (params.registration_status) query.registration_status = params.registration_status;
    if (params.q) query.q = params.q;
    const res = await apiClient<{
      items: RegistrationQueueItem[];
      total: number;
      page: number;
      page_size: number;
    }>(REGISTRATION_QUEUE_PATH, { method: "GET", query });
    const data = res.data;
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      total: data?.total ?? 0,
      page: data?.page ?? 1,
      page_size: data?.page_size ?? 25,
    };
  },

  async downloadTemplate(params: { branch_id?: string } = {}): Promise<Blob> {
    const token = (await import("@/lib/auth")).getAccessToken();
    const { env } = await import("@/utils/env");
    const qs = new URLSearchParams();
    if (params.branch_id) qs.set("branch_id", params.branch_id);
    const url = `${env.apiUrl}${REGISTRATION_QUEUE_PATH}/excel-template${qs.toString() ? `?${qs}` : ""}`;
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new ApiClientError("Failed to download template", response.status);
    return response.blob();
  },

  async validateExcel(rows: RegistrationExcelRow[]) {
    const res = await apiClient<{
      valid_count: number;
      error_count: number;
      warning_count: number;
      rows: RegistrationExcelRowResult[];
    }>(`${REGISTRATION_QUEUE_PATH}/excel/validate`, {
      method: "POST",
      body: { rows },
    });
    return res.data!;
  },

  async confirmExcel(rows: RegistrationExcelRow[], activate = true) {
    const res = await apiClient<{
      registered_count: number;
      activation_complete: number;
      activation_incomplete: number;
      items: Array<{
        row_number: number;
        incoming_unit_id: string;
        asset_id: string;
        asset_code?: string | null;
        created: boolean;
        activation: string;
        activation_error?: string | null;
        operational_status?: string | null;
      }>;
    }>(`${REGISTRATION_QUEUE_PATH}/excel/confirm`, {
      method: "POST",
      body: { rows, activate },
    });
    return res.data!;
  },

  async prefillFromIncoming(incomingUnitId: string, incomingLineId?: string) {
    const query: Record<string, string> = { incoming_unit_id: incomingUnitId };
    if (incomingLineId) query.incoming_line_id = incomingLineId;
    const res = await apiClient<IncomingRegistrationPrefill>(
      `${ASSETS_REGISTER_PATH}/registration/prefill-from-incoming`,
      { method: "GET", query },
    );
    return res.data as IncomingRegistrationPrefill;
  },
};

const DC_CHALLAN_PATH = "/assets/asset-dc-challans";

export type DcChallanDocument = {
  id?: string | null;
  doc_kind: string;
  original_filename?: string | null;
  content_type?: string | null;
  file_size_bytes?: number | null;
  checksum_sha256?: string | null;
  source?: string | null;
  uploaded_by_user_id?: string | null;
  uploaded_at?: string | null;
  external_url?: string | null;
  is_legacy?: boolean;
  has_stored_file?: boolean;
};

export type DcChallanRow = {
  id: string;
  dc_number: string;
  asset_id: string;
  assignment_id?: string | null;
  employee_id?: string | null;
  status: string;
  company_id: string;
  branch_id: string;
  employee_code?: string | null;
  employee_name?: string | null;
  employee_phone?: string | null;
  employee_email?: string | null;
  deployed_to?: string | null;
  asset_name?: string | null;
  asset_tag?: string | null;
  make?: string | null;
  model?: string | null;
  serial_number?: string | null;
  purchase_cost?: string | number | null;
  sent_to_scm_at?: string | null;
  scm_reference_number?: string | null;
  scm_document_url?: string | null;
  scm_document_uploaded_at?: string | null;
  signed_document_url?: string | null;
  signed_document_uploaded_at?: string | null;
  signed_at?: string | null;
  received_at?: string | null;
  remarks?: string | null;
  version: number;
  created_at?: string | null;
  updated_at?: string | null;
  scm_issued_document?: DcChallanDocument | null;
  signed_document?: DcChallanDocument | null;
};

export type DcChallanListResult = {
  items: DcChallanRow[];
  total: number;
  page: number;
  page_size: number;
  upload_limits?: DcChallanUploadLimits;
};

export type DcChallanUploadLimits = {
  max_upload_mb: number;
  allowed_content_types: string[];
};

export type DcChallanSummary = {
  pending: number;
  sent_to_scm: number;
  document_received: number;
  signed: number;
  received: number;
  cancelled: number;
  upload_limits?: DcChallanUploadLimits;
};

export type DcChallanBulkSendResult = {
  results: Array<{ id: string; ok: boolean; reason?: string | null }>;
  sent_count: number;
  skipped_count: number;
};

function parseDcChallanList(data: unknown): DcChallanListResult {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as DcChallanListResult;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      page_size: payload.page_size ?? 25,
      upload_limits: payload.upload_limits,
    };
  }
  return { items: [], total: 0, page: 1, page_size: 25 };
}

export const dcChallanService = {
  async summary(params?: { company_id?: string }): Promise<DcChallanSummary> {
    const res = await apiClient<DcChallanSummary>(`${DC_CHALLAN_PATH}/summary`, {
      method: "GET",
      query: { company_id: params?.company_id },
    });
    if (!res.data) {
      throw new ApiClientError("DC challan summary returned no data", 500);
    }
    return res.data;
  },

  async search(params: {
    page?: number;
    page_size?: number;
    status?: string;
    asset_id?: string;
    assignment_id?: string;
    unlinked?: boolean;
    q?: string;
    created_from?: string;
    created_to?: string;
  } = {}): Promise<DcChallanListResult> {
    const query: Record<string, string | number | boolean | undefined> = {
      page: params.page,
      page_size: params.page_size,
      status: params.status,
      asset_id: params.asset_id,
      assignment_id: params.assignment_id,
      q: params.q,
      created_from: params.created_from,
      created_to: params.created_to,
    };
    if (params.unlinked) query.unlinked = true;
    const res = await resourceService.list<DcChallanListResult>(DC_CHALLAN_PATH, query);
    return parseDcChallanList(res.data);
  },

  async get(id: string): Promise<DcChallanRow> {
    const res = await resourceService.get<DcChallanRow>(DC_CHALLAN_PATH, id);
    return res.data as DcChallanRow;
  },

  async create(body: {
    asset_id: string;
    assignment_id?: string;
    employee_id?: string;
    employee_phone?: string;
    remarks?: string;
  }): Promise<DcChallanRow> {
    const res = await resourceService.create<DcChallanRow>(DC_CHALLAN_PATH, body);
    return res.data as DcChallanRow;
  },

  async update(id: string, body: Partial<DcChallanRow>): Promise<DcChallanRow> {
    const res = await resourceService.update<DcChallanRow>(DC_CHALLAN_PATH, id, body);
    return res.data as DcChallanRow;
  },

  async sendToScm(id: string): Promise<DcChallanRow> {
    const res = await resourceService.action<DcChallanRow>(DC_CHALLAN_PATH, id, "send-to-scm");
    return res.data as DcChallanRow;
  },

  async bulkSendToScm(ids: string[]): Promise<DcChallanBulkSendResult> {
    const res = await apiClient<DcChallanBulkSendResult>(`${DC_CHALLAN_PATH}/bulk-send-to-scm`, {
      method: "POST",
      body: { ids },
    });
    if (!res.data) {
      throw new ApiClientError("Bulk send returned no data", 500);
    }
    return res.data;
  },

  async linkAssignment(id: string, assignmentId: string): Promise<DcChallanRow> {
    const res = await resourceService.action<DcChallanRow>(DC_CHALLAN_PATH, id, "link-assignment", {
      assignment_id: assignmentId,
    });
    return res.data as DcChallanRow;
  },

  async attachScmDocument(
    id: string,
    body: { document_url: string; scm_reference_number?: string },
  ): Promise<DcChallanRow> {
    const res = await resourceService.action<DcChallanRow>(
      DC_CHALLAN_PATH,
      id,
      "attach-scm-document",
      body,
    );
    return res.data as DcChallanRow;
  },

  async markSigned(id: string, signedDocumentUrl?: string): Promise<DcChallanRow> {
    const res = await resourceService.action<DcChallanRow>(DC_CHALLAN_PATH, id, "mark-signed", {
      signed_document_url: signedDocumentUrl,
    });
    return res.data as DcChallanRow;
  },

  async markReceived(id: string): Promise<DcChallanRow> {
    const res = await resourceService.action<DcChallanRow>(DC_CHALLAN_PATH, id, "mark-received");
    return res.data as DcChallanRow;
  },

  async cancel(id: string): Promise<DcChallanRow> {
    const res = await resourceService.action<DcChallanRow>(DC_CHALLAN_PATH, id, "cancel");
    return res.data as DcChallanRow;
  },

  async uploadScmIssued(id: string, file: File, scmReferenceNumber?: string): Promise<DcChallanRow> {
    const form = new FormData();
    form.append("file", file);
    if (scmReferenceNumber) form.append("scm_reference_number", scmReferenceNumber);
    const res = await apiUpload<DcChallanRow>(`${DC_CHALLAN_PATH}/${id}/documents/scm-issued`, form);
    return res.data as DcChallanRow;
  },

  async uploadSigned(id: string, file: File): Promise<DcChallanRow> {
    const form = new FormData();
    form.append("file", file);
    const res = await apiUpload<DcChallanRow>(`${DC_CHALLAN_PATH}/${id}/documents/signed`, form);
    return res.data as DcChallanRow;
  },

  async getDocumentBlob(
    id: string,
    docKind: "scm-issued" | "signed",
    disposition: "inline" | "attachment" = "inline",
  ) {
    return apiGetBlob(`${DC_CHALLAN_PATH}/${id}/documents/${docKind}/content`, {
      disposition,
    });
  },
};
