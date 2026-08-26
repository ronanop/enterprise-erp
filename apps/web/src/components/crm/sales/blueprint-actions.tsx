"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Paperclip } from "lucide-react";

import { ApproverMultiSelect } from "@/components/crm/sales/approver-multi-select";
import { FinanceField, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import { fileToBase64, listCrmApprovalUsers, type BlueprintActionPayload } from "@/services/sales-crm-service";

type FieldType = "text" | "textarea" | "date" | "number" | "file" | "approver";

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
  | "assigned_user_id";
  label: string;
  type: FieldType;
  required?: boolean;
};

type ActionConfig = {
  label: string;
  tone?: "default" | "destructive";
  description?: string;
  fields: FieldConfig[];
};

const REMARK_FIELD: FieldConfig = { key: "remarks", label: "Remarks", type: "textarea" };
const REMARK_FIELD_ALT: FieldConfig = { key: "remark", label: "Remark", type: "textarea" };

const SEND_APPROVAL_ACTIONS = new Set([
  "send_boq_approval",
  "send_sow_approval",
  "send_po_approval",
  "send_for_approval",
]);

const APPROVAL_DIALOG_FIELDS: FieldConfig[] = [
  { key: "assigned_user_id", label: "Approvers", type: "approver", required: true },
  { key: "remarks", label: "Remarks", type: "textarea", required: true },
];

const ACTION_CONFIG: Record<string, ActionConfig> = {
  convert: {
    label: "Convert to Opportunity",
    fields: [],
    description: "Converts immediately using lead defaults.",
  },
  lost: {
    label: "Mark Lost",
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
    description: "Optional for cloud deals — customer contract or invoice evidence.",
  },
  send_cloud_discount_approval: {
    label: "Send Cloud Discount for Approval",
    fields: [REMARK_FIELD],
    description:
      "Routes MRR, ARR, customer discount, and profitability to Management via My Jobs.",
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
      "Customer is onboarded on the payer account — closes the opportunity for sales; billing continues monthly.",
  },
  send_boq_approval: {
    label: "Send BOQ for Approval",
    fields: [REMARK_FIELD],
    description: "Routes the attached BOQ or SOW to the Pre-sales team via My Jobs.",
  },
  attach_sow: {
    label: "Attach SOW",
    fields: [{ key: "file_name", label: "SOW files", type: "file", required: true }],
  },
  send_sow_approval: {
    label: "Send SOW for Approval",
    fields: [REMARK_FIELD],
    description: "Routes the attached SOW to the Pre-sales team via My Jobs.",
  },
  skip_sow: { label: "Skip SOW", fields: [] },
  deal_reg: {
    label: "Deal Registration",
    fields: [{ key: "deal_reg_number", label: "Deal Reg Number", type: "text", required: true }],
  },
  oem_received: { label: "OEM Quotation Received", fields: [] },
  attach_oem_quote: {
    label: "Attach OEM Quote",
    fields: [{ key: "file_name", label: "OEM quote file", type: "file", required: true }],
    description:
      "Hardware: OEM vendor quote. Cloud MAP migration: AWS migration quotation from the OEM.",
  },
  attach_po: {
    label: "Attach Customer PO",
    fields: [{ key: "file_name", label: "Customer PO file", type: "file", required: true }],
  },
  send_po_approval: {
    label: "Send PO for Approval",
    fields: [REMARK_FIELD],
    description: "Routes to the Management team via My Jobs.",
  },
  send_for_approval: {
    label: "Send for Approval",
    fields: [REMARK_FIELD],
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
    label: "Send to Customer",
    fields: [],
  },
  negotiate: { label: "Move to Negotiation", fields: [REMARK_FIELD_ALT] },
  follow_up: { label: "Move to Follow-up", fields: [REMARK_FIELD_ALT] },
  accept: { label: "Quote Accepted", fields: [REMARK_FIELD_ALT] },
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
};

const BLUE_ACTION_BUTTON_CLASS =
  "border-blue-900 bg-blue-800 font-bold text-white hover:bg-blue-900 hover:text-white dark:border-blue-700 dark:bg-blue-800 dark:text-white dark:hover:bg-blue-700";

const LOST_BUTTON_CLASS =
  "border-red-800 bg-red-700 font-bold text-white hover:bg-red-800 hover:text-white dark:border-red-600 dark:bg-red-700 dark:text-white dark:hover:bg-red-600";

const ATTACH_ACTIONS = new Set([
  "attach_boq",
  "attach_sow",
  "attach_oem_quote",
  "attach_po",
  "attach_contract",
]);

const APPROVAL_ACTIONS = new Set([
  "send_boq_approval",
  "send_sow_approval",
  "send_po_approval",
  "send_for_approval",
  "send_cloud_discount_approval",
]);

