"use client";

import { Receipt } from "lucide-react";

import { procurementUi } from "@/components/procurement/procurement-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  deliveryBillStatusBadgeVariant,
  formatDeliveryBillStatusLabel,
} from "@/utils/delivery-challan-bill";
import type { DeliveryBillStatus } from "@/utils/delivery-status-storage";

export function DeliveryBillTakenBadge({
  status,
  noneLabel = "—",
}: {
  status: DeliveryBillStatus | "none";
  noneLabel?: string;
}) {
  if (status === "none") {
    return <span className="text-muted-foreground">{noneLabel}</span>;
  }
  return (
    <Badge
      variant={deliveryBillStatusBadgeVariant(status)}
      className={procurementUi.statusBadge}
    >
      {formatDeliveryBillStatusLabel(status)}
    </Badge>
  );
}

export function DeliveryBillTakenButton({
  status,
  onClick,
  disabled,
}: {
  status: DeliveryBillStatus | "none";
  onClick: () => void;
  disabled?: boolean;
}) {
  if (status === "none") return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={disabled}
      className={cn(
        procurementUi.actionBtn,
        "cursor-pointer text-[#0369A1] hover:text-[#0369A1]",
      )}
      onClick={onClick}
    >
      <Receipt className="mr-1 size-3.5" />
      {status === "fully_billed" ? "Update bill" : "Bill taken"}
    </Button>
  );
}
