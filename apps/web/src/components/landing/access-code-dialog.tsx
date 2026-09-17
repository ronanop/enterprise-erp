"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, KeyRound, Loader2, X } from "lucide-react";

import { formatApiError } from "@/services/api-client";
import {
  setAccessGateToken,
  verifyAccessCode,
} from "@/services/access-gate-service";

type AccessCodeDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function AccessCodeDialog({ open, onClose }: AccessCodeDialogProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode("");
    setError(null);
    setSubmitting(false);
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  async function submit() {
    const trimmed = code.trim();
    if (trimmed.length < 4) {
      setError("Enter your access code");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await verifyAccessCode(trimmed);
      setAccessGateToken(result.token);
      onClose();
      // Hard navigate so /login gate remounts after unlock.
      window.location.assign(result.redirect_path);
    } catch (err) {
      setError(formatApiError(err, "Invalid access code"));
      setSubmitting(false);
      inputRef.current?.select();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close sign in"
        className="absolute inset-0 cursor-pointer bg-[#0A0A0F]/45 backdrop-blur-[2px] transition-opacity duration-200"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md animate-in fade-in-0 zoom-in-95 rounded-2xl border border-[#0A0A0F]/[0.08] bg-white p-6 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.45)] duration-200 sm:p-7"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-[#5A6070] transition-[background-color,color] duration-200 hover:bg-[#F5F7FF] hover:text-[#0A0A0F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563FF]"
          aria-label="Close"
        >
          <X className="size-4" aria-hidden />
        </button>

        <div className="mb-5 flex items-start gap-3 pr-8">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#2563FF]/10 text-[#2563FF]">
            <KeyRound className="size-5" aria-hidden />
          </div>
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold tracking-tight text-[#0A0A0F]"
            >
              Sign in with access code
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[#5A6070]">
              Enter the code linked to your workspace. Demo codes open the sales
              preview; ConnectPlus codes open the live ERP.
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-[#5A6070]">
              Access code
            </span>
            <input
              ref={inputRef}
              type="text"
              name="access_code"
              autoComplete="one-time-code"
              spellCheck={false}
              value={code}
              disabled={submitting}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter code"
              className="w-full rounded-xl border border-[#0A0A0F]/12 bg-[#F8FAFF] px-4 py-3.5 font-mono text-base tracking-[0.12em] text-[#0A0A0F] outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:font-sans placeholder:tracking-normal placeholder:text-[#9AA1B2] focus:border-[#2563FF] focus:bg-white focus:ring-2 focus:ring-[#2563FF]/25 disabled:opacity-60"
            />
          </label>

          {error ? (
            <p className="text-sm font-medium text-[#DC2626]" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#2563FF] px-5 py-3.5 text-sm font-semibold !text-white shadow-[0_10px_24px_-12px_rgba(37,99,255,0.9)] transition-[transform,filter] duration-200 hover:-translate-y-px hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563FF] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Verifying…
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="size-4" aria-hidden />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
