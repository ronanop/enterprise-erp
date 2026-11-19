"use client";

import { useState, type ReactNode } from "react";
import { SubHeader } from "@/components/app-header";
import {
  IconAlert,
  IconChevronRight,
  IconFingerprint,
  IconLogout,
  IconUser,
} from "@/components/icons";
import { AiFab } from "@/components/ui";
import * as ui from "@/theme/classes";

export default function SecuritySettingsPage() {
  const [face, setFace] = useState(true);
  const [finger, setFinger] = useState(false);
  const [bioLogin, setBioLogin] = useState(true);

  return (
    <div className="space-y-5">
      <SubHeader title="Security Settings" backHref="/profile" />

      <section className="flex items-center gap-3 rounded-2xl bg-[#2563eb] p-5 text-white shadow-md">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
          ✓
        </span>
        <div>
          <p className="text-lg font-semibold">Account Secure</p>
          <p className="text-sm text-white/80">Last security scan 2 hours ago</p>
        </div>
      </section>

      <SectionLabel>Biometrics</SectionLabel>
      <div className={ui.cardFlush}>
        <Toggle
          title="Face ID"
          subtitle="Use for quick authentication"
          icon={<IconUser size={18} />}
          on={face}
          onChange={setFace}
        />
        <Toggle
          title="Fingerprint"
          subtitle="Backup biometric access"
          icon={<IconFingerprint size={18} />}
          on={finger}
          onChange={setFinger}
        />
        <Toggle
          title="Biometric Login"
          subtitle="Skip password for app entry"
          icon={<IconUser size={18} />}
          on={bioLogin}
          onChange={setBioLogin}
        />
      </div>

      <SectionLabel>Credentials</SectionLabel>
      <div className={ui.cardFlush}>
        <NavRow
          title="Change Password"
          subtitle="Last updated 3 months ago"
          tone="purple"
        />
        <NavRow
          title="Change PIN"
          subtitle="Set a 6-digit backup code"
          tone="purple"
        />
      </div>

      <div className="flex items-end justify-between">
        <SectionLabel>Login History</SectionLabel>
        <button type="button" className="text-sm font-semibold text-[#004ac6]">
          Log out all
        </button>
      </div>
      <ul className="space-y-2">
        <Device
          name="iPhone 15 Pro"
          place="London, United Kingdom"
          meta="Active now"
          current
        />
        <Device
          name='MacBook Pro 14"'
          place="San Francisco, USA"
          meta="Oct 12, 14:22"
        />
        <Device
          name="Windows Desktop"
          place="Berlin, Germany"
          meta="Oct 08, 09:45"
        />
      </ul>

      <SectionLabel>Advanced</SectionLabel>
      <button
        type="button"
        className={`${ui.card} flex w-full items-center gap-3 p-4 text-left text-[#ba1a1a]`}
      >
        <IconAlert size={18} />
        <span className="font-semibold">Deactivate Account</span>
      </button>

      <AiFab href="/profile" />
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-0.5 text-xs font-bold uppercase tracking-wide text-[#434655]">
      {children}
    </p>
  );
}

function Toggle({
  title,
  subtitle,
  icon,
  on,
  onChange,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={`${ui.listRow}`}>
      <span className={ui.iconTile}>{icon}</span>
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

function NavRow({
  title,
  subtitle,
  tone,
}: {
  title: string;
  subtitle: string;
  tone: "purple";
}) {
  void tone;
  return (
    <button type="button" className={`${ui.listRow} w-full text-left`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaddff] text-[#712ae2]">
        •••
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[#0b1c30]">{title}</p>
        <p className="text-xs text-[#434655]">{subtitle}</p>
      </div>
      <IconChevronRight className="text-[#c3c6d7]" />
    </button>
  );
}

function Device({
  name,
  place,
  meta,
  current,
}: {
  name: string;
  place: string;
  meta: string;
  current?: boolean;
}) {
  return (
    <li className={`${ui.card} flex items-center gap-3 p-4`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dbe1ff] text-[#004ac6]">
        □
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[#0b1c30]">{name}</p>
        <p className="text-xs text-[#434655]">{place}</p>
        <p className="text-xs italic text-[#434655]">{meta}</p>
      </div>
      {current ? (
        <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
          Current
        </span>
      ) : (
        <button type="button" className="text-[#ba1a1a]" aria-label="Logout device">
          <IconLogout size={18} />
        </button>
      )}
    </li>
  );
}
