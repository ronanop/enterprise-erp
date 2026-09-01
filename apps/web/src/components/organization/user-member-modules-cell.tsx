"use client";

import { erpModules } from "@/config/modules";
import { Badge } from "@/components/ui/badge";
import { memberOnlyModuleKeys } from "@/lib/module-membership";

type Props = {
  assignedModuleKeys: string[];
  adminModuleKeys: string[];
};

/** Read-only badges for modules assigned as member (not org-level admin). */
export function UserMemberModulesCell({ assignedModuleKeys, adminModuleKeys }: Props) {
  const keys = memberOnlyModuleKeys(assignedModuleKeys, adminModuleKeys);
  if (keys.length === 0) {
    return <span className="text-xs text-muted-foreground">None</span>;
  }

  const visible = keys.slice(0, 4);
  const extra = keys.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((key) => (
        <Badge key={key} variant="secondary" className="font-normal">
          {erpModules.find((m) => m.key === key)?.title ?? key}
        </Badge>
      ))}
      {extra > 0 ? (
        <Badge variant="secondary" className="font-normal">
          +{extra}
        </Badge>
      ) : null}
    </div>
  );
}
