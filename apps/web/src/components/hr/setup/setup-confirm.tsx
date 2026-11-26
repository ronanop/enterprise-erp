"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SetupConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  destructive,
  loading,
  typedConfirm,
  prompt,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  /** When set, user must type this exact word (e.g. DELETE) before confirm. */
  typedConfirm?: string;
  /** Optional free-text field (reason / notes). */
  prompt?: {
    label: string;
    defaultValue?: string;
    placeholder?: string;
    required?: boolean;
  };
  onCancel: () => void;
  onConfirm: (value?: string) => void;
}) {
  const [typed, setTyped] = useState("");
  const [promptValue, setPromptValue] = useState("");

  useEffect(() => {
    if (!open) return;
    setTyped("");
    setPromptValue(prompt?.defaultValue ?? "");
  }, [open, prompt?.defaultValue]);

  if (!open) return null;

  const typedOk = !typedConfirm || typed.trim() === typedConfirm;
  const promptOk =
    !prompt?.required || Boolean(promptValue.trim());
  const canConfirm = typedOk && promptOk && !loading;

  function submit() {
    if (!canConfirm) return;
    onConfirm(prompt ? promptValue : typedConfirm ? typed : undefined);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-slate-950/40 transition-opacity duration-200"
        aria-label="Cancel"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-lg">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{message}</p>

        {typedConfirm ? (
          <div className="mt-3 space-y-1.5">
            <label className="text-[11px] font-medium text-foreground">
              Type <span className="font-mono">{typedConfirm}</span> to confirm
            </label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={typedConfirm}
              className="h-8 font-mono text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>
        ) : null}

        {prompt ? (
          <div className="mt-3 space-y-1.5">
            <label className="text-[11px] font-medium text-foreground">{prompt.label}</label>
            <Input
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={prompt.placeholder}
              className="h-8 text-xs"
              autoFocus={!typedConfirm}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant={destructive ? "destructive" : "default"}
            className="cursor-pointer"
            disabled={!canConfirm}
            onClick={submit}
          >
            {loading ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
