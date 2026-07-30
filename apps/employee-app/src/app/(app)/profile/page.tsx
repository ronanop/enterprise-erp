"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import {
  IconChevronRight,
  IconEdit,
  IconLogout,
  IconUser,
} from "@/components/icons";
import { AlertBox, Avatar } from "@/components/ui";
import { ApiClientError, authService } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssMe } from "@/types/api";
import * as ui from "@/theme/classes";

const PROFESSIONAL_LINKS = [
  { label: "Personal Information", href: "/profile/personal" },
  { label: "Emergency Contact", href: "/profile/emergency" },
  { label: "Bank Details", href: "/profile/bank" },
  { label: "Education & Skills", href: "/profile/education" },
  { label: "Company Assets", href: "/assets" },
  { label: "My Training", href: "/training" },
  { label: "Performance", href: "/performance" },
  { label: "Separation", href: "/separation" },
  { label: "My Documents", href: "/documents" },
  { label: "Security Settings", href: "/profile/security" },
] as const;

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<EssMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [bio, setBio] = useState(true);
  const [faceId, setFaceId] = useState(false);

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

  return (
    <div className="space-y-6">
      <AppHeader name={me?.display_name} />

      {error ? <AlertBox>{error}</AlertBox> : null}

      {me ? (
        <>
          <section className="flex flex-col items-center pt-2 text-center">
            <div className="relative">
              <Link href="/profile/personal">
                <Avatar name={me.display_name} size="xl" ring />
              </Link>
              <Link
                href="/profile/personal"
                className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-md"
                aria-label="Edit profile"
              >
                <IconEdit size={14} />
              </Link>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-[#0b1c30]">
              {me.display_name}
            </h1>
            <p className="mt-1 text-[#434655]">{me.designation}</p>
            <span className="mt-3 rounded-full bg-[#dbe1ff] px-3 py-1 text-xs font-semibold text-[#004ac6]">
              ID: {me.employee_code}
            </span>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <InfoCard label="Department" value="Product & Design" />
            <InfoCard label="Manager" value="Team Lead" />
          </div>
          <InfoCard label="Email" value={me.email} full />
          <InfoCard label="Phone" value={me.mobile} full />

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#0b1c30]">
              Professional Details
            </h2>
            <div className={ui.cardFlush}>
              {PROFESSIONAL_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${ui.listRow} transition hover:bg-[#eff4ff]/50`}
                >
                  <span className={ui.iconTile}>
                    <IconUser size={16} />
                  </span>
                  <span className="flex-1 font-medium text-[#0b1c30]">
                    {item.label}
                  </span>
                  <IconChevronRight className="text-[#c3c6d7]" />
                </Link>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#0b1c30]">Security</h2>
              <Link
                href="/profile/security"
                className="text-sm font-medium text-[#004ac6]"
              >
                Manage
              </Link>
            </div>
            <div className={`${ui.card} space-y-1 p-2`}>
              <ToggleRow
                title="Biometric Login"
                subtitle="Use fingerprint to unlock"
                on={bio}
                onChange={setBio}
              />
              <ToggleRow
                title="Face ID"
                subtitle="Quick face unlock"
                on={faceId}
                onChange={setFaceId}
              />
            </div>
          </section>

          <section className={ui.cardFlush}>
            <p className={`${ui.sectionTitle} px-4 pb-1 pt-3`}>Employment</p>
            <Row label="Joined" value={me.date_of_joining} />
            <Row label="Designation" value={me.designation} />
            <Row label="Status" value={me.status} />
          </section>
        </>
      ) : null}

      <button
        className={`${ui.btnLogout} w-full`}
        onClick={onLogout}
        disabled={loggingOut}
      >
        <IconLogout size={18} />
        {loggingOut ? "Signing out…" : "Logout"}
      </button>
      <p className="pb-2 text-center text-xs text-[#434655]/70">
        Version 2.4.1 (2024.11)
      </p>
    </div>
  );
}

function InfoCard({
  label,
  value,
  full,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div className={`${ui.card} p-4 ${full ? "w-full" : ""}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#434655]/80">
        {label}
      </p>
      <p className="mt-1 truncate font-semibold text-[#0b1c30]">{value || "—"}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${ui.listRow} justify-between text-sm`}>
      <span className={ui.muted}>{label}</span>
      <span className="max-w-[62%] truncate text-right font-semibold capitalize text-[#0b1c30]">
        {value || "—"}
      </span>
    </div>
  );
}

function ToggleRow({
  title,
  subtitle,
  on,
  onChange,
}: {
  title: string;
  subtitle: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dbe1ff] text-[#004ac6]">
        <IconUser size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[#0b1c30]">{title}</p>
        <p className="text-xs text-[#434655]">{subtitle}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative h-7 w-12 rounded-full transition ${
          on ? "bg-[#2563eb]" : "bg-[#c3c6d7]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
