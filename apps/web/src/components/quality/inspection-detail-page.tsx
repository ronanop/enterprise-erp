"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

import {
  ModuleCrossLink,
  ModuleDetailGrid,
  ModuleDetailPage,
  ModuleDetailSection,
  ModuleWorkflowActions,
  textOrDash,
} from "@/components/module/module-detail-ui";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  addIncomingInspectionLines,
  createQualityDefect,
  getFinalInspection,
  getIncomingInspection,
  getInprocessInspection,
  listQualityDefects,
  listQmCharacteristics,
  loadQmOptions,
  qualityInspectionAction,
  updateIncomingInspection,
  type QmCharacteristic,
  type QualityDefect,
  type QualityInspection,
} from "@/services/quality-service";
import { parseNonNegativeQty, mapQtyApiError, validateQtyInputs, type QtyField, type QtyFieldErrors } from "@/components/quality/quality-qty";

type InspectionType = "incoming" | "inprocess" | "final";

const CONFIG: Record<
  InspectionType,
  { title: string; backHref: string; backLabel: string; load: (id: string) => Promise<QualityInspection> }
> = {
  incoming: {
    title: "Incoming Inspection",
    backHref: "/quality/incoming-inspections",
    backLabel: "Back to IQC",
    load: getIncomingInspection,
  },
  inprocess: {
    title: "In-Process Inspection",
    backHref: "/quality/inprocess-inspections",
    backLabel: "Back to IPQC",
    load: getInprocessInspection,
  },
  final: {
    title: "Final Inspection",
    backHref: "/quality/final-inspections",
    backLabel: "Back to FQC",
    load: getFinalInspection,
  },
};

function workflowActions(type: InspectionType, status: string, result: string): { key: string; label: string }[] {
  const s = status.toLowerCase();
  if (type === "incoming") {
    if (s === "draft" || s === "in_progress") return [{ key: "complete", label: "Complete" }];
    if (s === "completed" && result !== "accepted") return [{ key: "approve", label: "Approve disposition" }];
    return [];
  }
  if (type === "inprocess") {
    if (s !== "completed" && s !== "cancelled") return [{ key: "complete", label: "Complete" }];
    return [];
  }
  if (type === "final") {
    if (s === "draft") return [{ key: "submit", label: "Submit" }];
    if (s === "submitted") return [{ key: "approve", label: "Approve" }];
    if (s === "approved") return [{ key: "complete", label: "Release to inventory" }];
    return [];
  }
  return [];
}

function needsNcr(result: string): boolean {
  const r = result.toLowerCase();
  return r === "rejected" || r === "conditional" || r === "rework_required";
}

