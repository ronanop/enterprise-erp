"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, ShoppingBag } from "lucide-react";

import { HrStatusBadge } from "@/components/hr/hr-primitives";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { SetupToastHost, toast } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { authService } from "@/services/api-client";
import {
  createRequisition,
  listRequisitions,
  REQUISITION_ITEM_OPTIONS,
  requisitionItemLabel,
  updateRequisitionStatus,
  type AdminRequisition,
  type RequisitionItemType,
  type RequisitionStatus,
} from "@/services/it-admin-requisition-service";

export function ItAdminRequisitionPage() {
  const [rows, setRows] = useState<AdminRequisition[]>([]);
  const [open, setOpen] = useState(false);
  const [itemType, setItemType] = useState<RequisitionItemType>("id_card");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [email, setEmail] = useState("");

  const reload = useCallback(() => {
    setRows(listRequisitions());
  }, []);

  useEffect(() => {
    reload();
    void authService
      .me()
      .then((res) => {
        const d = res.data;
        if (!d) return;
        setEmail(String(d.email ?? ""));
        setEmployeeName(String(d.display_name || d.full_name || ""));
      })
      .catch(() => undefined);
  }, [reload]);

  function openCreate() {
    setItemType("id_card");
    setQuantity("1");
    setNotes("");
    setOpen(true);
  }

  function submit() {
    if (!employeeName.trim()) {
      toast("Employee name is required", "error");
      return;
    }
    createRequisition({
      itemType,
      quantity: Number(quantity) || 1,
      notes,
      employeeName,
      employeeCode,
      email,
    });
    toast("Requisition submitted");
    setOpen(false);
    reload();
  }

  function setStatus(id: string, status: RequisitionStatus) {
    updateRequisitionStatus(id, status);
    toast(`Marked ${status.replace(/_/g, " ")}`);
    reload();
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Requisition"
        description="Employees can request ID cards, visiting cards, t-shirts, and gifts."
        actions={
          <Button type="button" size="sm" className="cursor-pointer gap-1" onClick={openCreate}>
            <Plus className="size-3.5" />
            New request
          </Button>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {REQUISITION_ITEM_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="cursor-pointer rounded-xl border border-border/70 bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/40"
            onClick={() => {
              setItemType(opt.value);
              setOpen(true);
            }}
          >
            <p className="text-sm font-semibold">{opt.label}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{opt.hint}</p>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 px-4 py-12 text-center text-sm text-muted-foreground">
          <ShoppingBag className="mx-auto mb-2 size-6 opacity-50" />
          No requisitions yet. Ask for an ID card, visiting card, t-shirt, or gift.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {requisitionItemLabel(r.itemType)}
                    <span className="text-muted-foreground"> × {r.quantity}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {r.employeeName}
                    {r.employeeCode ? ` · ${r.employeeCode}` : ""}
                    {r.email ? ` · ${r.email}` : ""}
                    {" · "}
                    {r.createdAt.slice(0, 10)}
                  </p>
                  {r.notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>
                  ) : null}
                </div>
                <HrStatusBadge status={r.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(["in_progress", "fulfilled", "rejected"] as const).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="xs"
                    variant="outline"
                    className="cursor-pointer capitalize"
                    onClick={() => setStatus(r.id, s)}
                  >
                    {s.replace(/_/g, " ")}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <SetupDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="New requisition"
        description="Request admin items for an employee."
        footer={
          <>
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="cursor-pointer" onClick={submit}>
              Submit request
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <SetupField label="Item" required>
            <SetupSelect
              value={itemType}
              onChange={(e) => setItemType(e.target.value as RequisitionItemType)}
            >
              {REQUISITION_ITEM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
          <SetupField label="Quantity" required>
            <SetupInput
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </SetupField>
          <SetupField label="Employee name" required>
            <SetupInput
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="Your name"
            />
          </SetupField>
          <SetupField label="Employee code">
            <SetupInput
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              placeholder="Optional"
            />
          </SetupField>
          <SetupField label="Email">
            <SetupInput
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Optional"
            />
          </SetupField>
          <SetupField label="Notes">
            <SetupTextarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Size, quantity details, delivery notes…"
            />
          </SetupField>
        </div>
      </SetupDrawer>
    </div>
  );
}
