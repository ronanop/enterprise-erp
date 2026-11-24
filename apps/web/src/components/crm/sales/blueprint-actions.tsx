"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Paperclip } from "lucide-react";

import { ApproverMultiSelect } from "@/components/crm/sales/approver-multi-select";
import {
  RequiredFieldsDialog,
  missingRequiredMessage,
} from "@/components/crm/sales/required-fields-dialog";
import { SalesStageBadge } from "@/components/crm/sales/sales-stage-badge";
import { FinanceField, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import { extractCustomerPo, type CustomerPoExtract } from "@/services/crm-deal-controls-service";
import { fileToBase64, getNextDealRegNumber, listApprovalStepOwners, listCrmApprovalUsers, type BlueprintActionPayload } from "@/services/sales-crm-service";

type FieldType =
  | "text"
  | "textarea"
  | "date"
  | "number"
  | "file"
  | "checkbox"
  | "approver"
  | "approver_stage";

/**
 * Stages of the customer PO validation chain, in the order they run.
 * ``operations`` is not an approval - it is the team handed the services
 * scope the moment Management approves.
 */
type PoStage = "finance" | "legal" | "management" | "operations";

type FieldConfig = {
  key:
  | "remark"
  | "remarks"
  | "reason"
  | "deal_reg_number"
  | "valid_until"
  | "deal_won_amount"
  | "onboarding_date"
  | "file_name"
  | "assigned_user_id"
  | "finance_user_ids"
  | "legal_user_ids"
  | "management_user_ids"
  | "operations_user_ids"
  | "terms_accepted";
  label: string;
  type: FieldType;
  required?: boolean;
  readOnly?: boolean;
  stage?: PoStage;
};

type ActionConfig = {
  label: string;
  tone?: "default" | "destructive";
  description?: string;
  fields: FieldConfig[];
};

const REMARK_FIELD_ALT: FieldConfig = { key: "remark", label: "Remark", type: "textarea" };

const SEND_APPROVAL_ACTIONS = new Set([
  "send_boq_approval",
  "send_sow_approval",
  "send_boq_for_attachment",
  "send_sow_for_attachment",
  "send_po_approval",
  "send_for_approval",
  "send_cloud_discount_approval",
]);

const APPROVAL_DIALOG_FIELDS: FieldConfig[] = [
  { key: "assigned_user_id", label: "Approvers", type: "approver", required: true },
  { key: "remarks", label: "Remarks", type: "textarea", required: true },
];

const APPROVAL_ADMIN_NOTE =
  "A copy is also sent to tenant admins. Any selected approver or an admin can decide in My Jobs.";

// The customer PO is validated in sequence: Finance checks tax/GST and the
// commercials, Legal checks terms & conditions, then Management approves.
// Each stage's My Jobs task is raised only once the previous one is approved.
const PO_APPROVAL_DIALOG_FIELDS: FieldConfig[] = [
  {
    key: "terms_accepted",
    label: "I have checked and verified all terms & conditions of this customer PO",
    type: "checkbox",
    required: true,
  },
  { key: "remarks", label: "Remarks", type: "textarea", required: true },
];

const PO_STAGE_STEP_KEYS: Record<PoStage, string> = {
  finance: "po_finance",
  legal: "po_legal",
  management: "po_management",
  operations: "service_scope",
};

const EMPTY_PO_STAGE_APPROVERS: Record<PoStage, string[]> = {
  finance: [],
  legal: [],
  management: [],
  operations: [],
};

const ACTION_CONFIG: Record<string, ActionConfig> = {
  convert: {
    label: "Convert to Opportunity",
    fields: [],
    description: "Converts immediately using lead defaults.",
  },
  lost: {
    label: "Deal Lost",
    tone: "destructive",
    fields: [{ key: "reason", label: "Lost reason", type: "textarea", required: true }],
    description: "Available until the deal is Won.",
  },
  attach_boq: {
    label: "Attach BOQ",
    fields: [{ key: "file_name", label: "BOQ files", type: "file", required: true }],
  },
  attach_contract: {
    label: "Attach Contract",
    fields: [{ key: "file_name", label: "Contract file", type: "file", required: true }],
    description: "Optional for cloud deals - customer contract or invoice evidence.",
  },
  send_cloud_discount_approval: {
    label: "Send Cloud Discount for Approval",
    fields: APPROVAL_DIALOG_FIELDS,
    description: `Routes MRR, ARR, customer discount, and profitability to Management via My Jobs. ${APPROVAL_ADMIN_NOTE}`,
  },
  skip_map_oem_quote: {
    label: "Skip MAP OEM Quote",
    fields: [],
    description: "Continue to onboarding when migration quote is not available yet.",
  },
  mark_onboarding_done: {
    label: "Mark Onboarding Done",
    fields: [
      {
        key: "onboarding_date",
        label: "Date of onboarding",
        type: "date",
        required: true,
      },
    ],
    description:
      "Customer is onboarded on the payer account - closes the opportunity for sales; billing continues monthly.",
  },
  send_boq_approval: {
    label: "Send BOQ for Approval",
    fields: APPROVAL_DIALOG_FIELDS,
    description: `Routes the attached BOQ to the Pre-sales team via My Jobs. ${APPROVAL_ADMIN_NOTE}`,
  },
  send_boq_for_attachment: {
    label: "Send BOQ for Attachment",
    fields: APPROVAL_DIALOG_FIELDS,
    description: `Asks selected users to attach the BOQ via My Jobs. ${APPROVAL_ADMIN_NOTE}`,
  },
  attach_sow: {
    label: "Attach SOW",
    fields: [{ key: "file_name", label: "SOW files", type: "file", required: true }],
  },
  send_sow_approval: {
    label: "Send SOW for Approval",
    fields: APPROVAL_DIALOG_FIELDS,
    description: `Routes the attached SOW to the Pre-sales team via My Jobs. ${APPROVAL_ADMIN_NOTE}`,
  },
  send_sow_for_attachment: {
    label: "Send SOW for Attachment",
    fields: APPROVAL_DIALOG_FIELDS,
    description: `Asks selected users to attach the SOW via My Jobs. ${APPROVAL_ADMIN_NOTE}`,
  },
  skip_sow: { label: "Skip SOW", fields: [] },
  deal_reg: {
    label: "Deal Registration",
    fields: [
      {
        key: "deal_reg_number",
        label: "DR Number",
        type: "text",
        required: true,
        readOnly: true,
      },
    ],
    description: "DR Number is auto-generated in series. Confirm to register this deal.",
  },
  attach_oem_quote: {
    label: "Attach Vendor Quotation",
    fields: [{ key: "file_name", label: "Vendor quotation file", type: "file", required: true }],
    description:
      "Upload an Outlook email export only (.msg on Windows, .eml on Mac / New Outlook / web).",
  },
  attach_po: {
    label: "Attach Customer PO",
    description:
      "Upload the customer PO and send it for Finance → Legal → Management approval in one step.",
    fields: [
      { key: "file_name", label: "Customer PO file", type: "file", required: true },
      ...PO_APPROVAL_DIALOG_FIELDS,
    ],
  },
  send_po_approval: {
    label: "Re-submit PO for Approval",
    fields: PO_APPROVAL_DIALOG_FIELDS,
  },
  send_for_approval: {
    label: "Send for Approval",
    fields: APPROVAL_DIALOG_FIELDS,
    description: `Routes this record for approval via My Jobs. ${APPROVAL_ADMIN_NOTE}`,
  },
  approve_internally: {
    label: "Approve Internally",
    fields: [REMARK_FIELD_ALT],
  },
  reject_internally: {
    label: "Reject",
    fields: [{ key: "remark", label: "Rejection remark", type: "textarea", required: true }],
  },
  send_to_customer: {
    label: "Quotation Sent to Customer",
    fields: [],
    description: "Marks this quote as sent to the customer.",
  },
  negotiate: {
    label: "Create Quote Version",
    fields: [REMARK_FIELD_ALT],
    description: "Freezes this version and opens the next quote draft for re-approval.",
  },
  follow_up: { label: "Move to Follow-up", fields: [REMARK_FIELD_ALT] },
  accept: {
    label: "Deal Won",
    fields: [REMARK_FIELD_ALT],
    description: "Marks this quote as accepted and the deal as won.",
  },
  approve: { label: "Approve", fields: [REMARK_FIELD_ALT] },
  reject: {
    label: "Reject",
    fields: [{ key: "remark", label: "Rejection remark", type: "textarea", required: true }],
  },
  share_to_scm: { label: "Share to SCM", fields: [] },
  deal_won: {
    label: "Mark Deal Won",
    fields: [{ key: "deal_won_amount", label: "Deal Won Amount (₹)", type: "number", required: true }],
  },
  create_quote: {
    label: "Create Quote",
    fields: [],
    description: "Open the quote editor for this opportunity.",
  },
  create_ovf: {
    label: "Create OVF",
    fields: [],
    description:
      "Create one order value form for this opportunity (combines all accepted split quotes).",
  },
};

const BLUE_ACTION_BUTTON_CLASS =
  "border-blue-900 bg-blue-800 font-bold text-white hover:bg-blue-900 hover:text-white dark:border-blue-700 dark:bg-blue-800 dark:text-white dark:hover:bg-blue-700";

const WON_BUTTON_CLASS =
  "border-emerald-800 bg-emerald-700 font-bold text-white hover:bg-emerald-800 hover:text-white dark:border-emerald-600 dark:bg-emerald-700 dark:text-white dark:hover:bg-emerald-600";

const LOST_BUTTON_CLASS =
  "border-red-800 bg-red-700 font-bold text-white hover:bg-red-800 hover:text-white dark:border-red-600 dark:bg-red-700 dark:text-white dark:hover:bg-red-600";

const ATTACH_ACTIONS = new Set([
  "attach_boq",
  "attach_sow",
  "attach_oem_quote",
  "attach_po",
  "attach_contract",
]);

const OEM_QUOTE_ACTIONS = new Set(["attach_oem_quote"]);

/** Outlook single-message exports — Windows (.msg) and Mac/New Outlook/OWA (.eml). */
const OUTLOOK_MAIL_EXPORT_EXTENSIONS = new Set([".msg", ".eml"]);
const OUTLOOK_MAIL_ACCEPT =
  ".msg,.eml,message/rfc822,application/vnd.ms-outlook";
const OUTLOOK_MAIL_HINT =
  "Vendor quotation must be an Outlook email export (.msg or .eml).";

function isOutlookMailExportFile(file: File): boolean {
  const name = file.name.trim().toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  return OUTLOOK_MAIL_EXPORT_EXTENSIONS.has(name.slice(dot));
}

const QUOTE_FLOW_ACTIONS = new Set(["send_to_customer", "negotiate", "follow_up"]);

const WON_ACTIONS = new Set(["accept", "deal_won"]);

const PRIMARY_FLOW_ACTIONS = new Set([
  "convert",
  "create_quote",
  "create_ovf",
  "share_to_scm",
]);

const APPROVAL_ACTIONS = new Set([
  "send_boq_approval",
  "send_sow_approval",
  "send_boq_for_attachment",
  "send_sow_for_attachment",
  "send_po_approval",
  "send_for_approval",
  "send_cloud_discount_approval",
]);

const PINNED_STEP_KEYS = new Set([
  "quote_send_for_approval",
  "ovf_send_for_approval",
  "po_finance",
]);

function stepKeyForAction(
  action: string,
  entityType?: "quote" | "ovf" | "opportunity",
): string | null {
  if (action === "send_for_approval") {
    if (entityType === "ovf") return "ovf_send_for_approval";
    return "quote_send_for_approval";
  }
  if (action === "send_po_approval") return "po_finance";
  if (action === "send_cloud_discount_approval") return "cloud_discount";
  if (action === "send_boq_for_attachment") return "boq_attachment";
  if (action === "send_sow_for_attachment") return "sow_attachment";
  if (action === "send_boq_approval") return "boq_approval";
  if (action === "send_sow_approval") return "sow_approval";
  return null;
}

function mergeApproverSelection(
  next: string[],
  pinnedIds: string[],
): string[] {
  const merged = new Set(next);
  for (const id of pinnedIds) merged.add(id);
  return [...merged];
}

type Props = {
  allowedActions: string[];
  locked?: boolean;
  /** Human-readable current blueprint stage (28-stage sales flow). */
  currentStageLabel?: string | null;
  /** Show a persistent light-green Deal Won badge beside the current state. */
  showDealWonBadge?: boolean;
  /** Opportunity id — used to auto-generate Deal Registration (DR) numbers. */
  opportunityId?: string;
  /** Distinguishes quote vs OVF for send_for_approval step-owner defaults. */
  entityType?: "quote" | "ovf" | "opportunity";
  /**
   * When Services was selected on the lead, SOW attachment/approval is locked to
   * this user (opportunity owner login) — not Default task owners.
   */
  servicesSowOwnerUserId?: string | null;
  /** Actions rendered elsewhere by the parent (e.g. gated Create Quote / Create OVF CTAs). */
  excludeActions?: string[];
  actionLabelOverrides?: Partial<Record<string, string>>;
  actionDispatchOverrides?: Partial<Record<string, string>>;
  defaultValues?: Partial<Record<string, string | number | null>>;
  onAction: (action: string, payload: BlueprintActionPayload) => Promise<void>;
  disabled?: boolean;
};

export function BlueprintActions({
  allowedActions,
  locked,
  currentStageLabel,
  showDealWonBadge = false,
  opportunityId,
  entityType,
  servicesSowOwnerUserId = null,
  excludeActions,
  actionLabelOverrides,
  actionDispatchOverrides,
  defaultValues,
  onAction,
  disabled,
}: Props) {
  const exclude = new Set(excludeActions ?? []);
  const visibleActions = allowedActions.filter((a) => !exclude.has(a));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [poStageApprovers, setPoStageApprovers] =
    useState<Record<PoStage, string[]>>(EMPTY_PO_STAGE_APPROVERS);
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");
  const [mandateFields, setMandateFields] = useState<string[]>([]);
  const [approvalUsers, setApprovalUsers] = useState<
    { id: string; label: string; name: string; email: string }[]
  >([]);
  const [stepOwnerIds, setStepOwnerIds] = useState<Record<string, string[]>>({});
  const [poExtract, setPoExtract] = useState<CustomerPoExtract | null>(null);
  const [poExtracting, setPoExtracting] = useState(false);

  async function previewCustomerPo(upload: File | undefined) {
    setPoExtract(null);
    if (!upload || !opportunityId) return;
    setPoExtracting(true);
    try {
      setPoExtract(
        await extractCustomerPo(opportunityId, {
          file_name: upload.name,
          content_base64: await fileToBase64(upload),
        }),
      );
    } catch {
      setPoExtract(null);
    } finally {
      setPoExtracting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listCrmApprovalUsers(), listApprovalStepOwners().catch(() => [])])
      .then(([rows, ownerGroups]) => {
        if (cancelled) return;
        const byId = new Map<string, { id: string; label: string; name: string; email: string }>();
        for (const row of rows) {
          const id = String(row.id);
          byId.set(id, {
            id,
            name: row.display_name,
            email: row.email,
            label: `${row.display_name} (${row.email})`,
          });
        }
        // Merge configured step owners so pinned defaults always resolve to names.
        for (const group of ownerGroups) {
          for (const owner of group.owners) {
            const id = String(owner.user_id);
            if (!byId.has(id)) {
              byId.set(id, {
                id,
                name: owner.display_name,
                email: owner.email,
                label: owner.email
                  ? `${owner.display_name} (${owner.email})`
                  : owner.display_name,
              });
            }
          }
        }
        setApprovalUsers([...byId.values()].sort((a, b) => a.label.localeCompare(b.label)));
        setStepOwnerIds(
          Object.fromEntries(
            ownerGroups.map((group) => [
              group.step_key,
              group.owners.map((owner) => String(owner.user_id)),
            ]),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setApprovalUsers([]);
          setStepOwnerIds({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function resolveDefaultApproverIds(action: string): string[] {
    const key = stepKeyForAction(action, entityType);
    if (!key) return [];
    const configured = stepOwnerIds[key] ?? [];
    const known = new Set(approvalUsers.map((user) => String(user.id).toLowerCase()));
    return configured.filter((id) => known.has(String(id).toLowerCase()));
  }

  function resolvePinnedApproverIds(action: string): string[] {
    const key = stepKeyForAction(action, entityType);
    const sowOwner = (servicesSowOwnerUserId || "").trim();
    if (
      sowOwner &&
      (action === "send_sow_for_attachment" || action === "send_sow_approval")
    ) {
      return [sowOwner];
    }
    if (!key || !PINNED_STEP_KEYS.has(key)) return [];
    return resolveDefaultApproverIds(action);
  }

  function resolveDefaultApproverIdsForAction(action: string): string[] {
    const sowOwner = (servicesSowOwnerUserId || "").trim();
    if (
      sowOwner &&
      (action === "send_sow_for_attachment" || action === "send_sow_approval")
    ) {
      return [sowOwner];
    }
    return resolveDefaultApproverIds(action);
  }

  if (!currentStageLabel && !showDealWonBadge && visibleActions.length === 0) return null;

  function resolvePoStageApproversFromOwners(): Record<PoStage, string[]> {
    return {
      finance: stepOwnerIds[PO_STAGE_STEP_KEYS.finance] ?? [],
      legal: stepOwnerIds[PO_STAGE_STEP_KEYS.legal] ?? [],
      management: stepOwnerIds[PO_STAGE_STEP_KEYS.management] ?? [],
      operations: stepOwnerIds[PO_STAGE_STEP_KEYS.operations] ?? [],
    };
  }

  function resolveConfig(action: string): ActionConfig {
    const normalized =
      action === "create_ovf" || action.startsWith("create_ovf:") ? "create_ovf" : action;
    const base =
      ACTION_CONFIG[normalized] ?? {
        label: action.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        fields: [REMARK_FIELD_ALT],
      };
    if (action === "attach_po") {
      return {
        ...base,
        fields: [
          { key: "file_name", label: "Customer PO file", type: "file", required: true },
          ...PO_APPROVAL_DIALOG_FIELDS,
        ],
      };
    }
    if (action === "send_po_approval") {
      return { ...base, fields: PO_APPROVAL_DIALOG_FIELDS };
    }
    if (SEND_APPROVAL_ACTIONS.has(action)) {
      const sowLockedToOwner =
        Boolean((servicesSowOwnerUserId || "").trim()) &&
        (action === "send_sow_for_attachment" || action === "send_sow_approval");
      return {
        ...base,
        fields: APPROVAL_DIALOG_FIELDS,
        description: sowLockedToOwner
          ? "Services was selected on the lead — SOW is assigned only to the opportunity owner."
          : (base.description ?? APPROVAL_ADMIN_NOTE),
      };
    }
    return base;
  }

  async function runImmediate(action: string) {
    const dispatchAction = actionDispatchOverrides?.[action] ?? action;
    setBusy(true);
    setError(null);
    try {
      await onAction(dispatchAction, {});
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : `Failed to ${dispatchAction}`);
    } finally {
      setBusy(false);
    }
  }

  function openAction(action: string) {
    const config = resolveConfig(action);
    // No form fields → run immediately (e.g. send_to_customer, share_to_scm, convert).
    if (config.fields.length === 0) {
      void runImmediate(action);
      return;
    }
    const pinnedIds = resolvePinnedApproverIds(action);
    const defaultIds = resolveDefaultApproverIdsForAction(action);
    setActiveAction(action);
    setValues(
      Object.fromEntries(
        config.fields.flatMap((field) => {
          if (field.type === "approver") return [];
          const value = defaultValues?.[field.key];
          return value === null || value === undefined ? [] : [[field.key, String(value)]];
        }),
      ),
    );
    setApproverIds(mergeApproverSelection(defaultIds, pinnedIds));
    setPoStageApprovers(EMPTY_PO_STAGE_APPROVERS);
    setFile(null);
    setFiles([]);
    setPoExtract(null);
    setError(null);

    if (action === "deal_reg" && opportunityId) {
      setBusy(true);
      void getNextDealRegNumber(opportunityId)
        .then((number) => {
          setValues((prev) => ({ ...prev, deal_reg_number: number }));
        })
        .catch((err) => {
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to generate DR Number",
          );
        })
        .finally(() => setBusy(false));
    }
  }

  function close() {
    if (busy) return;
    setActiveAction(null);
    setValues({});
    setApproverIds([]);
    setPoStageApprovers(EMPTY_PO_STAGE_APPROVERS);
    setFile(null);
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setError(null);
  }

  async function confirm() {
    if (!activeAction) return;
    const config = resolveConfig(activeAction);
    const dispatchAction = actionDispatchOverrides?.[activeAction] ?? activeAction;
    const isMultiFile =
      dispatchAction === "attach_boq" ||
      dispatchAction === "attach_sow" ||
      dispatchAction === "attach_oem_quote" ||
      dispatchAction === "attach_po" ||
      dispatchAction === "attach_contract";
    const missing: string[] = [];
    for (const field of config.fields) {
      if (field.required && field.type === "approver") {
        if (approverIds.length === 0) missing.push(field.label);
        continue;
      }
      if (field.required && field.type === "checkbox") {
        if (values[field.key] !== "true") {
          missing.push("Confirm customer PO terms & conditions");
        }
        continue;
      }
      if (field.required && field.type !== "file" && !values[field.key]?.trim()) {
        missing.push(field.label);
        continue;
      }
      if (field.required && field.type === "file") {
        if (isMultiFile && files.length === 0) missing.push(field.label);
        if (!isMultiFile && !file) missing.push(field.label);
      }
    }
    if (missing.length > 0) {
      setMandateFields(missing);
      setMandateMessage(missingRequiredMessage(missing));
      setMandateOpen(true);
      return;
    }
    if (dispatchAction === "attach_oem_quote") {
      const uploadList = isMultiFile ? files : file ? [file] : [];
      const invalid = uploadList.filter((row) => !isOutlookMailExportFile(row));
      if (invalid.length > 0) {
        setError(OUTLOOK_MAIL_HINT);
        return;
      }
    }

    let resolvedPoStageOwners: Record<PoStage, string[]> | null = null;
    if (dispatchAction === "attach_po" || dispatchAction === "send_po_approval") {
      resolvedPoStageOwners = resolvePoStageApproversFromOwners();
      // Finance is raised immediately; later stages fall back to quote/admin owners on the API.
      if (resolvedPoStageOwners.finance.length === 0) {
        setError(
          "Configure Finance owners under CRM Users → Default task owners before sending the PO.",
        );
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const payloadBase: BlueprintActionPayload = {};
      for (const field of config.fields) {
        if (
          field.type === "file" ||
          field.type === "checkbox" ||
          field.type === "approver" ||
          field.type === "approver_stage"
        ) {
          continue;
        }
        const raw = values[field.key];
        if (!raw) continue;
        if (field.key === "deal_won_amount") payloadBase.deal_won_amount = Number(raw);
        else if (field.key === "valid_until") payloadBase.valid_until = raw;
        else if (field.key === "onboarding_date") payloadBase.onboarding_date = raw;
        else (payloadBase as Record<string, string>)[field.key] = raw;
      }
      if (approverIds.length > 0) {
        payloadBase.assigned_user_ids = approverIds;
        payloadBase.assigned_user_id = approverIds[0];
      }
      if (
        (dispatchAction === "attach_po" || dispatchAction === "send_po_approval") &&
        resolvedPoStageOwners
      ) {
        payloadBase.terms_accepted = values.terms_accepted === "true";
        payloadBase.finance_user_ids = resolvedPoStageOwners.finance;
        payloadBase.legal_user_ids = resolvedPoStageOwners.legal;
        payloadBase.management_user_ids = resolvedPoStageOwners.management;
        payloadBase.operations_user_ids = resolvedPoStageOwners.operations;
        // Only Finance is raised now; later stages are stored and raised as each approves.
        payloadBase.assigned_user_ids = resolvedPoStageOwners.finance;
        payloadBase.assigned_user_id = resolvedPoStageOwners.finance[0];
      }
      if (activeAction === "lost" && values.reason) {
        payloadBase.remark = values.reason;
      }
      const uploadList = isMultiFile ? files : file ? [file] : [];
      if (uploadList.length > 0) {
        for (const upload of uploadList) {
          await onAction(dispatchAction, {
            ...payloadBase,
            file_name: upload.name,
            content_type: upload.type || "application/octet-stream",
            content_base64: await fileToBase64(upload),
          });
        }
      } else {
        await onAction(dispatchAction, payloadBase);
      }
      close();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : `Failed to ${dispatchAction}`);
    } finally {
      setBusy(false);
    }
  }

  const activeConfig = activeAction ? resolveConfig(activeAction) : null;
  const activeLabel = activeAction
    ? (actionLabelOverrides?.[activeAction] ?? activeConfig?.label ?? "")
    : "";
  const activePinnedApproverIds = activeAction ? resolvePinnedApproverIds(activeAction) : [];
  const orderedActions = [...visibleActions].sort((a, b) => {
    const rank = (action: string) => {
      if (action === "send_sow_for_attachment") return 0;
      if (action === "send_boq_for_attachment") return 1;
      if (action === "attach_sow") return 2;
      if (action === "attach_boq") return 3;
      if (action === "send_boq_approval") return 4;
      if (action === "send_sow_approval") return 5;
      if (action === "deal_reg") return 6;
      if (action === "send_to_customer") return 7;
      if (action === "negotiate") return 8;
      if (action === "accept") return 9;
      if (action === "follow_up") return 10;
      if (action === "attach_po") return 11;
      if (action === "send_po_approval") return 11;
      if (action === "lost") return 20;
      return 15;
    };
    return rank(a) - rank(b);
  });

  const showTransitions = visibleActions.length > 0;

  return (
    <div className="space-y-2">
      {currentStageLabel || showDealWonBadge ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Current State
          </span>
          {currentStageLabel && currentStageLabel !== "Deal Won" ? (
            <SalesStageBadge label={currentStageLabel} />
          ) : null}
          {showDealWonBadge || currentStageLabel === "Deal Won" ? (
            <SalesStageBadge label="Deal Won" />
          ) : null}
        </div>
      ) : null}
      {showTransitions ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Transitions
            </span>
            {orderedActions.map((action, index) => {
              const config = resolveConfig(action);
              const label = actionLabelOverrides?.[action] ?? config.label;
              const isAttach = ATTACH_ACTIONS.has(action);
              const isApproval = APPROVAL_ACTIONS.has(action);
              const isLost = action === "lost";
              const isWon = WON_ACTIONS.has(action);
              const isOemQuote = OEM_QUOTE_ACTIONS.has(action);
              const isQuoteFlow = QUOTE_FLOW_ACTIONS.has(action);
              const isPrimaryFlow =
                PRIMARY_FLOW_ACTIONS.has(action) || action.startsWith("create_ovf:");
              const colorClass = isLost
                ? LOST_BUTTON_CLASS
                : isWon
                  ? WON_BUTTON_CLASS
                  : isAttach || isApproval || isOemQuote || isQuoteFlow || isPrimaryFlow
                    ? BLUE_ACTION_BUTTON_CLASS
                    : undefined;
              const variant = colorClass ? "outline" : config.tone === "destructive" ? "destructive" : "outline";
              return (
                <Fragment key={action}>
                  {action === "attach_boq" && orderedActions[index - 1] === "attach_sow" ? (
                    <span className="text-xs font-medium text-muted-foreground" aria-hidden="true">
                      or
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant={variant}
                    className={["cursor-pointer", colorClass].filter(Boolean).join(" ")}
                    disabled={disabled || busy || (locked && action !== "lost")}
                    onClick={() => openAction(action)}
                  >
                    {label}
                  </Button>
                </Fragment>
              );
            })}
          </div>
          {error && !activeAction ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(activeAction && activeConfig)}
        title={activeLabel}
        description={activeConfig?.description}
        tone={activeConfig?.tone}
        confirmLabel={activeLabel || activeConfig?.label}
        busy={busy}
        contentClassName={
          activeAction && SEND_APPROVAL_ACTIONS.has(activeAction) ? "max-w-lg" : undefined
        }
        onCancel={close}
        onConfirm={() => void confirm()}
      >
        {activeConfig && activeConfig.fields.length > 0 ? (
          <div className="space-y-4">
            {activeConfig.fields.map((field) => (
              <FinanceField
                key={field.key}
                label={field.required ? `${field.label} *` : field.label}
                className="space-y-2"
              >
                {field.type === "checkbox" ? (
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
                      checked={values[field.key] === "true"}
                      onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.checked ? "true" : "" }))}
                    />
                    <span>
                      Yes, I have read the customer PO and I accept its terms - payment terms, LD clauses,
                      delivery and warranty obligations. It can now go to Finance.
                    </span>
                  </label>
                ) : field.type === "textarea" ? (
                  <FinanceTextarea
                    value={values[field.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                    className="min-h-[88px] rounded-lg border-slate-200 bg-white text-[13px] shadow-none placeholder:text-slate-400 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-200/80"
                    placeholder={`Add ${field.label.toLowerCase()}…`}
                  />
                ) : field.type === "approver" ? (
                  <ApproverMultiSelect
                    options={approvalUsers}
                    value={approverIds}
                    lockedIds={activePinnedApproverIds}
                    onChange={(ids) => setApproverIds(mergeApproverSelection(ids, activePinnedApproverIds))}
                  />
                ) : field.type === "approver_stage" && field.stage ? (
                  <ApproverMultiSelect
                    options={approvalUsers}
                    value={poStageApprovers[field.stage]}
                    lockedIds={field.stage === "finance" ? activePinnedApproverIds : []}
                    onChange={(ids) =>
                      setPoStageApprovers((prev) => ({
                        ...prev,
                        [field.stage as PoStage]:
                          field.stage === "finance"
                            ? mergeApproverSelection(ids, activePinnedApproverIds)
                            : ids,
                      }))
                    }
                  />
                ) : field.type === "file" ? (
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 cursor-pointer border-slate-200 bg-white transition-colors duration-200 hover:bg-slate-50"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip className="size-3.5" />
                        Choose file
                        {activeAction === "attach_boq" ||
                          activeAction === "attach_sow" ||
                          activeAction === "attach_oem_quote" ||
                          activeAction === "attach_po" ||
                          activeAction === "attach_contract"
                          ? "s"
                          : ""}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={
                          activeAction === "attach_oem_quote" ? OUTLOOK_MAIL_ACCEPT : undefined
                        }
                        multiple={
                          activeAction === "attach_boq" ||
                          activeAction === "attach_sow" ||
                          activeAction === "attach_oem_quote" ||
                          activeAction === "attach_po" ||
                          activeAction === "attach_contract"
                        }
                        className="sr-only"
                        onChange={(e) => {
                          const selected = Array.from(e.target.files ?? []);
                          if (activeAction === "attach_oem_quote") {
                            const valid = selected.filter(isOutlookMailExportFile);
                            if (selected.length > 0 && valid.length === 0) {
                              setError(OUTLOOK_MAIL_HINT);
                              setFiles([]);
                              setFile(null);
                              e.target.value = "";
                              return;
                            }
                            if (valid.length < selected.length) {
                              setError(
                                `${OUTLOOK_MAIL_HINT} Skipped ${selected.length - valid.length} unsupported file(s).`,
                              );
                            } else {
                              setError(null);
                            }
                            setFiles(valid);
                            setFile(valid[0] ?? null);
                            return;
                          }
                          if (
                            activeAction === "attach_boq" ||
                            activeAction === "attach_sow" ||
                            activeAction === "attach_po" ||
                            activeAction === "attach_contract"
                          ) {
                            setFiles(selected);
                            setFile(selected[0] ?? null);
                            if (activeAction === "attach_po") void previewCustomerPo(selected[0]);
                          } else {
                            setFile(selected[0] ?? null);
                            setFiles(selected[0] ? [selected[0]] : []);
                          }
                        }}
                      />
                      <span className="min-w-0 max-w-full truncate text-xs text-slate-500">
                        {files.length > 1
                          ? `${files.length} files selected`
                          : file?.name ?? "No file selected"}
                      </span>
                      {activeAction === "attach_oem_quote" ? (
                        <span className="w-full text-[11px] text-slate-500">
                          Outlook export only: .msg (Windows) or .eml (Mac / New Outlook / web)
                        </span>
                      ) : null}
                    </div>
                    {files.length > 1 ? (
                      <ul className="space-y-0.5 text-[11px] text-slate-500">
                        {files.map((f) => (
                          <li key={f.name} className="truncate">
                            {f.name}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {activeAction === "attach_po" && (poExtracting || poExtract) ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        {poExtracting ? (
                          "Reading PO details…"
                        ) : poExtract && poExtract.fields_found.length > 0 ? (
                          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                            <dt className="text-slate-500">PO number</dt>
                            <dd>{poExtract.po_number ?? "-"}</dd>
                            <dt className="text-slate-500">PO date</dt>
                            <dd>{poExtract.po_date ?? "-"}</dd>
                            <dt className="text-slate-500">GSTIN</dt>
                            <dd>
                              {poExtract.gst_registrations.length > 0
                                ? poExtract.gst_registrations
                                  .map((g) => `${g.gstin}${g.state ? ` (${g.state})` : ""}${g.is_new ? " - saved to account" : ""}`)
                                  .join(", ")
                                : "-"}
                            </dd>
                            {poExtract.delivery_weeks_max ? (
                              <>
                                <dt className="text-slate-500">Lead time</dt>
                                <dd>
                                  {poExtract.delivery_weeks_min}-{poExtract.delivery_weeks_max} weeks
                                </dd>
                              </>
                            ) : null}
                          </dl>
                        ) : (
                          "Could not read PO details from this file - enter them on the OVF."
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <Input
                    type={field.type}
                    value={values[field.key] ?? ""}
                    readOnly={field.readOnly}
                    onChange={(e) => {
                      if (field.readOnly) return;
                      setValues((v) => ({ ...v, [field.key]: e.target.value }));
                    }}
                    className={[
                      "h-10 rounded-lg border-slate-200 bg-white text-sm shadow-none focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-200/80",
                      field.readOnly ? "cursor-default bg-slate-50 text-slate-700" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                )}
              </FinanceField>
            ))}
          </div>
        ) : null}
        {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
      </ConfirmDialog>

      <RequiredFieldsDialog
        open={mandateOpen}
        message={mandateMessage}
        fields={mandateFields}
        onClose={() => {
          setMandateOpen(false);
          setMandateFields([]);
        }}
      />
    </div>
  );
}

export function BlueprintStateBadge({ state, label }: { state?: string; label?: string }) {
  const text =
    label?.trim() ||
    state?.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) ||
    "-";
  return <SalesStageBadge label={text} state={state} />;
}