type Props = {
  allowedActions: string[];
  locked?: boolean;
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
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalUsers, setApprovalUsers] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listCrmApprovalUsers()
      .then((rows) => {
        if (cancelled) return;
        setApprovalUsers(
          rows.map((row) => ({
            id: row.id,
            label: `${row.display_name} (${row.email})`,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setApprovalUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (locked || visibleActions.length === 0) return null;

  function resolveConfig(action: string): ActionConfig {
    const base =
      ACTION_CONFIG[action] ?? {
        label: action.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        fields: [REMARK_FIELD_ALT],
      };
    if (SEND_APPROVAL_ACTIONS.has(action)) {
      return {
        ...base,
        fields: APPROVAL_DIALOG_FIELDS,
        description:
          base.description ??
          "A copy is also sent to tenant admins. Any selected approver or an admin can decide in My Jobs.",
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
    // Convert uses lead defaults and should not open a form popup.
    if (action === "convert" && config.fields.length === 0) {
      void runImmediate(action);
      return;
    }
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
    setApproverIds([]);
    setFile(null);
    setFiles([]);
    setError(null);
  }

  function close() {
    if (busy) return;
    setActiveAction(null);
    setValues({});
    setApproverIds([]);
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
    for (const field of config.fields) {
      if (field.required && field.type === "approver") {
        if (approverIds.length === 0) {
          setError(`${field.label} is required`);
          return;
        }
        continue;
      }
      if (field.required && field.type !== "file" && !values[field.key]?.trim()) {
        setError(`${field.label} is required`);
        return;
      }
      if (field.required && field.type === "file") {
        if (isMultiFile && files.length === 0) {
          setError(`${field.label} is required`);
          return;
        }
        if (!isMultiFile && !file) {
          setError(`${field.label} is required`);
          return;
        }
      }
    }

    setBusy(true);
    setError(null);
    try {
      const payloadBase: BlueprintActionPayload = {};
      for (const field of config.fields) {
        if (field.type === "file" || field.type === "approver") continue;
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
  const orderedActions = [...visibleActions].sort((a, b) => {
    const rank = (action: string) => {
      if (action === "attach_sow") return 0;
      if (action === "attach_boq") return 1;
      if (action === "send_boq_approval") return 2;
      if (action === "send_sow_approval") return 3;
      if (action === "deal_reg") return 4;
      if (action === "send_to_customer") return 5;
      if (action === "accept") return 6;
      if (action === "negotiate") return 7;
      if (action === "follow_up") return 8;
      if (action === "attach_po") return 9;
      if (action === "send_po_approval") return 10;
      if (action === "lost") return 20;
      return 15;
    };
    return rank(a) - rank(b);
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Blueprint actions
        </span>
        {orderedActions.map((action, index) => {
          const config = resolveConfig(action);
          const label = actionLabelOverrides?.[action] ?? config.label;
          const isAttach = ATTACH_ACTIONS.has(action);
          const isApproval = APPROVAL_ACTIONS.has(action);
          const isLost = action === "lost";
          const colorClass = isLost
            ? LOST_BUTTON_CLASS
            : isAttach || isApproval
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
                disabled={disabled}
                onClick={() => openAction(action)}
              >
                {label}
              </Button>
            </Fragment>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(activeAction && activeConfig)}
        title={activeConfig?.label ?? ""}
        description={activeConfig?.description}
        tone={activeConfig?.tone}
        confirmLabel={activeConfig?.label}
        busy={busy}
        onCancel={close}
        onConfirm={() => void confirm()}
      >
        {activeConfig && activeConfig.fields.length > 0 ? (
          <div className="mt-3 space-y-3">
            {activeConfig.fields.map((field) => (
              <FinanceField
                key={field.key}
                label={field.required ? `${field.label} *` : field.label}
              >
                {field.type === "textarea" ? (
                  <FinanceTextarea
                    value={values[field.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  />
                ) : field.type === "approver" ? (
                  <ApproverMultiSelect
                    options={approvalUsers}
                    value={approverIds}
                    onChange={setApproverIds}
                  />
                ) : field.type === "file" ? (
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="cursor-pointer"
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
                          if (
                            activeAction === "attach_boq" ||
                            activeAction === "attach_sow" ||
                            activeAction === "attach_oem_quote" ||
                            activeAction === "attach_po" ||
                            activeAction === "attach_contract"
                          ) {
                            setFiles(selected);
                            setFile(selected[0] ?? null);
                          } else {
                            setFile(selected[0] ?? null);
                            setFiles(selected[0] ? [selected[0]] : []);
                          }
                        }}
                      />
                      <span className="min-w-0 max-w-full truncate text-xs text-muted-foreground">
                        {files.length > 1
                          ? `${files.length} files selected`
                          : file?.name ?? "No file selected"}
                      </span>
                    </div>
                    {files.length > 1 ? (
                      <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                        {files.map((f) => (
                          <li key={f.name} className="truncate">
                            {f.name}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : (
                  <Input
                    type={field.type}
                    value={values[field.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  />
                )}
              </FinanceField>
            ))}
          </div>
        ) : null}
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      </ConfirmDialog>
    </div>
  );
}

export function BlueprintStateBadge({ state }: { state: string }) {
  return (
    <Badge variant="outline" className="font-medium capitalize">
      {state.replaceAll("_", " ") || "—"}
    </Badge>
  );
}
