"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import { AlertBox } from "@/components/ui";
import { useEssMe } from "@/context/ess-me-context";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import * as ui from "@/theme/classes";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { refresh } = useEssMe();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("New passwords do not match");
      return;
    }
    if (next.length < 8) {
      setError("Use at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await essService.changePassword({
        current_password: current,
        new_password: next,
      });
      await refresh();
      router.replace("/compliance");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <SubHeader title="Change password" backHref="/home" />

      <p className="text-sm text-[#434655]">
        For your security, set a new password before using the employee portal.
      </p>

      {error ? <AlertBox tone="danger">{error}</AlertBox> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
          Current password
          <input
            type="password"
            autoComplete="current-password"
            className={ui.input}
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
          New password
          <input
            type="password"
            autoComplete="new-password"
            className={ui.input}
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-[#434655]">
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            className={ui.input}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button type="submit" className={`${ui.btn} w-full`} disabled={loading}>
          {loading ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
