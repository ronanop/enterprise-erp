"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NotificationBellLink } from "@/components/notification-bell-link";
import {
  IconBank,
  IconBuilding,
  IconCacheMark,
  IconCalendar,
  IconChevronRight,
  IconDocument,
  IconEdit,
  IconLaptop,
  IconLogout,
  IconMail,
  IconPhone,
  IconUser,
  IconUsers,
} from "@/components/icons";
import { AlertBox, Avatar } from "@/components/ui";
import { ApiClientError, authService } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMe } from "@/types/api";
import * as ui from "@/theme/classes";
import { parseIsoDate } from "@/utils/datetime";

type IconComp = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const PROFILE_LINKS: {
  label: string;
  description: string;
  href: string;
  Icon: IconComp;
  iconWrap: string;
  iconColor: string;
}[] = [
  {
    label: "Personal Details",
    description: "View and update your personal information",
    href: "/profile/personal",
    Icon: IconUser,
    iconWrap: "bg-[#dbe1ff]",
    iconColor: "text-[#004ac6]",
  },
  {
    label: "Emergency Contact",
    description: "Manage your emergency contact details",
    href: "/profile/emergency",
    Icon: IconUsers,
    iconWrap: "bg-[#ffe2e0]",
    iconColor: "text-[#ba1a1a]",
  },
  {
    label: "Bank Details",
    description: "View and update your bank information",
    href: "/profile/bank",
    Icon: IconBank,
    iconWrap: "bg-[#d1fae5]",
    iconColor: "text-[#007d55]",
  },
  {
    label: "Company Assets",
    description: "Check your assigned company assets",
    href: "/assets",
    Icon: IconLaptop,
    iconWrap: "bg-[#ffedd5]",
    iconColor: "text-[#c2410c]",
  },
  {
    label: "My Documents",
    description: "View and manage your documents",
    href: "/documents",
    Icon: IconDocument,
    iconWrap: "bg-[#ede9fe]",
    iconColor: "text-[#712ae2]",
  },
  {
    label: "Offboarding Request",
    description: "Raise your offboarding request",
    href: "/separation",
    Icon: IconLogout,
    iconWrap: "bg-[#ffe4e6]",
    iconColor: "text-[#be123c]",
  },
];

function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseIsoDate(iso.slice(0, 10));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function statusLabel(status: string | null | undefined): string {
  if (!status) return "Active";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<EssMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    essService
      .me()
      .then((res) => setMe(res.data))
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load profile",
        ),
      );
  }, []);

  async function onLogout() {
    setLoggingOut(true);
    try {
      await authService.logout();
    } finally {
      router.replace("/login");
    }
  }

  const isActive = (me?.status ?? "active").toLowerCase() === "active";

  return (
    <div className="space-y-5 pb-2">
      <header className="sticky top-0 z-40 -mx-5 mb-1 flex h-14 items-center justify-between gap-3 border-b border-[#c3c6d7]/25 bg-[#f8f9ff]/90 px-5 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconCacheMark size={34} className="shrink-0" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[15px] font-bold tracking-tight text-[#0b1c30]">
              Cache HRMS
            </p>
            <p className="truncate text-[10px] font-medium text-[#737686]">
              People. Process. Progress.
            </p>
          </div>
        </div>
        <NotificationBellLink />
      </header>

      {error ? <AlertBox>{error}</AlertBox> : null}

      {me ? (
        <>
          <section className="overflow-hidden rounded-[1.35rem] border border-[#c3c6d7]/30 bg-white shadow-[0_8px_28px_rgba(37,99,235,0.08)]">
            <div className="bg-gradient-to-b from-[#eef2ff] via-[#f5f7ff] to-white px-5 pb-5 pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <Link href="/profile/personal" aria-label="Open personal details">
                    <Avatar name={me.display_name} size="xl" ring />
                  </Link>
                  <Link
                    href="/profile/personal"
                    className="absolute bottom-0.5 right-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-md ring-2 ring-white"
                    aria-label="Edit profile"
                  >
                    <IconEdit size={14} />
                  </Link>
                </div>

                <span
                  className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    isActive
                      ? "bg-[#d1fae5] text-[#007d55]"
                      : "bg-[#eff4ff] text-[#434655]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isActive ? "bg-[#10B981]" : "bg-[#c3c6d7]"
                    }`}
                  />
                  {statusLabel(me.status)}
                </span>

                <h1 className="mt-2.5 text-[1.55rem] font-bold tracking-tight text-[#0b1c30]">
                  {me.display_name}
                </h1>
                <span className="mt-2 inline-flex rounded-full bg-[#dbe1ff] px-3 py-1 text-xs font-semibold text-[#004ac6]">
                  {me.employee_code}
                </span>
                <p className="mt-2 text-sm font-medium text-[#434655]">
                  {me.designation || "—"}
                </p>
              </div>

              <div className="mt-5 border-t border-[#c3c6d7]/35 pt-4">
                <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                  <InfoCell
                    Icon={IconBuilding}
                    label="Department"
                    value={me.department_name}
                  />
                  <InfoCell
                    Icon={IconUser}
                    label="Manager"
                    value={me.manager_name}
                  />
                  <InfoCell Icon={IconMail} label="Email" value={me.email} />
                  <InfoCell Icon={IconPhone} label="Phone" value={me.mobile} />
                  <InfoCell
                    Icon={IconCalendar}
                    label="Date of Birth"
                    value={formatLongDate(me.date_of_birth)}
                  />
                  <InfoCell
                    Icon={IconCalendar}
                    label="Date of Joining"
                    value={formatLongDate(me.date_of_joining)}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3 px-0.5">
              <h2 className="text-lg font-bold tracking-tight text-[#0b1c30]">
                Professional Details
              </h2>
              <Link
                href="/profile/personal"
                className="shrink-0 text-xs font-semibold text-[#004ac6]"
              >
                Manage your information
              </Link>
            </div>

            <div className="space-y-2.5">
              {PROFILE_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl border border-[#c3c6d7]/30 bg-white/90 px-3.5 py-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition active:scale-[0.99] hover:bg-[#f8f9ff]"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.iconWrap} ${item.iconColor}`}
                  >
                    <item.Icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-[#0b1c30]">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-[#737686]">
                      {item.description}
                    </span>
                  </span>
                  <IconChevronRight
                    size={18}
                    className="shrink-0 text-[#c3c6d7]"
                  />
                </Link>
              ))}
            </div>
          </section>

          {me.is_ess_admin && me.admin_use_web_portal ? (
            <section
              className={`${ui.card} border border-[#dbe1ff] bg-[#eff4ff] p-4 text-sm text-[#0b1c30]`}
            >
              <p className="font-semibold text-[#004ac6]">HR / admin access</p>
              <p className="mt-1 text-[#434655]">
                Your account has admin permissions. Use the HRMS web portal for
                configuration and helpdesk tools.
              </p>
            </section>
          ) : null}
        </>
      ) : !error ? (
        <div className={`${ui.card} p-8 text-center text-sm text-[#434655]`}>
          Loading profile…
        </div>
      ) : null}

      <button
        type="button"
        className={`${ui.btnLogout} w-full rounded-full`}
        onClick={onLogout}
        disabled={loggingOut}
      >
        <IconLogout size={18} />
        {loggingOut ? "Signing out…" : "Logout"}
      </button>
    </div>
  );
}

function InfoCell({
  Icon,
  label,
  value,
}: {
  Icon: IconComp;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1.5 text-[#737686]">
        <Icon size={13} className="shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="truncate text-sm font-semibold text-[#0b1c30]">
        {value?.trim() ? value : "—"}
      </p>
    </div>
  );
}