type NextStep = {
  title: string;
  body: string;
  primaryLabel: string;
  primaryHref?: string;
  primaryAction?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

function buildNcrHref(type: InspectionType, row: QualityInspection): string {
  const params = new URLSearchParams({
    source: "inspection",
    description: `NCR from ${row.document_number}`,
  });
  if (row.product_id) params.set("product_id", row.product_id);
  if (row.vendor_id) params.set("vendor_id", row.vendor_id);
  if (type === "incoming") params.set("incoming_inspection_id", row.id);
  if (type === "inprocess") params.set("inprocess_inspection_id", row.id);
  if (type === "final") params.set("final_inspection_id", row.id);
  return `/quality/ncrs/new?${params.toString()}`;
}

export function InspectionDetailPage({
  inspectionId,
  type,
}: {
  inspectionId: string;
  type: InspectionType;
}) {
  const router = useRouter();
  const cfg = CONFIG[type];
  const [row, setRow] = useState<QualityInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nextStep, setNextStep] = useState<NextStep | null>(null);
  const [linkedDefects, setLinkedDefects] = useState<QualityDefect[]>([]);
  const actionLock = useRef(false);
  const [qtyDraft, setQtyDraft] = useState({ inspected: "", accepted: "", rejected: "" });
  const [qtyErrors, setQtyErrors] = useState<QtyFieldErrors>({});
  const [defectTypeId, setDefectTypeId] = useState("");
  const [defectTypes, setDefectTypes] = useState<{ id: string; label: string }[]>([]);
  const [planChars, setPlanChars] = useState<QmCharacteristic[]>([]);
  const [draftLines, setDraftLines] = useState<
    { characteristic_id: string; characteristic_name: string; measured_value: string; measured_text: string; pass_fail: string }[]
  >([]);
  const [selectedCharId, setSelectedCharId] = useState("");
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true);
    setError(null);
    try {
      const data = await cfg.load(inspectionId);
      setRow(data);
      loadedOnce.current = true;
      setQtyDraft({
        inspected: String(data.inspected_qty ?? ""),
        accepted: String(data.accepted_qty ?? ""),
        rejected: String(data.rejected_qty ?? ""),
      });
      if (type === "incoming") {
        const defects = await listQualityDefects();
        setLinkedDefects(defects.filter((d) => d.incoming_inspection_id === inspectionId));
      } else {
        setLinkedDefects([]);
      }
      return data;
    } catch (err) {
      setRow(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load inspection");
      return null;
    } finally {
      setLoading(false);
    }
  }, [cfg, inspectionId, type]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadQmOptions().then((opts) => setDefectTypes(opts.defectTypes));
  }, []);

  useEffect(() => {
    if (type !== "incoming" || !row?.inspection_plan_id) {
      setPlanChars([]);
      return;
    }
    void listQmCharacteristics(row.inspection_plan_id).then(setPlanChars);
  }, [type, row?.inspection_plan_id]);

  const canEditChecklist =
    type === "incoming" &&
    row != null &&
    (row.status === "draft" || row.status === "in_progress");

  function addDraftLine() {
    const char = planChars.find((c) => c.id === selectedCharId);
    if (!char) return;
    if (draftLines.some((d) => d.characteristic_id === char.id)) return;
    setDraftLines((rows) => [
      ...rows,
      {
        characteristic_id: char.id,
        characteristic_name: char.characteristic_name,
        measured_value: "",
        measured_text: "",
        pass_fail: "",
      },
    ]);
    setSelectedCharId("");
  }

  async function onSaveChecklistLines() {
    if (!row || type !== "incoming") return;
    const filled = draftLines.filter((ln) => ln.measured_value || ln.measured_text || ln.pass_fail);
    if (filled.length === 0) {
      setError("Fill at least one checklist row (Measured, Text, or Pass/Fail) before saving.");
      return;
    }
    await runAction("Saving checklist lines…", async () => {
      await addIncomingInspectionLines(
        row.id,
        filled.map((ln, i) => ({
          line_number: (row.lines?.length ?? 0) + i + 1,
          characteristic_id: ln.characteristic_id,
          measured_value: ln.measured_value ? Number(ln.measured_value) : null,
          measured_text: ln.measured_text || null,
          pass_fail: ln.pass_fail === "pass" || ln.pass_fail === "fail" ? ln.pass_fail : null,
          is_out_of_spec: ln.pass_fail === "fail",
        })),
      );
      setDraftLines([]);
      await load();
      setSuccess("Checklist lines saved.");
      setNextStep({
        title: "Checklist saved",
        body: "Quantities and measurements are on the draft. Complete the inspection to set Accepted / Conditional / Rejected.",
        primaryLabel: "Complete inspection",
        primaryAction: "complete",
      });
    });
  }

  const ncrHref = useMemo(() => {
    if (!row) return null;
    return buildNcrHref(type, row);
  }, [row, type]);

  const showCreateNcr = Boolean(row && needsNcr(row.result));

  async function runAction(message: string, task: () => Promise<void>) {
    if (actionLock.current || busy) return;
    actionLock.current = true;
    setBusy(true);
    setError(null);
    setSuccess(message);
    try {
      await task();
    } catch (err) {
      setSuccess(null);
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setBusy(false);
      actionLock.current = false;
    }
  }

  function updateQtyField(field: QtyField, value: string) {
    setQtyDraft((d) => ({ ...d, [field]: value }));
    setQtyErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      if (field !== "inspected") {
        delete next.accepted;
        delete next.rejected;
      }
      return next;
    });
  }

  async function onSaveQty() {
    if (!row || type !== "incoming") return;
    const fieldErrors = validateQtyInputs(qtyDraft.inspected, qtyDraft.accepted, qtyDraft.rejected);
    if (Object.keys(fieldErrors).length > 0) {
      setQtyErrors(fieldErrors);
      setSuccess(null);
      return;
    }
    setQtyErrors({});
    const inspected = parseNonNegativeQty(qtyDraft.inspected);
    const accepted = parseNonNegativeQty(qtyDraft.accepted);
    const rejected = parseNonNegativeQty(qtyDraft.rejected);
    await runAction("Saving quantities…", async () => {
      try {
        await updateIncomingInspection(row.id, {
          inspected_qty: inspected,
          accepted_qty: accepted,
          rejected_qty: rejected,
          version: row.version,
        });
        await load();
        setSuccess("Quantities saved on this draft.");
        setNextStep({
          title: "Quantities saved — inspection is still a draft",
          body: "Saving quantities does not finish IQC. Log any defects, then click Complete so the result (accepted / conditional / rejected) is calculated.",
          primaryLabel: "Complete inspection",
          primaryAction: "complete",
        });
      } catch (err) {
        const msg = err instanceof ApiClientError ? err.message : "Failed to save quantities";
        const fieldErrors = mapQtyApiError(msg);
        if (fieldErrors) {
          setQtyErrors(fieldErrors);
          setSuccess(null);
          return;
        }
        throw err;
      }
    });
  }

  async function onLogDefect() {
    if (!row || !defectTypeId || !row.company_id || !row.branch_id) return;
    const quantity = parseNonNegativeQty(qtyDraft.rejected) || 1;
    await runAction("Logging defect…", async () => {
      const sourceType =
        type === "incoming" ? "incoming" : type === "inprocess" ? "in_process" : "final";
      const defect = await createQualityDefect({
        company_id: row.company_id,
        branch_id: row.branch_id,
        defect_type_id: defectTypeId,
        severity: "minor",
        quantity,
        source_inspection_type: sourceType,
        product_id: row.product_id ?? null,
        incoming_inspection_id: type === "incoming" ? row.id : null,
        inprocess_inspection_id: type === "inprocess" ? row.id : null,
        final_inspection_id: type === "final" ? row.id : null,
      });
      await load();
      setSuccess(`Defect ${defect.document_number ?? "saved"}.`);
      setNextStep({
        title: "Defect logged — IQC is still a draft",
        body: "A defect is only the finding. Status stays Draft / Pending until you Complete this inspection. Then raise an NCR if the lot is not fully accepted.",
        primaryLabel: "Complete inspection",
        primaryAction: "complete",
        secondaryLabel: "Open defect",
        secondaryHref: `/quality/defects/${defect.id}`,
      });
    });
  }

  const actions = useMemo(
    () => (row ? workflowActions(type, row.status, row.result) : []),
    [row, type],
  );

  async function onWorkflow(action: string) {
    if (!row) return;
    if (type === "incoming" && action === "complete" && !(row.lines?.length)) {
      setError("Add at least one checklist line below before Completing.");
      setSuccess(null);
      return;
    }
    await runAction(`${action === "complete" ? "Completing" : "Processing"} inspection…`, async () => {
      await qualityInspectionAction(type, row.id, action);
      const updated = await load();
      if (!updated) return;

      if (type === "incoming" && action === "complete") {
        if (updated.status === "completed" && updated.result !== "accepted") {
          setSuccess(`Inspection completed · result ${updated.result}.`);
          setNextStep({
            title: "Next: approve disposition",
            body: "Complete set the result from quantities. Approve locks the lot. If any quantity was rejected, raise an NCR after approval.",
            primaryLabel: "Approve disposition",
            primaryAction: "approve",
            secondaryLabel: needsNcr(updated.result) ? "Create NCR" : undefined,
            secondaryHref: needsNcr(updated.result) ? buildNcrHref(type, updated) : undefined,
          });
          return;
        }
        setSuccess("Inspection completed · lot accepted.");
        setNextStep({
          title: "Lot accepted",
          body: "No NCR is required. Continue from the Incoming list or Quality overview.",
          primaryLabel: "Incoming list",
          primaryHref: "/quality/incoming-inspections",
          secondaryLabel: "Quality overview",
          secondaryHref: "/quality",
        });
        return;
      }

      if (type === "incoming" && action === "approve") {
        if (needsNcr(updated.result)) {
          router.push(buildNcrHref(type, updated));
          return;
        }
        setSuccess("Disposition approved.");
        setNextStep({
          title: "Disposition approved",
          body: "This IQC is finished. Open Incoming or Quality overview for the next lot.",
          primaryLabel: "Incoming list",
          primaryHref: "/quality/incoming-inspections",
        });
        return;
      }

      setSuccess("Action completed.");
      setNextStep(null);
    });
  }

  return (
    <ModuleDetailPage
      title={row?.document_number ?? cfg.title}
      subtitle={`${cfg.title} — upstream: ${type === "incoming" ? "Procurement GRN" : "Manufacturing WO"}`}
      backHref={cfg.backHref}
      backLabel={cfg.backLabel}
      status={row?.status}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      busy={busy}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ModuleWorkflowActions actions={actions} busy={busy} onAction={(a) => void onWorkflow(a)} />
          {ncrHref && showCreateNcr ? (
            <Link href={ncrHref} className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground transition-opacity duration-200 hover:opacity-90">
              Create NCR
            </Link>
          ) : null}
        </div>
      }
    >
      {row ? (
        <div className="space-y-6">
          {busy && success ? (
            <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
              <Loader2 className="size-4 shrink-0 animate-spin" />
              {success}
            </div>
          ) : nextStep ? (
            <NextStepPanel
              step={nextStep}
              busy={busy}
              onPrimaryAction={(action) => void onWorkflow(action)}
            />
          ) : success ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}
          <ModuleDetailSection title="Inspection Result">
            <ModuleDetailGrid
              items={[
                { label: "Document", value: textOrDash(row.document_number) },
                { label: "Date", value: textOrDash(row.document_date) },
                { label: "Result", value: <FinanceStatusBadge status={row.result} /> },
                { label: "Status", value: <FinanceStatusBadge status={row.status} /> },
                ...(row.inspected_qty != null
                  ? [{ label: "Inspected Qty", value: String(row.inspected_qty) }]
                  : []),
                ...(row.accepted_qty != null
                  ? [{ label: "Accepted", value: String(row.accepted_qty) }]
                  : []),
                ...(row.rejected_qty != null
                  ? [{ label: "Rejected", value: String(row.rejected_qty) }]
                  : []),
              ]}
            />
            {type === "incoming" &&
            (row.status === "draft" || row.status === "in_progress") ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <QtyInput
                  label="Inspected"
                  value={qtyDraft.inspected}
                  error={qtyErrors.inspected}
                  onChange={(v) => updateQtyField("inspected", v)}
                />
                <QtyInput
                  label="Accepted"
                  value={qtyDraft.accepted}
                  error={qtyErrors.accepted}
                  onChange={(v) => updateQtyField("accepted", v)}
                />
                <QtyInput
                  label="Rejected"
                  value={qtyDraft.rejected}
                  error={qtyErrors.rejected}
                  onChange={(v) => updateQtyField("rejected", v)}
                />
                <div className="sm:col-span-3">
                  <Button type="button" size="sm" disabled={busy} onClick={() => void onSaveQty()}>
                    Save quantities
                  </Button>
                </div>
              </div>
            ) : null}
          </ModuleDetailSection>

          <ModuleDetailSection title="Defect Logging">
            <p className="mb-3 text-xs text-muted-foreground">
              A defect does not change IQC status. Complete still sets Accepted / Conditional / Rejected from quantities.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Defect type</span>
                <select
                  value={defectTypeId}
                  onChange={(e) => setDefectTypeId(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select defect type…</option>
                  {defectTypes.map((dt) => (
                    <option key={dt.id} value={dt.id}>
                      {dt.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="button" size="sm" disabled={busy || !defectTypeId} className="cursor-pointer" onClick={() => void onLogDefect()}>
                Log defect
              </Button>
            </div>
            {linkedDefects.length > 0 ? (
              <ul className="mt-4 space-y-1.5 border-t border-border/70 pt-3">
                {linkedDefects.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/quality/defects/${d.id}`}
                      className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-foreground underline-offset-2 transition-colors duration-200 hover:text-primary hover:underline"
                    >
                      {d.document_number ?? "Defect"} · {d.severity} · {d.status}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No defects linked to this inspection yet.</p>
            )}
          </ModuleDetailSection>

          <ModuleDetailSection title="Cross-Module Links">
            <ModuleDetailGrid
              items={[
                {
                  label: "Production Order",
                  value: row.production_order_id ? (
                    <ModuleCrossLink
                      href={`/manufacturing/production-orders?highlight=${row.production_order_id}`}
                      label="View in Manufacturing"
                    />
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Downstream",
                  value: (
                    <span className="text-sm text-muted-foreground">
                      {row.result === "rejected"
                        ? "Rejected — blocked from inventory (FRD-14 §5)"
                        : row.result === "accepted" || row.result === "approved"
                          ? "Approved — eligible for inventory release (FRD-14 §7)"
                          : "Pending disposition"}
                    </span>
                  ),
                  fullWidth: true,
                },
              ]}
            />
          </ModuleDetailSection>

          {row.lines?.length ? (
            <ModuleDetailSection title="Checklist Lines">
              <div className="erp-scroll overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground uppercase">
                      <th className="py-2 pr-4">Line</th>
                      <th className="py-2 pr-4">Characteristic</th>
                      <th className="py-2 pr-4">Measured</th>
                      <th className="py-2 pr-4">Pass/Fail</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.lines.map((ln) => (
                      <tr key={ln.id} className="border-b border-border/50">
                        <td className="py-2 pr-4">{ln.line_number}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{ln.characteristic_id.slice(0, 8)}…</td>
                        <td className="py-2 pr-4">
                          {ln.measured_value ?? ln.measured_text ?? "—"}
                        </td>
                        <td className="py-2 pr-4">{textOrDash(ln.pass_fail)}</td>
                        <td className="py-2">{textOrDash(ln.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canEditChecklist ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Checklist is complete. You can still add more lines below if needed.
                </p>
              ) : null}
            </ModuleDetailSection>
          ) : null}

          {canEditChecklist ? (
            <ModuleDetailSection title={row.lines?.length ? "Add more checklist lines" : "Add checklist lines"}>
              {!row.inspection_plan_id ? (
                <div className="rounded-lg border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  This IQC has no inspection plan. Create a new IQC with an active plan, or link characteristics first under{" "}
                  <Link href="/quality/plans" className="font-medium underline underline-offset-2">
                    Quality → Plans
                  </Link>
                  .
                </div>
              ) : planChars.length === 0 ? (
                <div className="rounded-lg border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  Plan has no characteristics.{" "}
                  <Link
                    href={`/quality/characteristics/new?plan_id=${row.inspection_plan_id}`}
                    className="font-medium underline underline-offset-2"
                  >
                    Add characteristic
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Required before <strong>Complete</strong>. Add a characteristic, fill Measured / Text / Pass-Fail, then save.
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-[220px] flex-1 space-y-1">
                      <span className="text-xs text-muted-foreground">Characteristic</span>
                      <select
                        value={selectedCharId}
                        onChange={(e) => setSelectedCharId(e.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Select…</option>
                        {planChars
                          .filter((c) => !draftLines.some((d) => d.characteristic_id === c.id))
                          .filter((c) => !(row.lines ?? []).some((l) => l.characteristic_id === c.id))
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.characteristic_name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Button type="button" size="sm" variant="outline" disabled={!selectedCharId} onClick={addDraftLine}>
                      Add row
                    </Button>
                  </div>
                  {draftLines.length > 0 ? (
                    <div className="erp-scroll overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-[560px] text-left text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase">
                            <th className="px-3 py-2">Characteristic</th>
                            <th className="px-3 py-2">Measured</th>
                            <th className="px-3 py-2">Text</th>
                            <th className="px-3 py-2">Pass/Fail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {draftLines.map((ln, idx) => (
                            <tr key={ln.characteristic_id} className="border-b border-border/50">
                              <td className="px-3 py-2">{ln.characteristic_name}</td>
                              <td className="px-3 py-2">
                                <input
                                  value={ln.measured_value}
                                  onChange={(e) =>
                                    setDraftLines((rows) =>
                                      rows.map((r, i) => (i === idx ? { ...r, measured_value: e.target.value } : r)),
                                    )
                                  }
                                  className="h-8 w-full rounded border border-input bg-background px-2 text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  value={ln.measured_text}
                                  onChange={(e) =>
                                    setDraftLines((rows) =>
                                      rows.map((r, i) => (i === idx ? { ...r, measured_text: e.target.value } : r)),
                                    )
                                  }
                                  className="h-8 w-full rounded border border-input bg-background px-2 text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={ln.pass_fail}
                                  onChange={(e) =>
                                    setDraftLines((rows) =>
                                      rows.map((r, i) => (i === idx ? { ...r, pass_fail: e.target.value } : r)),
                                    )
                                  }
                                  className="h-8 rounded border border-input bg-background px-2 text-sm"
                                >
                                  <option value="">—</option>
                                  <option value="pass">Pass</option>
                                  <option value="fail">Fail</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || draftLines.length === 0}
                    onClick={() => void onSaveChecklistLines()}
                  >
                    Save checklist lines
                  </Button>
                </div>
              )}
            </ModuleDetailSection>
          ) : null}
        </div>
      ) : null}
    </ModuleDetailPage>
  );
}

function NextStepPanel({
  step,
  busy,
  onPrimaryAction,
}: {
  step: NextStep;
  busy: boolean;
  onPrimaryAction: (action: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card px-4 py-3.5 shadow-sm">
      <p className="text-sm font-medium tracking-tight text-foreground">{step.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {step.primaryAction ? (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            className="cursor-pointer"
            onClick={() => onPrimaryAction(step.primaryAction!)}
          >
            {step.primaryLabel}
            <ArrowRight className="size-3.5" />
          </Button>
        ) : step.primaryHref ? (
          <Link
            href={step.primaryHref}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
          >
            {step.primaryLabel}
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
        {step.secondaryHref && step.secondaryLabel ? (
          <Link
            href={step.secondaryHref}
            className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-background px-3 text-sm font-medium transition-colors duration-200 hover:bg-muted"
          >
            {step.secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function QtyInput({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <input
        type="number"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={`h-9 w-full rounded-md border bg-background px-3 text-sm ${
          error ? "border-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30" : "border-input"
        }`}
      />
    </label>
  );
}
