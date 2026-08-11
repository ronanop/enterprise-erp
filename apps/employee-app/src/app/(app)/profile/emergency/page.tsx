"use client";

import { useEffect, useState } from "react";
import { SubHeader } from "@/components/app-header";
import { IconPlus, IconUser } from "@/components/icons";
import { ViewportFab } from "@/components/ui";
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
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasContact = Boolean(contact?.name || contact?.mobile);

  return (
    <div className="space-y-5">
      <SubHeader
        title="Emergency Contacts"
        backHref="/profile"
        right={
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center text-[#004ac6]"
            aria-label="Add contact"
          >
            <IconPlus size={22} />
          </button>
        }
      />

      {contact?.blood_group ? (
        <div className="flex items-center gap-3 rounded-2xl border border-[#004ac6]/10 bg-[#2563eb]/10 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2563eb] text-white">
            +
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[#004ac6]">Critical Care Info</p>
            <p className="text-sm text-[#434655]">From your HR profile</p>
          </div>
          <span className="rounded-full bg-[#ffdad6] px-2.5 py-1 text-[10px] font-bold text-[#ba1a1a]">
            Blood Group: {contact.blood_group}
          </span>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#434655]">Loading…</p>
      ) : error ? (
        <p className="text-sm text-[#ba1a1a]">{error}</p>
      ) : !hasContact ? (
        <div className={`${ui.card} p-4 text-sm text-[#434655]`}>
          No emergency contact on file. Ask HR to update your employee profile, or use the
          profile update flow when available.
        </div>
      ) : (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#0b1c30]">Primary Contact</h2>
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#004ac6]">
              Priority 01
            </span>
          </div>
          <div className={`${ui.card} space-y-4 p-4`}>
            <div className="flex items-start gap-3">
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#2563eb] to-[#712ae2] text-sm font-bold text-white">
                {initials(contact?.name || "?")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#0b1c30]">{contact?.name || "—"}</p>
                <p className="text-sm font-medium text-[#004ac6]">
                  {contact?.relationship || "Emergency contact"}
                </p>
              </div>
            </div>
            {contact?.mobile ? (
              <div className="grid grid-cols-2 gap-3">
                <a href={`tel:${contact.mobile}`} className={`${ui.btn} !py-3`}>
                  Call Now
                </a>
                <a href={`sms:${contact.mobile}`} className={`${ui.btnSecondary} !py-3`}>
                  Message
                </a>
              </div>
            ) : null}
          </div>
        </section>
      )}

      <div className="rounded-2xl bg-[#0b1c30] p-4 text-sm text-white/90">
        Emergency contacts come from your HR employee profile — not demo data.
      </div>

      <ViewportFab aria-label="SOS" className="bg-[#2563eb]" href="/notifications">
        <IconUser size={22} />
      </ViewportFab>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
