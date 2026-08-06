"use client";

import { ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WizardFooterProps = {
  isFirst: boolean;
  isLast: boolean;
  loading?: boolean;
  nextDisabled?: boolean;
  finishLabel?: string;
  showSaveDraft?: boolean;
  onBack: () => void;
  onNext: () => void;
  onCancel: () => void;
  onSaveDraft?: () => void;
  onFinish?: () => void;
  className?: string;
};

export function WizardFooter({
  isFirst,
  isLast,
  loading,
  nextDisabled,
  finishLabel = "Finish",
  showSaveDraft = true,
  onBack,
  onNext,
  onCancel,
  onSaveDraft,
  onFinish,
  className,
}: WizardFooterProps) {
  return (
    <footer
      className={cn(
        "sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-2 border-t border-border/80 bg-card/95 px-1 pt-4 backdrop-blur-sm",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="cursor-pointer transition-colors duration-200"
        onClick={onCancel}
        disabled={loading}
      >
        Cancel
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        {!isFirst ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={onBack}
            disabled={loading}
          >
            <ChevronLeft className="mr-1 size-4" aria-hidden />
            Back
          </Button>
        ) : null}
        {showSaveDraft && onSaveDraft && !isLast ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={onSaveDraft}
            disabled={loading}
          >
            <Save className="mr-1 size-4" aria-hidden />
            Save draft
          </Button>
        ) : null}
        {isLast ? (
          <Button
            type="button"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={onFinish}
            disabled={loading || nextDisabled}
          >
            {loading ? <Loader2 className="mr-1 size-4 animate-spin" aria-hidden /> : null}
            {finishLabel}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={onNext}
            disabled={loading || nextDisabled}
          >
            Next
            <ChevronRight className="ml-1 size-4" aria-hidden />
          </Button>
        )}
      </div>
    </footer>
  );
}
