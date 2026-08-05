import type { ReactNode } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { cn } from "@/lib/utils";

type ProcurementPageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
};

/** Compact procurement page title — optional subtitle via `description`. */
export function ProcurementPageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
  onBack,
}: ProcurementPageHeaderProps) {
  return (
    <PageHeader
      title={title}
      description={description}
      actions={actions}
      backHref={backHref}
      backLabel={backLabel}
      onBack={onBack}
      titleClassName="text-lg font-semibold tracking-tight text-foreground sm:text-[1.25rem]"
      className="border-border/50 pb-4"
    />
  );
}

type ProcurementListSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  "aria-label": string;
};

export function ProcurementListSearch({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
}: ProcurementListSearchProps) {
  return (
    <div className={procurementUi.searchRow}>
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(procurementUi.searchInput)}
      />
    </div>
  );
}
