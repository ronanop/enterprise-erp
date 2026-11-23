"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, ShoppingBag } from "lucide-react";

import { HrStatusBadge } from "@/components/hr/hr-primitives";
import { EmployeeSelect } from "@/components/hr/shared/employee-select";
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
import {
  loadHrMasterDirectory,
  type HrMasterOption,
} from "@/services/hr-master-connector";
import {
  createRequisition,
  GIFT_CATEGORY_OPTIONS,
  GIFT_RECIPIENT_TYPE_OPTIONS,
  giftCategoryLabel,
  giftRecipientTypeLabel,
  listRequisitions,
  REQUISITION_ITEM_OPTIONS,
  requisitionItemLabel,
  T_SHIRT_SIZE_OPTIONS,
  updateRequisitionStatus,
  type AdminRequisition,
  type GiftCategory,
  type GiftRecipientType,
  type RequisitionItemType,
  type RequisitionStatus,
  type TShirtSize,
} from "@/services/it-admin-requisition-service";
import type { EmployeeRecord } from "@/types/employee-management";

type Autofill = {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  email: string;
  department: string;
  designation: string;
  dateOfBirth: string;
  companyName: string;
  branchName: string;
};

const EMPTY_AUTOFILL: Autofill = {
  employeeId: "",
  employeeName: "",
  employeeCode: "",
  email: "",
  department: "",
  designation: "",
  dateOfBirth: "",
  companyName: "",
  branchName: "",
};

function drawerTitle(type: RequisitionItemType): string {
  switch (type) {
    case "id_card":
      return "New ID card request";
    case "visiting_card":
      return "New visiting card request";
    case "t_shirt":
      return "New t-shirt request";
    case "gift":
      return "New gift request";
  }
}

function drawerDescription(type: RequisitionItemType): string {
  switch (type) {
    case "id_card":
      return "Select an employee — department, emp code, designation, and DOB fill automatically.";
    case "visiting_card":
      return "Select an employee — company and print details fill automatically.";
    case "t_shirt":
      return "Choose size and quantity for company branded apparel.";
    case "gift":
      return "Capture gift category, recipient, and occasion details.";
  }
}

