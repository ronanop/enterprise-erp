"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CacheBrandLogo } from "@/components/cache-brand-logo";
import { NotificationBellLink } from "@/components/notification-bell-link";
import {
  IconBank,
  IconBuilding,
  IconCalendar,
  IconChevronRight,
  IconDocument,
  IconDoorExit,
  IconEdit,
  IconLaptop,
  IconLogout,
  IconMail,
  IconManager,
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
    iconWrap: "bg-[#dbeafe]",
    iconColor: "text-[#2563eb]",
  },
  {
    label: "Emergency Contact",
    description: "Manage your emergency contact details",
    href: "/profile/emergency",
    Icon: IconUsers,
    iconWrap: "bg-[#fee2e2]",
    iconColor: "text-[#dc2626]",
  },
  {
    label: "Bank Details",
    description: "View and update your bank information",
    href: "/profile/bank",
    Icon: IconBank,
    iconWrap: "bg-[#ccfbf1]",
    iconColor: "text-[#0d9488]",
  },
  {
    label: "Company Assets",
    description: "Check your assigned company assets",
    href: "/assets",
    Icon: IconLaptop,
    iconWrap: "bg-[#ffedd5]",
    iconColor: "text-[#ea580c]",
  },
  {
    label: "My Documents",
    description: "View and manage your documents",
    href: "/documents",
    Icon: IconDocument,
    iconWrap: "bg-[#ede9fe]",
    iconColor: "text-[#7c3aed]",
  },
  {
    label: "Offboarding Request",
    description: "Raise your offboarding request",
    href: "/separation",
    Icon: IconDoorExit,
    iconWrap: "bg-[#fce7f3]",
    iconColor: "text-[#db2777]",
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

function ProfileCardWave() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 360 220"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="profileWaveGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c7d7ff" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#dde7ff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#f0f4ff" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <path
        d="M0 48c42 28 78-22 128-8 52 14 78 52 132 40 36-8 64-28 100-18v158H0V48z"
        fill="url(#profileWaveGrad)"
      />
      <path
        d="M0 88c48 22 86-18 136-6 54 14 86 46 140 32 34-8 58-26 84-16v122H0V88z"
        fill="#dbe5ff"
        opacity="0.45"
      />
      <path
        d="M0 128c56 18 96-14 148-4 50 10 78 36 128 24 28-6 52-20 84-10v82H0v-92z"
        fill="#e8efff"
        opacity="0.55"
      />
    </svg>
  );
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
        <CacheBrandLogo height={38} />
        <NotificationBellLink />
      </header>

      {error ? <AlertBox>{error}</AlertBox> : null}

      {me ? (
        <>
          <section className="relative overflow-hidden rounded-[1.35rem] border border-[#c3c6d7]/25 bg-white shadow-[0_10px_32px_rgba(59,42,122,0.08)]">
            <div className="relative px-5 pb-5 pt-7">
              <ProfileCardWave />

              <div className="relative z-[1] flex flex-col items-center text-center">
                <div className="relative">
                  <Link href="/profile/personal" aria-label="Open personal details">
                    <Avatar
                      name={me.display_name}
                      size="xl"
                      ring
                      photoUrl={me.photo_url}
                    />
                  </Link>
                  <Link
                    href="/profile/personal"
                    className="absolute bottom-0.5 right-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-md ring-[2.5px] ring-white"
                    aria-label="Edit profile"
                  >
                    <IconEdit size={14} />
                  </Link>
                </div>

                <span
                  className={`mt-3.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
                    isActive
                      ? "bg-[#d1fae5] text-[#059669]"
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

                <h1 className="mt-2.5 text-[1.6rem] font-bold tracking-tight text-[#3b2a7a]">
                  {me.display_name}
                </h1>
                <span className="mt-2 inline-flex rounded-full bg-[#dbeafe] px-3.5 py-1 text-xs font-semibold text-[#2563eb]">
                  {me.employee_code}
                </span>
                <p className="mt-2 text-sm font-medium text-[#8b92a8]">
                  {me.designation || "—"}
                </p>
              </div>

              <div className="relative z-[1] mt-5 border-t border-[#c3c6d7]/30 pt-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                  <InfoCell
                    Icon={IconBuilding}
                    label="Department"
                    value={me.department_name}
                  />
                  <InfoCell
                    Icon={IconManager}
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
            <h2 className="px-0.5 text-lg font-bold tracking-tight text-[#3b2a7a]">
              More
            </h2>

            <div className="space-y-2.5">
              {PROFILE_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl border border-[#c3c6d7]/25 bg-white px-3.5 py-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition active:scale-[0.99] hover:bg-[#f8f9ff]"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.iconWrap} ${item.iconColor}`}
                  >
                    <item.Icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-[#3b2a7a]">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-[#8b92a8]">
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
        </>
      ) : !error ? (
        <div className={`${ui.card} p-8 text-center text-sm text-[#434655]`}>
          Loading profile…
        </div>
      ) : null}

      <button
        type="button"
        className={`${ui.btnLogout} w-full`}
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
    <div className="min-w-0 text-left">
      <div className="mb-1 flex items-center gap-1.5 text-[#9aa0b4]">
        <Icon size={13} className="shrink-0" />
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p className="truncate text-sm font-semibold text-[#3b2a7a]">
        {value?.trim() ? value : "—"}
      </p>
    </div>
  );
}
