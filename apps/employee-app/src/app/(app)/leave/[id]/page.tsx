"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import { IconCalendar, IconCheck, IconClose, IconClock } from "@/components/icons";
import { AlertBox } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssLeaveRequest, EssLeaveType } from "@/types/api";
import { leaveStatusDisplay } from "@/utils/leave-status";
import * as ui from "@/theme/classes";

export default function LeaveDetailsPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<EssLeaveRequest | null>(null);
  const [typeName, setTypeName] = useState("Leave");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    Promise.all([essService.leaveRequest(params.id), essService.leaveTypes()])
      .then(([req, types]) => {
        setRow(req.data);
        const name =
          (types.data ?? []).find((t: EssLeaveType) => t.id === req.data?.leave_type_id)
            ?.leave_type_name ?? "Leave";
        setTypeName(name);
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load leave details",
        ),
      );
  }, [params.id]);

  const status = (row?.status ?? "").toLowerCase();
  const approved = status === "approved";
  const managerApproved = status === "manager_approved";
  const rejected = status === "rejected" || status === "cancelled";
  const pending = status === "submitted" || status === "draft" || status === "pending";
  const canCancel =
    !approved &&
    !rejected &&
    (pending || managerApproved);

  async function onCancel() {
    if (!params.id || !canCancel) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await essService.cancelLeaveRequest(params.id);
      setRow(res.data);
      setMessage("Leave request cancelled.");
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Could not cancel leave",
      );
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-5">
      <SubHeader title="Leave Details" backHref="/leave/history" />

      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <AlertBox tone="success">{message}</AlertBox> : null}

      {row ? (
        <>
          <section className={`${ui.card} space-y-2 p-5`}>
            <span className="inline-flex rounded-full bg-[#2563eb] px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
              {typeName}
            </span>
            <h2 className="text-2xl font-bold text-[#0b1c30]">
              {formatRange(row.start_date, row.end_date)}
            </h2>
            <p className="flex items-center gap-1.5 text-sm text-[#434655]">
              <IconClock size={14} />
              {row.days_count} Working Day
              {Number(row.days_count) === 1 ? "" : "s"}
            </p>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <div className={`${ui.card} p-4`}>
              <p className="text-xs text-[#434655]">Applied Date</p>
              <p className="mt-1 font-semibold text-[#0b1c30]">
                {formatDate(row.start_date)}
              </p>
            </div>
            <div className={`${ui.card} p-4`}>
              <p className="text-xs text-[#434655]">Status</p>
              <p
                className={`mt-1 flex items-center gap-1.5 font-semibold ${
                  approved || managerApproved
                    ? "text-[#10B981]"
                    : pending
                      ? "text-amber-600"
                      : "text-[#ba1a1a]"
                }`}
              >
                {approved ? <IconCheck size={16} /> : null}
                {leaveStatusDisplay(row.status)}
                {managerApproved ? " · with HR" : ""}
              </p>
            </div>
          </div>

          <section>
            <h3 className="mb-3 text-lg font-semibold text-[#0b1c30]">
              Approval Timeline
            </h3>
            <div className={`${ui.card} p-5`}>
              <ol className="relative space-y-0">
                <span
                  aria-hidden
                  className="absolute bottom-3 left-[13px] top-3 w-0.5 bg-[#d7deef]"
                />
                <TimelineStep
                  title="Applied"
                  subtitle="Leave request submitted"
                  state="done"
                />
                <TimelineStep
                  title={
                    rejected && !managerApproved && !approved
                      ? "Manager rejected"
                      : managerApproved || approved
                        ? "Manager approved"
                        : "Manager review"
                  }
                  subtitle={
                    managerApproved || approved
                      ? "Sent to HR for final approval"
                      : pending
                        ? "Waiting for your manager"
                        : rejected && !managerApproved
                          ? "Request declined by manager"
                          : "Pending"
                  }
                  state={
                    managerApproved || approved
                      ? "done"
                      : rejected && !managerApproved
                        ? "rejected"
                        : pending
                          ? "active"
                          : "todo"
                  }
                />
                <TimelineStep
                  title={
                    approved
                      ? "HR approved"
                      : rejected && managerApproved
                        ? "HR rejected"
                        : "HR review"
                  }
                  subtitle={
                    approved
                      ? "Leave finalized"
                      : managerApproved
                        ? "Waiting for HR"
                        : "After manager approval"
                  }
                  state={
                    approved
                      ? "done"
                      : rejected && managerApproved
                        ? "rejected"
                        : managerApproved
                          ? "active"
                          : "todo"
                  }
                  last
                />
              </ol>
            </div>
          </section>

          {row.reason ? (
            <section>
              <h3 className="mb-3 text-lg font-semibold text-[#0b1c30]">
                Reason
              </h3>
              <div className={`${ui.card} border-l-4 border-l-[#2563eb] p-4`}>
                <p className="italic text-[#434655]">“{row.reason}”</p>
              </div>
            </section>
          ) : null}

          {canCancel ? (
            <>
              <button
                type="button"
                disabled={cancelling}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#c3c6d7]/50 bg-[#eff4ff] px-4 py-3 font-semibold text-[#ba1a1a] transition active:scale-[0.98] disabled:opacity-60"
                onClick={() => void onCancel()}
              >
                <IconClose size={16} />
                {cancelling ? "Cancelling…" : "Cancel Leave Request"}
              </button>
              <p className="text-center text-xs text-[#434655]">
                You can cancel before HR final approval. Approved leave cannot be
                cancelled from the app.
              </p>
            </>
          ) : null}

          <Link
            href="/leave/history"
            className="block text-center text-sm font-semibold text-[#004ac6]"
          >
            Back to Leave History
          </Link>
        </>
      ) : !error ? (
        <div className={`${ui.card} flex items-center gap-3 p-6 text-[#434655]`}>
          <IconCalendar size={20} /> Loading…
        </div>
      ) : null}
    </div>
  );
}

function TimelineStep({
  title,
  subtitle,
  state,
  last,
}: {
  title: string;
  subtitle: string;
  state: "done" | "active" | "todo" | "rejected";
  last?: boolean;
}) {
  const done = state === "done";
  const active = state === "active";
  const rejected = state === "rejected";
  return (
    <li className={`relative z-[1] flex gap-3 ${last ? "pb-0" : "pb-6"}`}>
      <div className="relative z-[1] flex w-7 shrink-0 justify-center">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
            done
              ? "border-[#2563eb] bg-[#2563eb] text-white"
              : active
                ? "border-[#2563eb] bg-white text-[#2563eb] shadow-[0_0_0_4px_rgba(37,99,235,0.15)]"
                : rejected
                  ? "border-[#ba1a1a] bg-[#ffdad6] text-[#ba1a1a]"
                  : "border-[#c3c6d7] bg-white text-[#94a3b8]"
          }`}
        >
          {done ? (
            <IconCheck size={14} />
          ) : rejected ? (
            <IconClose size={12} />
          ) : active ? (
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#2563eb]" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-[#c3c6d7]" />
          )}
        </span>
      </div>
      <div className="min-w-0 pt-0.5">
        <p
          className={`font-semibold leading-6 ${
            rejected ? "text-[#ba1a1a]" : "text-[#0b1c30]"
          }`}
        >
          {title}
        </p>
        <p className="mt-0.5 text-sm leading-5 text-[#64748B]">{subtitle}</p>
      </div>
    </li>
  );
}

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRange(start: string, end: string) {
  const s = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  if (start === end) return s.toLocaleDateString(undefined, opts);
  return `${s.toLocaleDateString(undefined, opts)} - ${e.toLocaleDateString(undefined, opts)}`;
}