export function ItAdminRequisitionPage() {
  const [rows, setRows] = useState<AdminRequisition[]>([]);
  const [employees, setEmployees] = useState<HrMasterOption[]>([]);
  const [recordsById, setRecordsById] = useState<Record<string, EmployeeRecord>>({});
  const [departments, setDepartments] = useState<HrMasterOption[]>([]);
  const [open, setOpen] = useState(false);
  const [itemType, setItemType] = useState<RequisitionItemType>("id_card");
  const [autofill, setAutofill] = useState<Autofill>(EMPTY_AUTOFILL);
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [tShirtSize, setTShirtSize] = useState<TShirtSize | "">("");
  const [giftDepartment, setGiftDepartment] = useState("");
  const [giftCategory, setGiftCategory] = useState<GiftCategory | "">("");
  const [recipientType, setRecipientType] = useState<GiftRecipientType | "">("");
  const [recipientName, setRecipientName] = useState("");
  const [purpose, setPurpose] = useState("");

  const reload = useCallback(() => {
    setRows(listRequisitions());
  }, []);

  useEffect(() => {
    reload();
    void loadHrMasterDirectory()
      .then((dir) => {
        setEmployees(dir.employees);
        setDepartments(dir.departments);
        const map: Record<string, EmployeeRecord> = {};
        for (const r of dir.records) map[r.id] = r;
        setRecordsById(map);
      })
      .catch(() => undefined);
  }, [reload]);

  const resetForm = useCallback((type: RequisitionItemType) => {
    setItemType(type);
    setAutofill(EMPTY_AUTOFILL);
    setQuantity("1");
    setNotes("");
    setTShirtSize("");
    setGiftDepartment("");
    setGiftCategory("");
    setRecipientType("");
    setRecipientName("");
    setPurpose("");
  }, []);

  function openCreate(type: RequisitionItemType = "id_card") {
    resetForm(type);
    setOpen(true);
  }

  function applyEmployee(id: string, option?: HrMasterOption) {
    if (!id || !option) {
      setAutofill(EMPTY_AUTOFILL);
      return;
    }
    const record = recordsById[id];
    setAutofill({
      employeeId: id,
      employeeName: option.label.split(" · ")[0] || record?.displayName || "",
      employeeCode: option.code || record?.employeeCode || "",
      email: option.email || record?.officialEmail || "",
      department: option.department || record?.departmentName || "",
      designation: option.designation || record?.designationName || "",
      dateOfBirth: (record?.extension?.personal?.dateOfBirth || "").slice(0, 10),
      companyName: option.companyName || record?.companyName || "",
      branchName: option.branchName || record?.branchName || "",
    });
  }

  function submit() {
    if (itemType === "id_card" || itemType === "visiting_card") {
      if (!autofill.employeeId) {
        toast("Select an employee", "error");
        return;
      }
    }

    if (itemType === "t_shirt") {
      if (!tShirtSize) {
        toast("Select a t-shirt size", "error");
        return;
      }
    }

    if (itemType === "gift") {
      if (!giftDepartment.trim()) {
        toast("Department is required", "error");
        return;
      }
      if (!giftCategory) {
        toast("Select a gift category", "error");
        return;
      }
      if (!recipientType) {
        toast("Select a recipient type", "error");
        return;
      }
      if (!recipientName.trim()) {
        toast("Recipient name is required", "error");
        return;
      }
      if (!purpose.trim()) {
        toast("Purpose / occasion is required", "error");
        return;
      }
    }

    const employeeName =
      itemType === "gift"
        ? recipientName.trim()
        : autofill.employeeName || "Employee";

    createRequisition({
      itemType,
      quantity: Number(quantity) || 1,
      notes,
      employeeId: autofill.employeeId,
      employeeName,
      employeeCode: autofill.employeeCode,
      email: autofill.email,
      department: itemType === "gift" ? giftDepartment : autofill.department,
      designation: autofill.designation,
      dateOfBirth: autofill.dateOfBirth,
      companyName: autofill.companyName,
      branchName: autofill.branchName,
      tShirtSize: itemType === "t_shirt" ? tShirtSize : "",
      giftCategory: itemType === "gift" ? giftCategory : "",
      recipientType: itemType === "gift" ? recipientType : "",
      recipientName: itemType === "gift" ? recipientName.trim() : "",
      purpose: itemType === "gift" ? purpose.trim() : "",
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

  const listMeta = useMemo(
    () =>
      rows.map((r) => {
        const bits: string[] = [];
        if (r.employeeName) bits.push(r.employeeName);
        if (r.employeeCode) bits.push(r.employeeCode);
        if (r.department) bits.push(r.department);
        if (r.itemType === "t_shirt" && r.tShirtSize) bits.push(`Size ${r.tShirtSize}`);
        if (r.itemType === "gift") {
          if (r.giftCategory) bits.push(giftCategoryLabel(r.giftCategory));
          if (r.recipientType) bits.push(giftRecipientTypeLabel(r.recipientType));
          if (r.purpose) bits.push(r.purpose);
        }
        if (r.itemType === "visiting_card" && r.companyName) bits.push(r.companyName);
        bits.push(r.createdAt.slice(0, 10));
        return { id: r.id, text: bits.join(" · ") };
      }),
    [rows],
  );
  const metaById = useMemo(() => Object.fromEntries(listMeta.map((m) => [m.id, m.text])), [listMeta]);

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Requisition"
        description="Employees can request ID cards, visiting cards, t-shirts, and gifts."
        actions={
          <Button type="button" size="sm" className="cursor-pointer gap-1" onClick={() => openCreate()}>
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
            className="cursor-pointer rounded-xl border border-border/70 bg-card p-3 text-left shadow-sm transition-colors duration-150 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => openCreate(opt.value)}
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
                  <p className="text-[10px] text-muted-foreground">{metaById[r.id]}</p>
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
        title={drawerTitle(itemType)}
        description={drawerDescription(itemType)}
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
          {(itemType === "id_card" || itemType === "visiting_card") && (
            <>
              <EmployeeSelect
                label="Employee"
                value={autofill.employeeId}
                options={employees}
                required
                onChange={applyEmployee}
              />
              {itemType === "id_card" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <SetupField label="Department">
                    <SetupInput value={autofill.department} readOnly className="bg-muted/40" />
                  </SetupField>
                  <SetupField label="Emp code">
                    <SetupInput value={autofill.employeeCode} readOnly className="bg-muted/40" />
                  </SetupField>
                  <SetupField label="Designation">
                    <SetupInput value={autofill.designation} readOnly className="bg-muted/40" />
                  </SetupField>
                  <SetupField label="Date of birth">
                    <SetupInput value={autofill.dateOfBirth} readOnly className="bg-muted/40" />
                  </SetupField>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <SetupField label="Company">
                    <SetupInput value={autofill.companyName} readOnly className="bg-muted/40" />
                  </SetupField>
                  <SetupField label="Branch">
                    <SetupInput value={autofill.branchName} readOnly className="bg-muted/40" />
                  </SetupField>
                  <SetupField label="Designation">
                    <SetupInput value={autofill.designation} readOnly className="bg-muted/40" />
                  </SetupField>
                  <SetupField label="Email">
                    <SetupInput value={autofill.email} readOnly className="bg-muted/40" />
                  </SetupField>
                  <SetupField label="Emp code">
                    <SetupInput value={autofill.employeeCode} readOnly className="bg-muted/40" />
                  </SetupField>
                  <SetupField label="Department">
                    <SetupInput value={autofill.department} readOnly className="bg-muted/40" />
                  </SetupField>
                </div>
              )}
              <SetupField label="Quantity" required>
                <SetupInput
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </SetupField>
              <SetupField label="Notes">
                <SetupTextarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Delivery notes, special instructions…"
                />
              </SetupField>
            </>
          )}

          {itemType === "t_shirt" && (
            <>
              <EmployeeSelect
                label="Employee (optional)"
                value={autofill.employeeId}
                options={employees}
                onChange={applyEmployee}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <SetupField label="T-shirt size" required>
                  <SetupSelect
                    value={tShirtSize}
                    onChange={(e) => setTShirtSize(e.target.value as TShirtSize | "")}
                  >
                    <option value="">Select size…</option>
                    {T_SHIRT_SIZE_OPTIONS.map((o) => (
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
              </div>
              <SetupField label="Notes">
                <SetupTextarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Fit preference, colour, delivery notes…"
                />
              </SetupField>
            </>
          )}

          {itemType === "gift" && (
            <>
              <SetupField label="Department" required>
                {departments.length > 0 ? (
                  <SetupSelect
                    value={giftDepartment}
                    onChange={(e) => setGiftDepartment(e.target.value)}
                  >
                    <option value="">Select department…</option>
                    {departments.map((d) => (
                      <option key={d.id || d.label} value={d.label}>
                        {d.label}
                      </option>
                    ))}
                  </SetupSelect>
                ) : (
                  <SetupInput
                    value={giftDepartment}
                    onChange={(e) => setGiftDepartment(e.target.value)}
                    placeholder="Department name"
                  />
                )}
              </SetupField>
              <SetupField label="Gift category" required>
                <SetupSelect
                  value={giftCategory}
                  onChange={(e) => setGiftCategory(e.target.value as GiftCategory | "")}
                >
                  <option value="">Select category…</option>
                  {GIFT_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Recipient type" required>
                <SetupSelect
                  value={recipientType}
                  onChange={(e) => setRecipientType(e.target.value as GiftRecipientType | "")}
                >
                  <option value="">Select type…</option>
                  {GIFT_RECIPIENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Recipient name" required>
                <SetupInput
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Who receives the gift"
                />
              </SetupField>
              <SetupField label="Purpose / occasion" required>
                <SetupTextarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={3}
                  placeholder="Welcome, Diwali, appreciation, event name…"
                />
              </SetupField>
              <SetupField label="Quantity" required>
                <SetupInput
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </SetupField>
              <SetupField label="Notes">
                <SetupTextarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional delivery or packaging notes"
                />
              </SetupField>
            </>
          )}
        </div>
      </SetupDrawer>
    </div>
  );
}
