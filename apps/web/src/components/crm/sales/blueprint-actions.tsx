"use client";

import { Fragment, useRef, useState } from "react";
import { Paperclip } from "lucide-react";

import { FinanceField, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import { fileToBase64, type BlueprintActionPayload } from "@/services/sales-crm-service";

type FieldType = "text" | "textarea" | "date" | "number" | "file";

type FieldConfig = {
  key: "remark" | "remarks" | "reason" | "deal_reg_number" | "valid_until" | "deal_won_amount" | "file_name";
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

const ACTION_CONFIG: Record<string, ActionConfig> = {
  convert: {
    label: "Convert to Opportunity",
    fields: [],
    description: "Handled via the dedicated Convert dialog.",
  },
  lost: {
    label: "Mark Lost",
    tone: "destructive",
    fields: [{ key: "reason", label: "Lost reason", type: "textarea", required: true }],
    description: "Available until the deal is Won.",
  },
  attach_boq: {
    label: "Attach BOQ",
    fields: [{ key: "file_name", label: "BOQ file", type: "file", required: true }],
  },
  send_boq_approval: {
    label: "Send BOQ / SOW for Approval",
    fields: [REMARK_FIELD],
    description: "Routes the attached BOQ or SOW to the Pre-sales team via My Jobs.",
  },
  attach_sow: {
    label: "Attach SOW",
    fields: [{ key: "file_name", label: "SOW file", type: "file", required: true }],
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
    tone: "destructive",
    fields: [{ key: "remark", label: "Rejection remark", type: "textarea", required: true }],
  },
  send_to_customer: {
    label: "Send to Customer",
    fields: [{ key: "valid_until", label: "Valid until", type: "date" }],
  },
  negotiate: { label: "Move to Negotiation", fields: [REMARK_FIELD_ALT] },
  follow_up: { label: "Move to Follow-up", fields: [REMARK_FIELD_ALT] },
  accept: { label: "Mark Accepted", fields: [REMARK_FIELD_ALT] },
  approve: { label: "Approve", fields: [REMARK_FIELD_ALT] },
  reject: {
    label: "Reject",
    tone: "destructive",
    fields: [{ key: "remark", label: "Rejection remark", type: "textarea", required: true }],
  },
  share_to_scm: { label: "Share to SCM", fields: [] },
  deal_won: {
    label: "Mark Deal Won",
    fields: [{ key: "deal_won_amount", label: "Deal Won Amount (₹)", type: "number", required: true }],
  },
};

type Props = {
  allowedActions: string[];
  locked?: boolean;
  /** Actions rendered elsewhere by the parent (e.g. gated Create Quote / Create OVF CTAs). */
  excludeActions?: string[];
  defaultValues?: Partial<Record<string, string | number | null>>;
  onAction: (action: string, payload: BlueprintActionPayload) => Promise<void>;
  disabled?: boolean;
};

export function BlueprintActions({
  allowedActions,
  locked,
  excludeActions,
  defaultValues,
  onAction,
  disabled,
}: Props) {
  const exclude = new Set(excludeActions ?? []);
  const visibleActions = allowedActions.filter((a) => !exclude.has(a));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (locked || visibleActions.length === 0) return null;

  function resolveConfig(action: string): ActionConfig {
    return (
      ACTION_CONFIG[action] ?? {
        label: action.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        fields: [REMARK_FIELD_ALT],
      }
    );
  }

  function openAction(action: string) {
    const config = resolveConfig(action);
    setActiveAction(action);
    setValues(
      Object.fromEntries(
        config.fields.flatMap((field) => {
          const value = defaultValues?.[field.key];
          return value === null || value === undefined ? [] : [[field.key, String(value)]];
        }),
      ),
    );
    setFile(null);
    setError(null);
  }

  function close() {
    if (busy) return;
    setActiveAction(null);
    setValues({});
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setError(null);
  }

  async function confirm() {
    if (!activeAction) return;
    const config = resolveConfig(activeAction);
    for (const field of config.fields) {
      if (field.required && field.type !== "file" && !values[field.key]?.trim()) {
        setError(`${field.label} is required`);
        return;
      }
      if (field.required && field.type === "file" && !file) {
        setError(`${field.label} is required`);
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const payload: BlueprintActionPayload = {};
      for (const field of config.fields) {
        if (field.type === "file") continue;
        const raw = values[field.key];
        if (!raw) continue;
        if (field.key === "deal_won_amount") payload.deal_won_amount = Number(raw);
        else if (field.key === "valid_until") payload.valid_until = raw;
        else (payload as Record<string, string>)[field.key] = raw;
      }
      if (activeAction === "lost" && values.reason) {
        payload.remark = values.reason;
      }
      if (file) {
        payload.file_name = file.name;
        payload.content_type = file.type || "application/octet-stream";
        payload.content_base64 = await fileToBase64(file);
      }
      await onAction(activeAction, payload);
      close();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : `Failed to ${activeAction}`);
    } finally {
      setBusy(false);
    }
  }

  const activeConfig = activeAction ? resolveConfig(activeAction) : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Blueprint actions
        </span>
        {visibleActions.map((action, index) => {
          const config = resolveConfig(action);
          return (
            <Fragment key={action}>
              {action === "attach_sow" && visibleActions[index - 1] === "attach_boq" ? (
                <span className="text-xs font-medium text-muted-foreground" aria-hidden="true">
                  or
                </span>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant={config.tone === "destructive" ? "destructive" : "outline"}
                className="cursor-pointer"
                disabled={disabled}
                onClick={() => openAction(action)}
              >
                {config.label}
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
                ) : field.type === "file" ? (
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
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="sr-only"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                    <span className="min-w-0 max-w-full truncate text-xs text-muted-foreground">
                      {file?.name ?? "No file selected"}
                    </span>
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
