"use client";

import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type IssueFormFooterProps = {
  loading?: boolean;
  submitDisabled?: boolean;
  missingLabels?: string[];
  finishLabel?: string;
  onCancel: () => void;
  onSaveDraft?: () => void;
  onFinish?: () => void;
  className?: string;
};

export function IssueFormFooter({
  loading,
  submitDisabled,
  missingLabels = [],
  finishLabel = "Submit",
  onCancel,
  onSaveDraft,
  onFinish,
  className,
}: IssueFormFooterProps) {
  return (
    <footer
      className={cn(
        "sticky bottom-0 z-10 -mx-1 space-y-2 border-t border-border/80 bg-background/95 px-1 py-4 backdrop-blur-sm",
        className,
      )}
    >
      {submitDisabled && missingLabels.length > 0 ? (
        <p className="text-xs text-muted-foreground" data-testid="issue-missing-summary" role="status">
          Complete these fields to submit: {missingLabels.join(", ")}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
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
          {onSaveDraft ? (
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
          <Button
            type="button"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={onFinish}
            disabled={loading || submitDisabled}
          >
            {loading ? <Loader2 className="mr-1 size-4 animate-spin" aria-hidden /> : null}
            {finishLabel}
          </Button>
        </div>
      </div>
    </footer>
  );
}
