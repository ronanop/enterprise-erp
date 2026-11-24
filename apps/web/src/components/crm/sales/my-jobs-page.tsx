"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Check, Download, X } from "lucide-react";

import { CrmErrorBanner, CrmListPanel, CrmPage, CRM_TABLE_HEAD_ROW } from "@/components/crm/crm-ui";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { FinanceField, FinanceSelect, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import { CrmSortableTh, sortRows, useTableSort } from "@/components/crm/sales/crm-table-sort";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { canViewAllModuleScreens } from "@/lib/module-access";
import { ApiClientError } from "@/services/api-client";
import { respondMyJob } from "@/services/crm-deal-controls-service";
import { Input } from "@/components/ui/input";
import { downloadOvfExportById, downloadQuoteExport } from "@/lib/crm/crm-record-actions";
import { supportingRowsFromOvfLines } from "@/components/crm/sales/ovf-order-lines-section";
import {
  decideMyJob,
  downloadAttachment,
  fileToBase64,
  formatInrPrecise,
  getOvf,
  getQuote,
  getSalesLead,
  listAttachments,
  listMyJobs,
  listOpportunities,
  listOvfLines,
  listOvfs,
  listQuoteLines,
  listQuotes,
  listSalesLeads,
  myJobEntityHref,
  type ApprovalTask,
  type Attachment,
} from "@/services/sales-crm-service";
import {
  listServiceContracts,
  serviceTypeLabel,
  type ServiceRateContract,
} from "@/services/service-projects-service";

const FREIGHT_ACTION = "provide_freight";
const SUPPORTING_ITEMS_ACTION = "provide_supporting_items";
const PRICE_SUPPORTING_ACTION = "price_supporting_items";
const SERVICE_VISITS_ACTION = "provide_service_visits";
const ATTACHMENT_ACTIONS = new Set(["provide_boq_attachment", "provide_sow_attachment"]);
const DOC_APPROVAL_ACTIONS = new Set(["approve_boq", "approve_sow"]);
/** Finance → Legal → Management customer PO chain (same two docs on every stage). */
const PO_APPROVAL_ACTIONS = new Set(["approve_po_finance", "approve_po_terms", "approve_po"]);
const ACCEPTED_QUOTE_PRINT_NAME = "Accepted_Quote_Print.pdf";

type PoApprovalDocs = {
  quotePrint: Attachment | null;
  customerPo: Attachment | null;
};

type DocApprovalFile = {
  attachment: Attachment | null;
  label: string;
};

function isDocApprovalTask(task: ApprovalTask): boolean {
  return Boolean(task.action && DOC_APPROVAL_ACTIONS.has(task.action));
}

function docApprovalCategory(action: string | null | undefined): "boq" | "sow" | null {
  if (action === "approve_boq") return "boq";
  if (action === "approve_sow") return "sow";
  return null;
}

function isPoApprovalTask(task: ApprovalTask): boolean {
  return (
    task.entity_type === "opportunity" &&
    Boolean(task.action && PO_APPROVAL_ACTIONS.has(task.action))
  );
}

function needsCustomerPoDownload(task: ApprovalTask): boolean {
  return isPoApprovalTask(task) || task.action === FREIGHT_ACTION;
}
const FREIGHT_MEDIUMS = [
  { value: "road", label: "Road" },
  { value: "air", label: "Air" },
  { value: "sea", label: "Sea" },
  { value: "courier", label: "Courier" },
] as const;

type SupportingDraft = {
  key: string;
  product_name: string;
  qty: string;
  unit_price: string;
  distributor_name: string;
};

function blankSupportingDraft(): SupportingDraft {
  return {
    key: `si-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    product_name: "",
    qty: "1",
    unit_price: "0",
    distributor_name: "",
  };
}

const SELECT_CLASS =
  "h-9 w-full cursor-pointer rounded-lg border border-input bg-background px-2.5 text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

type SortKey = "title" | "created_at";

function myJobDetailHref(task: ApprovalTask): string {
  const base = myJobEntityHref(task.entity_type, task.entity_id);
  if (base === "/crm/my-jobs") return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}from=my-jobs`;
}

function approveLabel(task: ApprovalTask): string {
  if (task.action === FREIGHT_ACTION) return "Submit freight";
  if (task.action === SUPPORTING_ITEMS_ACTION) return "Submit items";
  if (task.action === PRICE_SUPPORTING_ACTION) return "Submit prices";
  if (task.action === SERVICE_VISITS_ACTION) return "Submit plan";
  if (task.action && ATTACHMENT_ACTIONS.has(task.action)) return "Submit file";
  return "Approve";
}

type PricingDraft = {
  line_id: string;
  product_name: string;
  qty: string;
  unit_price: string;
};

function shortTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Reply (1h) and attach (6h) deadlines for BOQ/SOW requests. */
function SlaLine({ task, now }: { task: ApprovalTask; now: number }) {
  if (!task.action || !ATTACHMENT_ACTIONS.has(task.action) || task.status !== "pending") return null;
  const replyLate = !task.responded_at && task.response_due_at && now > Date.parse(task.response_due_at);
  const attachLate = task.due_at && now > Date.parse(task.due_at);
  return (
    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px]">
      {task.responded_at ? (
        <span className={task.response === "cannot_submit" ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}>
          {task.response === "cannot_submit" ? `Cannot submit: ${task.response_reason ?? "-"}` : "Confirmed - will submit"}
        </span>
      ) : task.response_due_at ? (
        <span className={replyLate ? "font-semibold text-red-700 dark:text-red-400" : "text-muted-foreground"}>
          Reply by {shortTime(task.response_due_at)}
          {replyLate ? " (missed)" : ""}
        </span>
      ) : null}
      {task.due_at ? (
        <span className={attachLate ? "font-semibold text-red-700 dark:text-red-400" : "text-muted-foreground"}>
          Attach by {shortTime(task.due_at)}
          {attachLate ? " (overdue)" : ""}
        </span>
      ) : null}
      {task.escalation_level ? <span className="font-semibold text-red-700 dark:text-red-400">Escalated to manager</span> : null}
    </div>
  );
}

export function MyJobsPage({
  companyAccountId,
  embedded,
}: {
  companyAccountId?: string;
  embedded?: boolean;
} = {}) {
  const { user, adminModuleKeys, moduleRoles, loading: authLoading } = useAuthUser();
  const isCrmAdmin = canViewAllModuleScreens(
    "crm",
    adminModuleKeys,
    user?.userType,
    moduleRoles,
  );
  const [rows, setRows] = useState<ApprovalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** CRM / ERP admins see the full tenant inbox; others only their assignments. */
  const [mineOnly, setMineOnly] = useState(true);
  const [mineFilterReady, setMineFilterReady] = useState(false);
  const { sortBy, sortDir, onSort } = useTableSort<SortKey>("created_at", "desc");

  useEffect(() => {
    if (authLoading || mineFilterReady) return;
    setMineOnly(!isCrmAdmin);
    setMineFilterReady(true);
  }, [authLoading, isCrmAdmin, mineFilterReady]);

  const [decision, setDecision] = useState<{ task: ApprovalTask; outcome: "approved" | "rejected" } | null>(null);
  const [remark, setRemark] = useState("");
  const [freightAmount, setFreightAmount] = useState("");
  const [freightMedium, setFreightMedium] = useState("road");
  const [freightWeightKg, setFreightWeightKg] = useState("");
  const [freightInsurance, setFreightInsurance] = useState(false);
  const [supportingDrafts, setSupportingDrafts] = useState<SupportingDraft[]>([blankSupportingDraft()]);
  const [supportingDescription, setSupportingDescription] = useState("");
  const [serviceContracts, setServiceContracts] = useState<ServiceRateContract[] | null>(null);
  const [serviceContractId, setServiceContractId] = useState("");
  const [serviceProjected, setServiceProjected] = useState("");
  const [serviceConsumables, setServiceConsumables] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [decideError, setDecideError] = useState<string | null>(null);
  const [cannotSubmitTask, setCannotSubmitTask] = useState<ApprovalTask | null>(null);
  const [cannotReason, setCannotReason] = useState("");
  const [downloadingQuoteId, setDownloadingQuoteId] = useState<string | null>(null);
  const [downloadingOvfId, setDownloadingOvfId] = useState<string | null>(null);
  const [downloadingDocKey, setDownloadingDocKey] = useState<string | null>(null);
  const [poDocsByTask, setPoDocsByTask] = useState<Record<string, PoApprovalDocs>>({});
  const [docApprovalByTask, setDocApprovalByTask] = useState<Record<string, DocApprovalFile>>({});
  const [pricingDrafts, setPricingDrafts] = useState<PricingDraft[]>([]);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [responding, setResponding] = useState(false);
  const [respondError, setRespondError] = useState<string | null>(null);
  // SLA overdue flags are judged against when the list was fetched.
  const [loadedAt, setLoadedAt] = useState(0);
  const router = useRouter();

  const loadDocApprovalFiles = useCallback(async (tasks: ApprovalTask[]) => {
    const relevant = tasks.filter(isDocApprovalTask);
    if (relevant.length === 0) {
      setDocApprovalByTask({});
      return;
    }
    const entries = await Promise.all(
      relevant.map(async (task) => {
        const category = docApprovalCategory(task.action);
        const label = category === "sow" ? "SOW" : "BOQ";
        if (!category) {
          return [task.id, { attachment: null, label }] as const;
        }
        try {
          let entityType = task.entity_type;
          let entityId = task.entity_id;
          if (task.entity_type === "lead") {
            const lead = await getSalesLead(task.entity_id).catch(() => null);
            if (lead?.converted_opportunity_id) {
              entityType = "opportunity";
              entityId = lead.converted_opportunity_id;
            }
          }
          const rows = await listAttachments(entityType, entityId).catch(() => [] as Attachment[]);
          const match =
            rows.find((row) => row.category === category) ??
            rows.find((row) =>
              category === "boq"
                ? /boq/i.test(row.file_name || "")
                : /sow/i.test(row.file_name || ""),
            ) ??
            null;
          return [task.id, { attachment: match, label }] as const;
        } catch {
          return [task.id, { attachment: null, label }] as const;
        }
      }),
    );
    setDocApprovalByTask(Object.fromEntries(entries));
  }, []);

  const loadPoDocs = useCallback(async (tasks: ApprovalTask[]) => {
    const relevant = tasks.filter(needsCustomerPoDownload);
    if (relevant.length === 0) {
      setPoDocsByTask({});
      return;
    }
    const docsByOpp = new Map<string, PoApprovalDocs>();
    async function docsForOpportunity(oppId: string): Promise<PoApprovalDocs> {
      const cached = docsByOpp.get(oppId);
      if (cached) return cached;
      const rows = await listAttachments("opportunity", oppId).catch(() => [] as Attachment[]);
      const quotePrint =
        rows.find(
          (row) =>
            row.category === "other" &&
            (row.file_name || "").toLowerCase() === ACCEPTED_QUOTE_PRINT_NAME.toLowerCase(),
        ) ??
        rows.find(
          (row) =>
            row.category === "other" && /accepted[_\s-]?quote/i.test(row.file_name || ""),
        ) ??
        null;
      const poRows = rows.filter((row) => row.category === "customer_po");
      const customerPo =
        poRows.find((row) => /\.pdf$/i.test(row.file_name || "")) ?? poRows[0] ?? null;
      const docs = { quotePrint, customerPo };
      docsByOpp.set(oppId, docs);
      return docs;
    }

    const entries = await Promise.all(
      relevant.map(async (task) => {
        try {
          let oppId: string | null = null;
          if (task.entity_type === "opportunity") {
            oppId = task.entity_id;
          } else if (task.entity_type === "ovf") {
            const ovf = await getOvf(task.entity_id);
            oppId = ovf.opportunity_id ?? null;
          }
          if (!oppId) {
            return [task.id, { quotePrint: null, customerPo: null }] as const;
          }
          return [task.id, await docsForOpportunity(oppId)] as const;
        } catch {
          return [task.id, { quotePrint: null, customerPo: null }] as const;
        }
      }),
    );
    setPoDocsByTask(Object.fromEntries(entries));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tasks = await listMyJobs({
        mine: mineOnly || undefined,
        status: "pending",
      });

      let visible = tasks;
      if (companyAccountId) {
        const [leads, opps, quotes, ovfs] = await Promise.all([
          listSalesLeads(companyAccountId).catch(() => []),
          listOpportunities({ company_account_id: companyAccountId }).catch(() => []),
          listQuotes({ company_account_id: companyAccountId }).catch(() => []),
          listOvfs({ company_account_id: companyAccountId }).catch(() => []),
        ]);

        const entityIds = new Set<string>([
          companyAccountId,
          ...leads.map((row) => row.id),
          ...opps.map((row) => row.id),
          ...quotes.map((row) => row.id),
          ...ovfs.map((row) => row.id),
        ]);

        visible = tasks.filter((task) => entityIds.has(task.entity_id));
      }

      setRows(visible);
      setLoadedAt(Date.now());
      await Promise.all([loadPoDocs(visible), loadDocApprovalFiles(visible)]);
    } catch (err) {
      setRows([]);
      setPoDocsByTask({});
      setDocApprovalByTask({});
      setError(err instanceof ApiClientError ? err.message : "Failed to load My Jobs");
    } finally {
      setLoading(false);
    }
  }, [mineOnly, companyAccountId, loadPoDocs, loadDocApprovalFiles]);

  useEffect(() => {
    if (!mineFilterReady) return;
    void load();
  }, [load, mineFilterReady]);

  async function respond(task: ApprovalTask, canSubmit: boolean, reason?: string) {
    setResponding(true);
    setRespondError(null);
    try {
      await respondMyJob(task.id, canSubmit, reason);
      setCannotSubmitTask(null);
      setCannotReason("");
      await load();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Failed to record response";
      if (canSubmit) setError(message);
      else setRespondError(message);
    } finally {
      setResponding(false);
    }
  }

  function openDecision(task: ApprovalTask, outcome: "approved" | "rejected") {
    setDecision({ task, outcome });
    setRemark("");
    setFreightAmount("");
    setFreightMedium("road");
    setFreightWeightKg("");
    setFreightInsurance(false);
    setSupportingDrafts([blankSupportingDraft()]);
    setSupportingDescription("");
    setPricingDrafts([]);
    setServiceContractId("");
    setServiceProjected("");
    setServiceConsumables("");
    setServiceDescription("");
    setAttachmentFile(null);
    setDecideError(null);
    if (outcome === "approved" && task.action === SERVICE_VISITS_ACTION && serviceContracts === null) {
      void listServiceContracts(true)
        .then((rows) => setServiceContracts(rows))
        .catch(() => setServiceContracts([]));
    }
    if (
      outcome === "approved" &&
      task.action === PRICE_SUPPORTING_ACTION &&
      task.entity_type === "ovf"
    ) {
      setLoadingPricing(true);
      void listOvfLines(task.entity_id)
        .then((lines) => {
          const rows = supportingRowsFromOvfLines(lines).map((row) => ({
            line_id: row.id,
            product_name: row.product_name,
            qty: row.qty,
            unit_price: row.unit_price === "0.00" || row.unit_price === "0" ? "" : row.unit_price,
          }));
          setPricingDrafts(rows);
          if (rows.length === 0) {
            setDecideError("No supporting items found on this OVF to price.");
          }
        })
        .catch(() => {
          setPricingDrafts([]);
          setDecideError("Failed to load supporting items for pricing.");
        })
        .finally(() => setLoadingPricing(false));
    }
  }

  async function downloadQuotePdf(task: ApprovalTask) {
    if (task.entity_type !== "quote") return;
    setDownloadingQuoteId(task.id);
    setError(null);
    try {
      const [quoteRow, lineRows] = await Promise.all([
        getQuote(task.entity_id),
        listQuoteLines(task.entity_id),
      ]);
      await downloadQuoteExport(quoteRow, lineRows);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to download quotation PDF");
    } finally {
      setDownloadingQuoteId(null);
    }
  }

  async function downloadOvfPdf(task: ApprovalTask) {
    if (task.entity_type !== "ovf") return;
    setDownloadingOvfId(task.id);
    setError(null);
    try {
      await downloadOvfExportById(task.entity_id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to download OVF PDF");
    } finally {
      setDownloadingOvfId(null);
    }
  }

  async function downloadPoApprovalDoc(
    task: ApprovalTask,
    kind: "quote" | "po",
  ) {
    const docs = poDocsByTask[task.id];
    const attachment = kind === "quote" ? docs?.quotePrint : docs?.customerPo;
    if (!attachment) {
      setError(
        kind === "quote"
          ? "Accepted quote PDF is not available for this PO yet."
          : "Customer PO file is not available for this task yet.",
      );
      return;
    }
    const key = `${task.id}-${kind}`;
    setDownloadingDocKey(key);
    setError(null);
    try {
      await downloadAttachment(attachment.id, attachment.file_name, attachment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download document");
    } finally {
      setDownloadingDocKey(null);
    }
  }

  async function downloadDocApprovalFile(task: ApprovalTask) {
    const docs = docApprovalByTask[task.id];
    const attachment = docs?.attachment;
    if (!attachment) {
      setError(`${docs?.label || "Document"} file is not attached yet`);
      return;
    }
    const key = `${task.id}-doc`;
    setDownloadingDocKey(key);
    setError(null);
    try {
      await downloadAttachment(attachment.id, attachment.file_name, attachment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download document");
    } finally {
      setDownloadingDocKey(null);
    }
  }

  async function submitDecision() {
    if (!decision) return;
    if (decision.outcome === "rejected" && !remark.trim()) {
      setDecideError("A remark is required to reject a task.");
      return;
    }
    const action = decision.task.action;
    if (decision.outcome === "approved" && action === FREIGHT_ACTION) {
      const value = Number(freightAmount);
      if (!Number.isFinite(value) || value < 0) {
        setDecideError("Enter a valid freight amount (₹).");
        return;
      }
      if (!freightMedium.trim()) {
        setDecideError("Select a freight medium.");
        return;
      }
    }
    let supportingPayload:
      | Array<{
        line_id?: string;
        product_name: string;
        qty: number;
        unit_price: number;
        distributor_name?: string | null;
        description?: string | null;
      }>
      | undefined;
    if (decision.outcome === "approved" && action === SUPPORTING_ITEMS_ACTION) {
      const sharedDescription = supportingDescription.trim() || null;
      const cleaned = supportingDrafts
        .map((row) => ({
          product_name: row.product_name.trim(),
          qty: Number(row.qty),
          unit_price: 0,
          distributor_name: row.distributor_name.trim() || null,
          description: sharedDescription,
        }))
        .filter((row) => row.product_name);
      if (cleaned.length === 0) {
        setDecideError("Add at least one supporting item with a name.");
        return;
      }
      for (const row of cleaned) {
        if (!Number.isFinite(row.qty) || row.qty <= 0) {
          setDecideError(`Enter a qty greater than zero for "${row.product_name}".`);
          return;
        }
      }
      supportingPayload = cleaned.map((row) => ({
        ...row,
        qty: Number(row.qty.toFixed(4)),
        unit_price: 0,
      }));
    }
    if (decision.outcome === "approved" && action === PRICE_SUPPORTING_ACTION) {
      if (pricingDrafts.length === 0) {
        setDecideError("No supporting items available to price.");
        return;
      }
      const cleaned = pricingDrafts.map((row) => ({
        line_id: row.line_id,
        product_name: row.product_name,
        qty: Number(row.qty) || 1,
        unit_price: Number(row.unit_price),
      }));
      for (const row of cleaned) {
        if (!Number.isFinite(row.unit_price) || row.unit_price < 0) {
          setDecideError(`Enter a valid unit purchase for "${row.product_name}".`);
          return;
        }
      }
      supportingPayload = cleaned.map((row) => ({
        ...row,
        qty: Number(row.qty.toFixed(4)),
        unit_price: Number(row.unit_price.toFixed(2)),
      }));
    }
    let servicePlanPayload:
      | {
        rate_contract_id: string;
        projected_visits: number;
        consumables_amount?: number;
        description?: string | null;
      }
      | undefined;
    if (decision.outcome === "approved" && action === SERVICE_VISITS_ACTION) {
      if (!serviceContractId) {
        setDecideError("Select a rate contract.");
        return;
      }
      const projected = Math.floor(Number(serviceProjected) || 0);
      if (projected < 1) {
        setDecideError("Projected visits must be at least 1.");
        return;
      }
      const consumables = Number(serviceConsumables || 0);
      if (!Number.isFinite(consumables) || consumables < 0) {
        setDecideError("Enter a valid consumables amount.");
        return;
      }
      servicePlanPayload = {
        rate_contract_id: serviceContractId,
        projected_visits: projected,
        consumables_amount: Number(consumables.toFixed(2)),
        description: serviceDescription.trim() || null,
      };
    }
    if (
      decision.outcome === "approved" &&
      action &&
      ATTACHMENT_ACTIONS.has(action) &&
      !attachmentFile
    ) {
      setDecideError("Upload the required file to complete this task.");
      return;
    }

    setDeciding(true);
    setDecideError(null);
    try {
      const extras: {
        freight?: number;
        freight_medium?: string;
        freight_weight_kg?: number;
        freight_insurance?: boolean;
        supporting_items?: typeof supportingPayload;
        service_plan?: typeof servicePlanPayload;
        file_name?: string;
        content_base64?: string;
        content_type?: string;
      } = {};
      if (decision.outcome === "approved" && action === FREIGHT_ACTION) {
        extras.freight = Number(Number(freightAmount).toFixed(2));
        extras.freight_medium = freightMedium;
        if (freightWeightKg.trim()) {
          extras.freight_weight_kg = Number(freightWeightKg);
        }
        extras.freight_insurance = freightInsurance;
      }
      if (
        decision.outcome === "approved" &&
        (action === SUPPORTING_ITEMS_ACTION || action === PRICE_SUPPORTING_ACTION) &&
        supportingPayload
      ) {
        extras.supporting_items = supportingPayload;
      }
      if (decision.outcome === "approved" && action === SERVICE_VISITS_ACTION && servicePlanPayload) {
        extras.service_plan = servicePlanPayload;
      }
      if (decision.outcome === "approved" && action && ATTACHMENT_ACTIONS.has(action) && attachmentFile) {
        extras.file_name = attachmentFile.name;
        extras.content_type = attachmentFile.type || "application/octet-stream";
        extras.content_base64 = await fileToBase64(attachmentFile);
      }
      await decideMyJob(
        decision.task.id,
        decision.outcome,
        remark.trim() || undefined,
        Object.keys(extras).length > 0 ? extras : undefined,
      );
      const completedTask = decision.task;
      const completedAction = completedTask.action;
      const completedOutcome = decision.outcome;
      setDecision(null);

      // Lead BOQ/SOW attach auto-converts — open opportunity Transitions next.
      if (
        completedOutcome === "approved" &&
        completedTask.entity_type === "lead" &&
        completedAction &&
        ATTACHMENT_ACTIONS.has(completedAction)
      ) {
        const lead = await getSalesLead(completedTask.entity_id).catch(() => null);
        if (lead?.converted_opportunity_id) {
          router.push(`/crm/opportunities/${lead.converted_opportunity_id}`);
          return;
        }
      }

      await load();
    } catch (err) {
      setDecideError(err instanceof ApiClientError ? err.message : "Failed to record decision");
    } finally {
      setDeciding(false);
    }
  }

  const sorted = useMemo(
    () =>
      sortRows(rows, sortBy, sortDir, {
        title: (t) => t.title,
        created_at: (t) => t.created_at ?? "",
      }),
    [rows, sortBy, sortDir],
  );

  return (
    <CrmPage>
      {!embedded ? (
        <PageHeader
          title="My Jobs"
        />
      ) : null}

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <CrmListToolbar
          title="Tasks"
          icon={Briefcase}
          count={sorted.length}
          countLabel="open"
        />

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className={CRM_TABLE_HEAD_ROW}>
                <CrmSortableTh
                  label="Task"
                  sortKey="title"
                  activeKey={sortBy}
                  dir={sortDir}
                  onSort={onSort}
                />
                <CrmSortableTh
                  label="Created"
                  sortKey="created_at"
                  activeKey={sortBy}
                  dir={sortDir}
                  onSort={onSort}
                  className="w-[140px]"
                />
                <th className="w-[320px] px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                    Loading tasks…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                    No tasks found.
                  </td>
                </tr>
              ) : (
                sorted.map((task) => {
                  const poDocs = needsCustomerPoDownload(task)
                    ? poDocsByTask[task.id]
                    : undefined;
                  const docApproval = isDocApprovalTask(task)
                    ? docApprovalByTask[task.id]
                    : undefined;
                  const quoteDocKey = `${task.id}-quote`;
                  const poDocKey = `${task.id}-po`;
                  const docKey = `${task.id}-doc`;
                  return (
                    <tr key={task.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                      <td className="px-3 py-2.5 align-middle">
                        <Link
                          href={myJobDetailHref(task)}
                          className="cursor-pointer font-medium text-foreground transition-colors duration-200 hover:text-primary hover:underline"
                        >
                          {task.title}
                        </Link>
                        <SlaLine task={task} now={loadedAt} />
                      </td>
                      <td className="px-3 py-2.5 align-middle whitespace-nowrap text-muted-foreground">
                        {task.created_at ? shortTime(task.created_at) : "-"}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        {task.status === "pending" ? (
                          <div className="flex flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap">
                            {task.entity_type === "quote" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={downloadingQuoteId === task.id}
                                className="cursor-pointer"
                                onClick={() => void downloadQuotePdf(task)}
                              >
                                <Download className="size-3.5" />
                                {downloadingQuoteId === task.id ? "PDF…" : "PDF"}
                              </Button>
                            ) : null}
                            {task.entity_type === "ovf" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={downloadingOvfId === task.id}
                                title="Download OVF print PDF"
                                className="cursor-pointer"
                                onClick={() => void downloadOvfPdf(task)}
                              >
                                <Download className="size-3.5" />
                                {downloadingOvfId === task.id ? "PDF…" : "PDF"}
                              </Button>
                            ) : null}
                            {isPoApprovalTask(task) ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={!poDocs?.quotePrint || downloadingDocKey === quoteDocKey}
                                  title={
                                    poDocs?.quotePrint
                                      ? poDocs.quotePrint.file_name
                                      : "Accepted quote PDF not attached yet"
                                  }
                                  className="cursor-pointer"
                                  onClick={() => void downloadPoApprovalDoc(task, "quote")}
                                >
                                  <Download className="size-3.5" />
                                  {downloadingDocKey === quoteDocKey ? "Quote…" : "Quote"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={!poDocs?.customerPo || downloadingDocKey === poDocKey}
                                  title={
                                    poDocs?.customerPo
                                      ? poDocs.customerPo.file_name
                                      : "Customer PO not attached yet"
                                  }
                                  className="cursor-pointer"
                                  onClick={() => void downloadPoApprovalDoc(task, "po")}
                                >
                                  <Download className="size-3.5" />
                                  {downloadingDocKey === poDocKey ? "PO…" : "PO"}
                                </Button>
                              </>
                            ) : null}
                            {task.action === FREIGHT_ACTION ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!poDocs?.customerPo || downloadingDocKey === poDocKey}
                                title={
                                  poDocs?.customerPo
                                    ? poDocs.customerPo.file_name
                                    : "Customer PO not attached yet"
                                }
                                className="cursor-pointer"
                                onClick={() => void downloadPoApprovalDoc(task, "po")}
                              >
                                <Download className="size-3.5" />
                                {downloadingDocKey === poDocKey ? "PO…" : "PO"}
                              </Button>
                            ) : null}
                            {isDocApprovalTask(task) ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!docApproval?.attachment || downloadingDocKey === docKey}
                                title={
                                  docApproval?.attachment
                                    ? docApproval.attachment.file_name
                                    : `${docApproval?.label || "Document"} file not attached yet`
                                }
                                className="cursor-pointer"
                                onClick={() => void downloadDocApprovalFile(task)}
                              >
                                <Download className="size-3.5" />
                                {downloadingDocKey === docKey
                                  ? "File…"
                                  : docApproval?.label || "File"}
                              </Button>
                            ) : null}
                            {task.action && ATTACHMENT_ACTIONS.has(task.action) && !task.responded_at ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={responding}
                                  className="cursor-pointer"
                                  onClick={() => void respond(task, true)}
                                >
                                  Can submit
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={responding}
                                  className="cursor-pointer"
                                  onClick={() => {
                                    setCannotSubmitTask(task);
                                    setCannotReason("");
                                    setRespondError(null);
                                  }}
                                >
                                  Can&apos;t submit
                                </Button>
                              </>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              className="cursor-pointer"
                              onClick={() => openDecision(task, "approved")}
                            >
                              <Check className="size-3.5" /> {approveLabel(task)}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="cursor-pointer"
                              onClick={() => openDecision(task, "rejected")}
                            >
                              <X className="size-3.5" /> Reject
                            </Button>
                          </div>
                        ) : task.entity_type === "quote" ? (
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={downloadingQuoteId === task.id}
                              className="cursor-pointer"
                              onClick={() => void downloadQuotePdf(task)}
                            >
                              <Download className="size-3.5" />
                              {downloadingQuoteId === task.id ? "PDF…" : "PDF"}
                            </Button>
                          </div>
                        ) : task.entity_type === "ovf" ? (
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={downloadingOvfId === task.id}
                              title="Download OVF print PDF"
                              className="cursor-pointer"
                              onClick={() => void downloadOvfPdf(task)}
                            >
                              <Download className="size-3.5" />
                              {downloadingOvfId === task.id ? "PDF…" : "PDF"}
                            </Button>
                          </div>
                        ) : (
                          <span className="block text-right text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CrmListPanel>

      <ConfirmDialog
        open={Boolean(decision)}
        title={
          decision?.outcome === "approved"
            ? decision.task.action === FREIGHT_ACTION
              ? "Submit freight"
              : decision.task.action === SUPPORTING_ITEMS_ACTION
                ? "Submit supporting items"
                : decision.task.action === SERVICE_VISITS_ACTION
                  ? "Submit service visit plan"
                  : decision.task.action && ATTACHMENT_ACTIONS.has(decision.task.action)
                    ? "Submit attachment"
                    : "Approve task"
            : "Reject task"
        }
        description={decision ? decision.task.title : undefined}
        tone={decision?.outcome === "rejected" ? "destructive" : "default"}
        confirmLabel={
          decision?.outcome === "approved"
            ? decision.task.action === FREIGHT_ACTION
              ? "Submit freight"
              : decision.task.action === SUPPORTING_ITEMS_ACTION
                ? "Submit items"
                : decision.task.action === PRICE_SUPPORTING_ACTION
                  ? "Submit prices"
                  : decision.task.action === SERVICE_VISITS_ACTION
                    ? "Submit plan"
                    : decision.task.action && ATTACHMENT_ACTIONS.has(decision.task.action)
                      ? "Submit file"
                      : "Approve"
            : "Reject"
        }
        busy={deciding}
        contentClassName={
          decision?.outcome === "approved" &&
            (decision.task.action === SUPPORTING_ITEMS_ACTION ||
              decision.task.action === PRICE_SUPPORTING_ACTION ||
              decision.task.action === SERVICE_VISITS_ACTION)
            ? "max-w-3xl"
            : "max-w-lg"
        }
        onCancel={() => !deciding && setDecision(null)}
        onConfirm={() => void submitDecision()}
      >
        {(decision?.task.action === FREIGHT_ACTION) &&
          decision.task.remarks ? (
          <pre className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-sans text-xs whitespace-pre-wrap text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {decision.task.remarks}
          </pre>
        ) : null}
        {decision?.outcome === "approved" && decision.task.action === FREIGHT_ACTION ? (
          <div className="mb-3 space-y-3">
            <FinanceField label="Freight Charges (₹) *" className="space-y-2">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={freightAmount}
                onChange={(e) => setFreightAmount(e.target.value)}
                placeholder="0.00"
                className="h-9"
              />
            </FinanceField>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <FinanceField label="Medium *" className="space-y-2">
                <select
                  aria-label="Freight medium"
                  className={SELECT_CLASS}
                  value={freightMedium}
                  onChange={(e) => setFreightMedium(e.target.value)}
                >
                  {FREIGHT_MEDIUMS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </FinanceField>
              <FinanceField label="Weight (kg)" className="space-y-2">
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  value={freightWeightKg}
                  onChange={(e) => setFreightWeightKg(e.target.value)}
                  placeholder="0"
                  className="h-9"
                />
              </FinanceField>
              <label className="col-span-2 flex cursor-pointer items-end gap-2 pb-2 text-xs sm:col-span-1">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer accent-primary"
                  checked={freightInsurance}
                  onChange={(e) => setFreightInsurance(e.target.checked)}
                />
                Insure shipment
              </label>
            </div>
          </div>
        ) : null}
        {decision?.outcome === "approved" && decision.task.action === SUPPORTING_ITEMS_ACTION ? (
          <div className="mb-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Add items outside the main customer PO (cables, SFPs, etc.). SCM will price them
              separately from the OVF page.
            </p>
            <div className="rounded-md border border-border/70">
              <table className="w-full table-fixed text-left text-xs">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/50 text-[11px] font-medium text-muted-foreground uppercase">
                    <th className="w-[42%] px-3 py-2">Item *</th>
                    <th className="w-[14%] px-3 py-2">Qty *</th>
                    <th className="w-[36%] px-3 py-2">Distributor</th>
                    <th className="w-[8%] px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {supportingDrafts.map((row) => (
                    <tr key={row.key} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2">
                        <Input
                          value={row.product_name}
                          onChange={(e) =>
                            setSupportingDrafts((rows) =>
                              rows.map((r) =>
                                r.key === row.key ? { ...r, product_name: e.target.value } : r,
                              ),
                            )
                          }
                          placeholder="Item name"
                          className="h-8 w-full"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          value={row.qty}
                          onChange={(e) =>
                            setSupportingDrafts((rows) =>
                              rows.map((r) => (r.key === row.key ? { ...r, qty: e.target.value } : r)),
                            )
                          }
                          className="h-8 w-full"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={row.distributor_name}
                          onChange={(e) =>
                            setSupportingDrafts((rows) =>
                              rows.map((r) =>
                                r.key === row.key ? { ...r, distributor_name: e.target.value } : r,
                              ),
                            )
                          }
                          placeholder="Optional"
                          className="h-8 w-full"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer px-2"
                          disabled={supportingDrafts.length <= 1}
                          onClick={() =>
                            setSupportingDrafts((rows) => rows.filter((r) => r.key !== row.key))
                          }
                        >
                          <X className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => setSupportingDrafts((rows) => [...rows, blankSupportingDraft()])}
            >
              Add row
            </Button>
            <FinanceField label="Description" className="space-y-2">
              <FinanceTextarea
                value={supportingDescription}
                onChange={(e) => setSupportingDescription(e.target.value)}
                placeholder="Optional note about these supporting items…"
                className="min-h-[72px] rounded-lg border-slate-200 bg-white text-[13px] shadow-none placeholder:text-slate-400 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-200/80"
              />
            </FinanceField>
          </div>
        ) : null}
        {decision?.outcome === "approved" && decision.task.action === PRICE_SUPPORTING_ACTION ? (
          <div className="mb-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Enter unit purchase (₹) for each supporting item Ops submitted.
            </p>
            {loadingPricing ? (
              <p className="text-xs text-muted-foreground">Loading items…</p>
            ) : (
              <div className="rounded-md border border-border/70">
                <table className="w-full table-fixed text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/70 bg-muted/50 text-[11px] font-medium text-muted-foreground uppercase">
                      <th className="w-[44%] px-3 py-2">Item</th>
                      <th className="w-[14%] px-3 py-2">Qty</th>
                      <th className="w-[42%] px-3 py-2">Unit (₹) *</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingDrafts.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                          No supporting items found.
                        </td>
                      </tr>
                    ) : (
                      pricingDrafts.map((row) => (
                        <tr key={row.line_id} className="border-b border-border/40 last:border-0">
                          <td className="px-3 py-2 font-medium text-foreground">{row.product_name}</td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.qty}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={row.unit_price}
                              onChange={(e) =>
                                setPricingDrafts((rows) =>
                                  rows.map((r) =>
                                    r.line_id === row.line_id
                                      ? { ...r, unit_price: e.target.value }
                                      : r,
                                  ),
                                )
                              }
                              placeholder="0.00"
                              className="h-8 w-full"
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
        {decision?.outcome === "approved" && decision.task.action === SERVICE_VISITS_ACTION ? (
          <div className="mb-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Pick a rate contract and projected visits. Planned cost goes to Additional Charges on the
              OVF (not Vendor PO).
            </p>
            {serviceContracts !== null && serviceContracts.length === 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                No active rate contracts. SCM adds them under Procurement → Service Contracts.
              </p>
            ) : null}
            <FinanceField label="Rate contract *" className="space-y-2">
              <select
                aria-label="Rate contract"
                className={SELECT_CLASS}
                value={serviceContractId}
                onChange={(e) => setServiceContractId(e.target.value)}
              >
                <option value="">Select…</option>
                {(serviceContracts ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.vendor_name} · {serviceTypeLabel(c.service_type)} ·{" "}
                    {formatInrPrecise(c.rate_per_visit)}/visit
                    {c.region ? ` · ${c.region}` : ""}
                  </option>
                ))}
              </select>
            </FinanceField>
            <div className="grid grid-cols-2 gap-2">
              <FinanceField label="Projected visits *" className="space-y-2">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={serviceProjected}
                  onChange={(e) => setServiceProjected(e.target.value)}
                  className="h-9"
                />
              </FinanceField>
              <FinanceField label="Consumables (₹)" className="space-y-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={serviceConsumables}
                  onChange={(e) => setServiceConsumables(e.target.value)}
                  className="h-9"
                />
              </FinanceField>
            </div>
            <FinanceField label="Scope / notes" className="space-y-2">
              <Input
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                placeholder="Install + 1 revisit per site…"
                className="h-9"
              />
            </FinanceField>
            {serviceContractId && Math.floor(Number(serviceProjected) || 0) > 0
              ? (() => {
                const contract = (serviceContracts ?? []).find((c) => c.id === serviceContractId);
                if (!contract) return null;
                const projected = Math.floor(Number(serviceProjected) || 0);
                const preview =
                  projected * Number(contract.rate_per_visit) + (Number(serviceConsumables) || 0);
                return (
                  <p className="text-xs text-muted-foreground">
                    Planned cost:{" "}
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatInrPrecise(preview)}
                    </span>
                  </p>
                );
              })()
              : null}
          </div>
        ) : null}
        {decision?.outcome === "approved" &&
          decision.task.action &&
          ATTACHMENT_ACTIONS.has(decision.task.action) ? (
          <FinanceField
            label={
              decision.task.action === "provide_boq_attachment" ? "BOQ file *" : "SOW file *"
            }
            className="mb-3 space-y-2"
          >
            <Input
              type="file"
              className="h-9 cursor-pointer"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
            />
          </FinanceField>
        ) : null}
        {decision?.outcome === "rejected" ||
          decision?.task.action !== SUPPORTING_ITEMS_ACTION ? (
          <FinanceField
            label={decision?.outcome === "rejected" ? "Remark *" : "Remark"}
            className="space-y-2"
          >
            <FinanceTextarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Add a remark…"
              className="min-h-[88px] rounded-lg border-slate-200 bg-white text-[13px] shadow-none placeholder:text-slate-400 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-200/80"
            />
          </FinanceField>
        ) : null}
        {decideError ? <p className="mt-3 text-xs text-destructive">{decideError}</p> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(cannotSubmitTask)}
        title="Can't submit this document"
        description={
          cannotSubmitTask
            ? `${cannotSubmitTask.title} - your manager and the salesperson are told immediately.`
            : undefined
        }
        confirmLabel="Send reason"
        busy={responding}
        contentClassName="max-w-lg"
        onCancel={() => !responding && setCannotSubmitTask(null)}
        onConfirm={() => {
          if (!cannotSubmitTask) return;
          if (!cannotReason.trim()) {
            setRespondError("Say why - e.g. call not aligned yet, questionnaire unanswered.");
            return;
          }
          void respond(cannotSubmitTask, false, cannotReason.trim());
        }}
      >
        <FinanceField label="Reason *" className="space-y-2">
          <FinanceTextarea
            value={cannotReason}
            onChange={(e) => setCannotReason(e.target.value)}
            placeholder="Customer call not aligned yet / throughput and application details missing…"
            className="min-h-[88px] rounded-lg border-slate-200 bg-white text-[13px] shadow-none placeholder:text-slate-400 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-200/80"
          />
        </FinanceField>
        {respondError ? <p className="mt-3 text-xs text-destructive">{respondError}</p> : null}
      </ConfirmDialog>
    </CrmPage>
  );
}
