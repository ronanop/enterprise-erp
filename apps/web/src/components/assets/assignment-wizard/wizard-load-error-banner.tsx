"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export type WizardLoadErrorBannerProps = {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
};

export function WizardLoadErrorBanner({ message, onRetry, retrying }: WizardLoadErrorBannerProps) {
  return (
    <div
      className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <div className="flex gap-2 text-sm text-destructive">
        <AlertCircle className="size-4 shrink-0" aria-hidden />
        <span>{message}</span>
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer shrink-0 transition-colors duration-200"
          onClick={onRetry}
          disabled={retrying}
        >
          <RefreshCw className={`mr-1 size-4 ${retrying ? "animate-spin" : ""}`} aria-hidden />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
