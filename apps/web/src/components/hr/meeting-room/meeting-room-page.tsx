"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ClipboardList, DoorOpen, Users, X } from "lucide-react";

import {
  HrAuthBanner,
  HrEmptyState,
  HrStatusBadge,
  HrUnderlineTabs,
  type HrTabItem,
} from "@/components/hr/hr-primitives";
import { MeetingRoomMasterPanel } from "@/components/hr/setup/setup-center";
import {
  SetupField,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isAuthenticated } from "@/lib/auth";
import { ApiClientError } from "@/services/api-client";
import {
  decideMeetingRequest,
  loadTrainingDirectory,
  type TrainingDirectory,
} from "@/services/training-management-service";
import type { TrainingRequest } from "@/types/training-management";

type Tab = "rooms" | "requests";

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function formatTimeRange(start: string | null | undefined, end: string | null | undefined) {
  const s = formatTime(start);
  const e = formatTime(end);
  if (s && e) return `${s}–${e}`;
  if (s) return s;
  if (e) return e;
  return "—";
}

function canDecideRequest(status: TrainingRequest["status"]) {
  return status === "submitted" || status === "draft";
}

export function MeetingRoomPage() {
  const [dir, setDir] = useState<TrainingDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("rooms");
  const [detail, setDetail] = useState<TrainingRequest | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDir(await loadTrainingDirectory());
    } catch {
      toast("Failed to load meeting room data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleQuickDecide = useCallback(
    async (requestId: string, action: "approve" | "reject") => {
      setDecidingId(requestId);
      try {
        await decideMeetingRequest(requestId, action, "");
        toast(action === "approve" ? "Request approved" : "Request rejected", "success");
        void load();
      } catch (e) {
        toast(e instanceof ApiClientError ? e.message : "Action failed", "error");
      } finally {
        setDecidingId(null);
      }
    },
    [load],
  );

  const requests = dir?.requests ?? [];
  const authBlocked = !isAuthenticated() && !loading && !dir;
  const pendingRequests = requests.filter((r) => r.status === "submitted").length;
  const meetingTabs: HrTabItem[] = [
    { id: "rooms", label: "Rooms", icon: DoorOpen },
    { id: "requests", label: "Meeting Requests", icon: ClipboardList, badge: pendingRequests || undefined },
  ];

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader title="Meeting Room" />

      {authBlocked ? <HrAuthBanner /> : null}

      <HrUnderlineTabs tabs={meetingTabs} value={tab} onChange={(id) => setTab(id as Tab)} />

      {tab === "rooms" ? <MeetingRoomMasterPanel /> : null}

      {tab === "requests" ? (
        loading && !dir ? (
          <EmsSkeleton />
        ) : !requests.length ? (
          <HrEmptyState title="No meeting requests" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 backdrop-blur-sm text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {["Title", "Type", "Date", "Time", "Host", "Room", "Attendees", "Status"].map((h) => (
                      <th
                        key={h}
                        className={cn(
                          "px-4 py-3 font-medium",
                          h === "Attendees" && "w-[88px] text-center",
                          h === "Status" && "w-[120px]",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-b border-border/40 transition-colors last:border-b-0 hover:bg-muted/30"
                      onClick={() => setDetail(r)}
                    >
                      <td className="px-4 py-3 text-sm font-medium">{r.title}</td>
                      <td className="px-4 py-3 text-sm capitalize text-muted-foreground">{r.requestType}</td>
                      <td className="px-4 py-3 text-sm tabular-nums">{r.requestDate}</td>
                      <td className="px-4 py-3 text-sm tabular-nums">{formatTimeRange(r.startTime, r.endTime)}</td>
                      <td className="px-4 py-3 text-sm">{r.hostName || "—"}</td>
                      <td className="px-4 py-3 text-sm">{r.roomName || "—"}</td>
                      <td className="px-4 py-3 text-center text-sm tabular-nums">{r.attendees.length}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {canDecideRequest(r.status) ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="size-7 cursor-pointer text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                              disabled={decidingId === r.id}
                              aria-label="Approve request"
                              onClick={() => void handleQuickDecide(r.id, "approve")}
                            >
                              <Check className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="size-7 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={decidingId === r.id}
                              aria-label="Reject request"
                              onClick={() => void handleQuickDecide(r.id, "reject")}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <HrStatusBadge status={r.status} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : null}

      <RequestDetailModal
        open={Boolean(detail)}
        request={detail}
        onClose={() => setDetail(null)}
        onSaved={() => {
          setDetail(null);
          void load();
        }}
      />
    </div>
  );
}

function RequestDetailModal({
  open,
  request,
  onClose,
  onSaved,
}: {
  open: boolean;
  request: TrainingRequest | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNotes("");
    setBusy(false);
  }, [open, request]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !request) return null;

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    try {
      await decideMeetingRequest(request!.id, action, notes);
      toast(action === "approve" ? "Request approved" : "Request rejected", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Action failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="meeting-detail-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div className="min-w-0">
            <h2 id="meeting-detail-title" className="truncate text-base font-semibold tracking-tight">
              {request.title}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">{request.requestType}</span>
              <span>·</span>
              <HrStatusBadge status={request.status} />
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer shrink-0"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="erp-scroll flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Date" value={request.requestDate} />
            <DetailField
              label="Time"
              value={formatTimeRange(request.startTime, request.endTime)}
            />
            <DetailField label="Host" value={request.hostName || "—"} />
            <DetailField label="Room" value={request.roomName || "—"} />
          </div>

          {request.isRecurring ? (
            <p className="text-xs text-muted-foreground">Repeats {request.recurrenceRule}</p>
          ) : null}

          <DetailField label="Agenda" value={request.agenda || "—"} />

          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="size-3.5" />
              Attendees ({request.attendees.length})
            </h4>
            <ul className="space-y-1.5">
              {request.attendees.map((a) => (
                <li
                  key={a.employeeId}
                  className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs"
                >
                  {a.employeeName}{" "}
                  <span className="font-mono text-[10px] text-muted-foreground">{a.employeeCode}</span>
                </li>
              ))}
              {!request.attendees.length ? (
                <li className="text-xs text-muted-foreground">No attendees listed</li>
              ) : null}
            </ul>
          </div>

          {canDecideRequest(request.status) ? (
            <SetupField label="Approval notes">
              <SetupTextarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </SetupField>
          ) : null}

          {request.approvalNotes ? (
            <p className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Decision notes: {request.approvalNotes}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 px-5 py-4">
          {canDecideRequest(request.status) ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={busy}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="cursor-pointer"
                disabled={busy}
                onClick={() => void decide("reject")}
              >
                <X className="size-3.5" />
                Reject
              </Button>
              <Button
                type="button"
                size="sm"
                className="cursor-pointer"
                disabled={busy}
                onClick={() => void decide("approve")}
              >
                <Check className="size-3.5" />
                Approve
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/15 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}
