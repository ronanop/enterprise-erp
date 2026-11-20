"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { SubHeader } from "@/components/app-header";
import { IconEdit, IconLocation, IconUser } from "@/components/icons";
import { AlertBox, Avatar } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMe, EssProfileUpdateRequest } from "@/types/api";
import * as ui from "@/theme/classes";
import { formatDisplayDateDDMMYYYY } from "@/utils/datetime";

function display(value: string | null | undefined, fallback = "—"): string {
  const text = value?.trim();
  return text ? text : fallback;
}

function titleCase(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  return text
    .split(/[\s_]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export default function PersonalInformationPage() {
  const [me, setMe] = useState<EssMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<EssProfileUpdateRequest | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const res = await essService.listDetailUpdateRequests();
      const rows = Array.isArray(res.data) ? res.data : [];
      setPending(rows.find((r) => r.status === "submitted") ?? null);
    } catch {
      /* non-blocking */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    function load() {
      essService
        .me()
        .then((r) => {
          if (!cancelled) {
            setMe(r.data);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(
              err instanceof ApiClientError
                ? err.message
                : "Failed to load profile",
            );
          }
        });
      void loadRequests();
    }
    load();
    function onVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadRequests]);

  async function submitUpdateRequest() {
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await essService.createDetailUpdateRequest({
        notes: notes.trim() || undefined,
      });
      setPending(res.data ?? null);
      setNotes("");
      setMessage(
        res.message || "Update request submitted for HR review",
      );
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to submit update request",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <SubHeader title="Personal Information" backHref="/profile" />

      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <AlertBox tone="success">{message}</AlertBox> : null}

      {me ? (
        <>
          <section className="flex flex-col items-center text-center">
            <div className="relative">
              <Avatar
                name={me.display_name}
                size="xl"
                ring
                photoUrl={me.photo_url}
              />
              <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-md">
                <IconEdit size={14} />
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-bold text-[#0b1c30]">
              {me.display_name}
            </h2>
            <p className="mt-1 text-sm text-[#434655]">
              {display(me.designation)} • ID: {me.employee_code}
            </p>
            {me.company_name || me.branch_name ? (
              <p className="mt-1 text-xs text-[#737686]">
                {[me.company_name, me.branch_name, me.department_name]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </section>

          <Card
            title="Bio Data"
            icon={<IconUser size={18} />}
            iconBg="bg-[#dbe1ff] text-[#004ac6]"
          >
            <Row
              label="Date of Birth"
              value={
                me.date_of_birth
                  ? formatDisplayDateDDMMYYYY(me.date_of_birth)
                  : "—"
              }
            />
            <Row label="Gender" value={display(titleCase(me.gender))} />
            <Row label="Marital Status" value={display(titleCase(me.marital_status))} />
            <Row label="Nationality" value={display(titleCase(me.nationality))} />
            <Row label="Blood Group" value={display(me.blood_group)} />
            <Row label="Date of Joining" value={formatDisplayDateDDMMYYYY(me.date_of_joining)} />
            <Row label="Manager" value={display(me.manager_name)} />
          </Card>

          <Card
            title="Residential"
            icon={<IconLocation size={18} />}
            iconBg="bg-[#eaddff] text-[#712ae2]"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#434655]">
              Current Address
            </p>
            <p className="mt-1 font-semibold text-[#0b1c30]">
              {display(me.current_address)}
            </p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-[#434655]">
              Permanent Address
            </p>
            <p className="mt-1 font-semibold text-[#0b1c30]">
              {display(me.permanent_address)}
            </p>
          </Card>

          <Card
            title="Contact Channels"
            icon={<span className="text-lg">@</span>}
            iconBg="bg-emerald-100 text-emerald-700"
          >
            <div className="space-y-2">
              <div className="rounded-xl bg-[#eff4ff] px-3 py-3 text-sm">
                <p className="text-[10px] font-bold uppercase text-[#434655]">
                  Work Email
                </p>
                <p className="font-semibold text-[#0b1c30]">{display(me.email)}</p>
              </div>
              <div className="rounded-xl bg-[#eff4ff] px-3 py-3 text-sm">
                <p className="text-[10px] font-bold uppercase text-[#434655]">
                  Personal Mobile
                </p>
                <p className="font-semibold text-[#0b1c30]">{display(me.mobile)}</p>
              </div>
            </div>
          </Card>

          <section className={`${ui.card} space-y-3 p-4`}>
            <h3 className="text-base font-bold text-[#0b1c30]">
              Request Detail Update
            </h3>
            <p className="text-xs text-[#434655]">
              Tell HR what needs correcting. Your request appears in the HR
              Employee Requests inbox.
            </p>
            {pending ? (
              <AlertBox tone="success">
                Request pending HR review
                {pending.notes ? ` — ${pending.notes}` : ""}.
              </AlertBox>
            ) : (
              <textarea
                className={`${ui.input} min-h-[88px] w-full resize-y`}
                placeholder="e.g. Update current address / mobile number / blood group…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
              />
            )}
            <button
              type="button"
              className={`${ui.btn} w-full`}
              disabled={submitting || Boolean(pending)}
              onClick={() => void submitUpdateRequest()}
            >
              {submitting
                ? "Submitting…"
                : pending
                  ? "Awaiting HR"
                  : "Request Detail Update"}
            </button>
          </section>
          <p className="text-center text-xs text-[#434655]">
            Synced from HRMS · Joined {formatDisplayDateDDMMYYYY(me.date_of_joining)}
          </p>
        </>
      ) : !error ? (
        <div className={`${ui.card} p-8 text-center text-sm text-[#434655]`}>
          Loading personal details…
        </div>
      ) : null}
    </div>
  );
}

function Card({
  title,
  icon,
  iconBg,
  children,
}: {
  title: string;
  icon: ReactNode;
  iconBg: string;
  children: ReactNode;
}) {
  return (
    <section className={`${ui.card} space-y-3 p-4`}>
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}
        >
          {icon}
        </span>
        <h3 className="text-base font-bold text-[#0b1c30]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-[#c3c6d7]/25 py-2.5 first:border-t-0 first:pt-0">
      <span className="text-xs font-medium text-[#737686]">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-semibold text-[#0b1c30]">
        {value}
      </span>
    </div>
  );
}
