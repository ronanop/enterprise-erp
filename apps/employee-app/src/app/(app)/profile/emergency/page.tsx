"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SubHeader } from "@/components/app-header";
import { IconInfo, IconPhone, IconUsers } from "@/components/icons";
import { essService } from "@/services/ess-service";
import type { EssEmergencyContact } from "@/types/api";
import * as ui from "@/theme/classes";

export default function EmergencyContactsPage() {
  const [contact, setContact] = useState<EssEmergencyContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    essService
      .emergency()
      .then((res) => {
        if (!cancelled) setContact(res.data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasContact = Boolean(contact?.name || contact?.mobile);
  const blood = contact?.blood_group?.trim() || null;

  return (
    <div className="space-y-5 pb-6">
      <SubHeader title="Emergency Contacts" backHref="/profile" />

      {/* Critical Care Information */}
      <section className="flex items-center gap-3 rounded-2xl border border-[#93c5fd]/50 bg-[#dbeafe]/70 px-3.5 py-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-sm">
          <MedicalShieldIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-tight text-[#1e3a8a]">
            Critical Care Information
          </p>
          <p className="mt-0.5 text-xs text-[#434655]">From your HR profile.</p>
        </div>
        {blood ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#fee2e2] px-2.5 py-1.5 text-[11px] font-bold text-[#b91c1c]">
            <BloodDropIcon />
            Blood Group: {blood}
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold text-[#64748b]">
            Blood group not set
          </span>
        )}
      </section>

      {loading ? (
        <p className="text-sm text-[#434655]">Loading…</p>
      ) : error ? (
        <p className="text-sm text-[#ba1a1a]">{error}</p>
      ) : !hasContact ? (
        <div className={`${ui.card} p-4 text-sm text-[#434655]`}>
          No emergency contact on file. Ask HR to update your employee profile.
        </div>
      ) : (
        <section className="space-y-3">
          <h2 className="text-[17px] font-bold text-[#0b1c30]">Primary Contact</h2>

          <div className={`${ui.card} space-y-4 p-4`}>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#7c3aed] text-base font-bold text-white shadow-sm">
                {initials(contact?.name || "?")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-bold text-[#0b1c30]">
                    {contact?.name || "—"}
                  </p>
                  <span className="rounded-full bg-[#dbeafe] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1d4ed8]">
                    Emergency Contact
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-[#c3c6d7]/30 pt-3">
              <MetaCell
                icon={<IconUsers size={16} />}
                label="Relationship"
                value={titleCase(contact?.relationship) || "—"}
              />
              <div className="border-l border-[#c3c6d7]/40 pl-3">
                <MetaCell
                  icon={<IconPhone size={16} />}
                  label="Contact Number"
                  value={
                    contact?.mobile ? (
                      <a
                        href={`tel:${digitsOnly(contact.mobile)}`}
                        className="font-bold text-[#0b1c30] underline-offset-2 hover:underline"
                      >
                        {formatPhone(contact.mobile)}
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="flex items-start gap-2.5 rounded-2xl border border-[#93c5fd]/40 bg-[#dbeafe]/55 px-3.5 py-3">
        <span className="mt-0.5 text-[#2563eb]">
          <IconInfo size={18} />
        </span>
        <p className="text-sm leading-relaxed text-[#1e3a8a]">
          Your emergency contact details are managed by HR. Contact HR for any updates.
        </p>
      </div>
    </div>
  );
}

function MetaCell({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center gap-1.5 text-[#64748b]">
        <span className="text-[#2563eb]">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="truncate text-sm font-bold text-[#0b1c30]">{value}</div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function titleCase(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  return text
    .split(/[\s_]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function digitsOnly(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

function formatPhone(value: string): string {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return raw;
}

function MedicalShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.2 5.5 5.8v5.4c0 4.4 2.9 8.3 6.5 9.6 3.6-1.3 6.5-5.2 6.5-9.6V5.8L12 3.2z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M12 8.2v7.2M8.4 11.8h7.2"
        stroke="white"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BloodDropIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1.2C8 1.2 3.5 6.2 3.5 9.4a4.5 4.5 0 0 0 9 0C12.5 6.2 8 1.2 8 1.2z" />
    </svg>
  );
}
