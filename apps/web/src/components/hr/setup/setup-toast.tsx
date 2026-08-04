"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info";

export type ToastItem = { id: string; message: string; tone: ToastTone };

let pushToast: ((message: string, tone?: ToastTone) => void) | null = null;

export function toast(message: string, tone: ToastTone = "success") {
  pushToast?.(message, tone);
}

export function SetupToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushToast = (message, tone = "success") => {
      const id = crypto.randomUUID();
      setItems((prev) => [...prev, { id, message, tone }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-full max-w-sm flex-col gap-2">
      {items.map((item) => {
        const Icon = item.tone === "error" ? XCircle : item.tone === "info" ? Info : CheckCircle2;
        return (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm shadow-lg",
              item.tone === "error"
                ? "border-red-200"
                : item.tone === "info"
                  ? "border-sky-200"
                  : "border-emerald-200",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                item.tone === "error"
                  ? "text-red-600"
                  : item.tone === "info"
                    ? "text-sky-600"
                    : "text-emerald-600",
              )}
            />
            <p className="min-w-0 flex-1 text-xs text-foreground">{item.message}</p>
            <button
              type="button"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => setItems((prev) => prev.filter((t) => t.id !== item.id))}
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
