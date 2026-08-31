"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SubHeader } from "@/components/app-header";
import { FaceCapture } from "@/components/face-capture";
import { IconUser } from "@/components/icons";
import { AlertBox } from "@/components/ui";
import { clearFaceVerified } from "@/lib/face-auth";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssFaceStatus } from "@/types/api";
import * as ui from "@/theme/classes";

export default function SecuritySettingsPage() {
  const [status, setStatus] = useState<EssFaceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);

  useEffect(() => {
    essService
      .faceStatus()
      .then((r) => setStatus(r.data))
      .catch((e) =>
        setError(e instanceof ApiClientError ? e.message : "Failed to load"),
      );
  }, []);

  async function onEnroll(imageBase64: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await essService.faceEnroll(imageBase64);
      setStatus(res.data);
      setShowEnroll(false);
      clearFaceVerified();
      setMessage("Face enrolled. You will verify on next sign-in.");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Enrollment failed");
    } finally {
      setBusy(false);
    }
  }

  async function onToggleEnabled() {
    if (!status) return;
    setBusy(true);
    setError(null);
    try {
      const res = await essService.faceSetEnabled(!status.enabled);
      setStatus(res.data);
      clearFaceVerified();
      setMessage(
        res.data?.enabled
          ? "Face verification enabled for app access."
          : "Face verification disabled.",
      );
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 pb-8">
      <SubHeader title="Security Settings" backHref="/profile" />

      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <AlertBox tone="success">{message}</AlertBox> : null}

      <section className="flex items-center gap-3 rounded-2xl bg-[#2563eb] p-5 text-white shadow-md">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
          <IconUser size={22} />
        </span>
        <div>
          <p className="text-lg font-semibold">Face verification</p>
          <p className="text-sm text-white/80">
            {status?.enrolled
              ? status.enabled
                ? "Required after password login"
                : "Enrolled but turned off"
              : "Not enrolled — others could use your password"}
          </p>
        </div>
      </section>

      {status ? (
        <div className={ui.cardFlush}>
          <Toggle
            title="Require face on login"
            subtitle="Blocks access if face does not match"
            on={status.enabled}
            disabled={!status.enrolled || busy}
            onChange={() => void onToggleEnabled()}
          />
        </div>
      ) : null}

      {!showEnroll ? (
        <button
          type="button"
          className={`${ui.btn} w-full`}
          onClick={() => setShowEnroll(true)}
        >
          {status?.enrolled ? "Re-enroll face" : "Enroll face"}
        </button>
      ) : (
        <section className="space-y-3">
          <p className="text-sm text-[#434655]">
            Look at the camera in good light. Use the same face you will use at
            login.
          </p>
          <FaceCapture
            onCapture={onEnroll}
            busy={busy}
            label={status?.enrolled ? "Update enrollment" : "Enroll face"}
          />
          <button
            type="button"
            className="w-full text-sm font-medium text-[#004ac6]"
            onClick={() => setShowEnroll(false)}
          >
            Cancel
          </button>
        </section>
      )}

      <p className="text-center text-xs text-[#434655]">
        <Link href="/profile/change-password" className="font-semibold text-[#004ac6]">
          Change password
        </Link>
      </p>

      <p className="text-center text-xs text-[#434655]">
        Production deployments should use a certified face-matching provider; this
        build uses server-side fingerprint matching for demo.
      </p>
    </div>
  );
}

function Toggle({
  title,
  subtitle,
  on,
  disabled,
  onChange,
}: {
  title: string;
  subtitle: string;
  on: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className={ui.listRow}>
      <span className={ui.iconTile}>
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
        disabled={disabled}
        onClick={onChange}
        className={`relative h-7 w-12 rounded-full transition ${
          on ? "bg-[#2563eb]" : "bg-[#c3c6d7]"
        } ${disabled ? "opacity-50" : ""}`}
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
