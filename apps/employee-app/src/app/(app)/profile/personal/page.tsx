"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SubHeader } from "@/components/app-header";
import { IconEdit, IconLocation, IconUser } from "@/components/icons";
import { AlertBox, Avatar } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMe } from "@/types/api";
import * as ui from "@/theme/classes";
import { formatDisplayDateDDMMYYYY } from "@/utils/datetime";

function display(value: string | null | undefined, fallback = "—"): string {
  const text = value?.trim();
  return text ? text : fallback;
}

export default function PersonalInformationPage() {
  const [me, setMe] = useState<EssMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    essService
      .me()
      .then((r) => setMe(r.data))
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load profile",
        ),
      );
  }, []);

  return (
    <div className="space-y-5">
      <SubHeader title="Personal Information" backHref="/profile" />

      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <AlertBox tone="success">{message}</AlertBox> : null}

      {me ? (
        <>
          <section className="flex flex-col items-center text-center">
            <div className="relative">
              <Avatar name={me.display_name} size="xl" ring />
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
            <Row label="Gender" value={display(me.gender)} />
            <Row label="Marital Status" value={display(me.marital_status)} />
            <Row label="Nationality" value={display(me.nationality)} />
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

          <button
            type="button"
            className={`${ui.btn} w-full`}
            onClick={() => setMessage("Update request submitted for HR review")}
          >
            Request Detail Update
          </button>
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
