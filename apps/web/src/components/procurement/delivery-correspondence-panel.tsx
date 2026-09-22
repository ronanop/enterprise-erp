"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Mail, Save, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError } from "@/services/api-client";
import {
  listCorrespondenceTemplates,
  listOrderCorrespondence,
  upsertCorrespondenceTemplate,
  type ScmCorrespondenceDelivery,
  type ScmCorrespondenceTemplate,
} from "@/services/procurement-service";

type PanelTab = "log" | "templates";

const KIND_LABELS: Record<string, string> = {
  order_acknowledged: "Order acknowledgement",
  etd_reminder: "ETD reminder",
  delivery_date_shared: "Delivery date update",
};

function kindLabel(kind: string | null | undefined, eventType?: string | null): string {
  if (kind && KIND_LABELS[kind]) return KIND_LABELS[kind];
  if (eventType?.includes("order_acknowledged")) return KIND_LABELS.order_acknowledged;
  if (eventType?.includes("etd_reminder")) return KIND_LABELS.etd_reminder;
  if (eventType?.includes("delivery_date_shared")) return KIND_LABELS.delivery_date_shared;
  return eventType?.replace("procurement.", "") || "Correspondence";
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 16);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "delivered" || s === "sent" || s === "success") {
    return "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200";
  }
  if (s === "pending" || s === "queued" || s === "processing") {
    return "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100";
  }
  if (s === "failed" || s === "bounced" || s === "error") {
    return "border-transparent bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200";
  }
  return "border-border/70 bg-muted text-muted-foreground";
}

type Props = {
  orderId: string;
  customerName?: string | null;
  /** Bump after "Run correspondence now" to reload the mail log. */
  refreshKey?: number;
  canEditTemplates: boolean;
};

export function DeliveryCorrespondencePanel({
  orderId,
  customerName,
  refreshKey = 0,
  canEditTemplates,
}: Props) {
  const [tab, setTab] = useState<PanelTab>("log");
  const [rows, setRows] = useState<ScmCorrespondenceDelivery[]>([]);
  const [templates, setTemplates] = useState<ScmCorrespondenceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editKind, setEditKind] = useState("order_acknowledged");
  const [editScope, setEditScope] = useState<"default" | "customer">("default");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const customerAccountId =
    templates.find((t) => t.scope === "customer" && t.company_account_id)?.company_account_id ??
    null;

  const loadLog = useCallback(async () => {
    const data = await listOrderCorrespondence(orderId);
    setRows(data);
  }, [orderId]);

  const loadTemplates = useCallback(async () => {
    const data = await listCorrespondenceTemplates({ orderId });
    setTemplates(data);
    return data;
  }, [orderId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadLog(), loadTemplates()]);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load correspondence",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLog, loadTemplates, refreshKey]);

  useEffect(() => {
    const match = templates.find(
      (t) => t.kind === editKind && t.scope === editScope,
    );
    if (!match) return;
    setSubject(match.subject_template ?? "");
    setBody(match.body_template ?? "");
  }, [templates, editKind, editScope]);

  async function saveTemplate() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (editScope === "customer" && !customerAccountId) {
        setError(
          "No customer account is linked to this order, so a customer override cannot be saved.",
        );
        return;
      }
      await upsertCorrespondenceTemplate({
        kind: editKind,
        subject_template: subject,
        body_template: body,
        company_account_id: editScope === "customer" ? customerAccountId : null,
      });
      const next = await loadTemplates();
      setTemplates(next);
      setNotice(
        editScope === "customer"
          ? "Customer template saved. Future mails for this customer use this body."
          : "Default template saved.",
      );
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to save template",
      );
    } finally {
      setSaving(false);
    }
  }

  const activeTemplate = templates.find(
    (t) => t.kind === editKind && t.scope === editScope,
  );
  const kinds = Array.from(new Set(templates.map((t) => t.kind)));

  return (
    <div className="mt-5 border-t border-border/60 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold tracking-tight">Correspondence</h3>
          <p className="text-[11px] text-muted-foreground">
            Reminder mails sent for this order, delivery status, and editable
            templates{customerName ? ` for ${customerName}` : ""}.
          </p>
        </div>
        <div className="flex rounded-lg border border-border/70 bg-muted/40 p-0.5">
          <button
            type="button"
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors duration-200 ${
              tab === "log"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("log")}
          >
            <Mail className="size-3" aria-hidden />
            Mail log
          </button>
          <button
            type="button"
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors duration-200 ${
              tab === "templates"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("templates")}
          >
            <FileText className="size-3" aria-hidden />
            Templates
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-600">
          <TriangleAlert className="size-3.5" /> {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          {notice}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Loading correspondence…
        </p>
      ) : tab === "log" ? (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b border-border/60 bg-muted/40 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2">Sent</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">To</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    No reminder mails yet. Use &ldquo;Run correspondence now&rdquo; to
                    send the next batch.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {formatWhen(row.delivered_at || row.created_at)}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {kindLabel(row.kind, row.event_type)}
                    </td>
                    <td className="px-3 py-2">{row.recipient_address || "—"}</td>
                    <td className="max-w-[220px] truncate px-3 py-2" title={row.subject ?? undefined}>
                      {row.subject || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        className={`rounded-full px-2 py-0 text-[10px] font-semibold capitalize ${statusBadgeClass(row.status)}`}
                      >
                        {row.status}
                      </Badge>
                      {row.provider_response ? (
                        <p
                          className="mt-0.5 max-w-[180px] truncate text-[10px] text-muted-foreground"
                          title={row.provider_response}
                        >
                          {row.provider_response}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Message type
              </span>
              <select
                value={editKind}
                onChange={(e) => setEditKind(e.target.value)}
                className="flex h-9 w-56 cursor-pointer rounded-md border border-border/80 bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-primary/25"
              >
                {(kinds.length
                  ? kinds
                  : ["order_acknowledged", "etd_reminder", "delivery_date_shared"]
                ).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k] || k}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Scope
              </span>
              <select
                value={editScope}
                onChange={(e) =>
                  setEditScope(e.target.value as "default" | "customer")
                }
                className="flex h-9 w-52 cursor-pointer rounded-md border border-border/80 bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-primary/25"
              >
                <option value="default">Default (all customers)</option>
                <option value="customer" disabled={!customerAccountId}>
                  {customerName
                    ? `This customer (${customerName})`
                    : "This customer"}
                </option>
              </select>
            </label>
            {activeTemplate?.inherits_default ? (
              <Badge className="mb-1 rounded-full border-transparent bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                Inheriting default
              </Badge>
            ) : null}
            {activeTemplate?.is_override ? (
              <Badge className="mb-1 rounded-full border-transparent bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-900">
                Customer override
              </Badge>
            ) : null}
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Subject
            </span>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={!canEditTemplates}
              className="h-9 text-[13px]"
              placeholder="Subject with {{placeholders}}"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Body (HTML allowed)
            </span>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={!canEditTemplates}
              rows={8}
              className="min-h-[160px] font-mono text-[12px] leading-relaxed"
              placeholder="<p>Dear {{customer_name}}, …</p>"
            />
          </label>

          {activeTemplate?.placeholders?.length ? (
            <p className="text-[10px] text-muted-foreground">
              Placeholders:{" "}
              {activeTemplate.placeholders.map((p) => `{{${p}}}`).join(", ")}
            </p>
          ) : null}

          {canEditTemplates ? (
            <Button
              type="button"
              size="sm"
              disabled={saving || !subject.trim() || !body.trim()}
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void saveTemplate()}
            >
              {saving ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 size-3.5" />
              )}
              Save template
            </Button>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              You need order update permission to edit templates.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
