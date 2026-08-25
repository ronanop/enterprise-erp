"use client";

import { useEffect, useState } from "react";
import { Plane, Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { SetupToastHost, toast } from "@/components/hr/setup/setup-toast";
import { HrStatusBadge } from "@/components/hr/hr-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TravelRequest = {
  id: string;
  employeeName: string;
  destination: string;
  fromDate: string;
  toDate: string;
  purpose: string;
  status: "submitted" | "approved" | "booked" | "rejected";
  createdAt: string;
};

const KEY = "erp_it_admin_travel_v1";

function load(): TravelRequest[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TravelRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(rows: TravelRequest[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function ItAdminTravelPage() {
  const [rows, setRows] = useState<TravelRequest[]>([]);
  const [employeeName, setEmployeeName] = useState("");
  const [destination, setDestination] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [purpose, setPurpose] = useState("");

  useEffect(() => {
    setRows(load());
  }, []);

  function submit() {
    if (!employeeName.trim() || !destination.trim() || !fromDate || !toDate) {
      toast("Employee, destination, and dates are required", "error");
      return;
    }
    const next: TravelRequest = {
      id: crypto.randomUUID(),
      employeeName: employeeName.trim(),
      destination: destination.trim(),
      fromDate,
      toDate,
      purpose: purpose.trim(),
      status: "submitted",
      createdAt: new Date().toISOString(),
    };
    const list = [next, ...rows];
    save(list);
    setRows(list);
    setEmployeeName("");
    setDestination("");
    setFromDate("");
    setToDate("");
    setPurpose("");
    toast("Travel request submitted");
  }

  function setStatus(id: string, status: TravelRequest["status"]) {
    const list = rows.map((r) => (r.id === id ? { ...r, status } : r));
    save(list);
    setRows(list);
    toast(`Marked ${status}`);
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Travel Desk"
        description="Raise travel requests and track booking status."
      />

      <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">New travel request</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={employeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
            placeholder="Employee name"
            className="h-9"
          />
          <Input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Destination"
            className="h-9"
          />
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-9"
          />
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-9"
          />
          <Input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Purpose (optional)"
            className="h-9 sm:col-span-2"
          />
        </div>
        <Button type="button" className="mt-3 cursor-pointer gap-1" onClick={submit}>
          <Plus className="size-3.5" />
          Submit request
        </Button>
      </section>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 px-4 py-12 text-center text-sm text-muted-foreground">
          <Plane className="mx-auto mb-2 size-6 opacity-50" />
          No travel requests yet.
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
                    {r.employeeName} → {r.destination}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {r.fromDate} to {r.toDate}
                    {r.purpose ? ` · ${r.purpose}` : ""}
                  </p>
                </div>
                <HrStatusBadge status={r.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(["approved", "booked", "rejected"] as const).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="xs"
                    variant="outline"
                    className={cn("cursor-pointer capitalize", r.status === s && "border-primary")}
                    onClick={() => setStatus(r.id, s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
