"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SubHeader } from "@/components/app-header";
import { IconEdit, IconLocation, IconUser } from "@/components/icons";
import { AlertBox, Avatar } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMe } from "@/types/api";
import * as ui from "@/theme/classes";

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
              {me.designation} • ID: {me.employee_code}
            </p>
          </section>

          <Card title="Bio Data" icon={<IconUser size={18} />} iconBg="bg-[#dbe1ff] text-[#004ac6]">
            <Row label="Date of Birth" value="June 12, 1994" />
            <Row label="Gender" value="—" />
            <Row label="Nationality" value="India" />
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
              742 Evergreen Terrace, Bengaluru, KA 560001
            </p>
            <div className="mt-3 flex h-28 items-center justify-center rounded-xl bg-[#eff4ff] text-sm text-[#434655]">
              Map preview
            </div>
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
                <p className="font-semibold text-[#0b1c30]">{me.email}</p>
              </div>
              <div className="rounded-xl bg-[#eff4ff] px-3 py-3 text-sm">
                <p className="text-[10px] font-bold uppercase text-[#434655]">
                  Personal Mobile
                </p>
                <p className="font-semibold text-[#0b1c30]">{me.mobile}</p>
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
            Last updated on {me.date_of_joining}
          </p>
        </>
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
      <div className="flex items-center gap-2">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}
        >
          {icon}
        </span>
        <h3 className="text-lg font-semibold text-[#0b1c30]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#c3c6d7]/20 py-2.5 text-sm last:border-0">
      <span className="text-[#434655]">{label}</span>
      <span className="font-semibold text-[#0b1c30]">{value}</span>
    </div>
  );
}
