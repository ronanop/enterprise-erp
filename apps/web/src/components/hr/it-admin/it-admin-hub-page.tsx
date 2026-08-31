"use client";

import Link from "next/link";
import { DoorOpen, Package, Plane, ShoppingBag } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { hrmsPastelSurface } from "@/config/hrms-theme";
import { cn } from "@/lib/utils";

const CARDS = [
  {
    href: "/hr/meeting-rooms",
    title: "Meeting Room",
    description: "Book rooms, manage equipment, and meeting requests.",
    icon: DoorOpen,
  },
  {
    href: "/hr/it-admin/stocks",
    title: "Stocks Manage",
    description: "Track admin inventory and stock issues.",
    icon: Package,
  },
  {
    href: "/hr/it-admin/travel",
    title: "Travel Desk",
    description: "Raise and track travel requests and bookings.",
    icon: Plane,
  },
  {
    href: "/hr/it-admin/requisition",
    title: "Requisition",
    description: "Request ID card, visiting card, t-shirts, or gifts.",
    icon: ShoppingBag,
  },
] as const;

export function ItAdminHubPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="IT & Admin"
        description="Meeting rooms, stocks, travel desk, and employee requisitions."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((card, i) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className={cn(
                "rounded-2xl border border-border p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md",
                hrmsPastelSurface(i),
              )}
            >
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-primary p-2 text-primary-foreground">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{card.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{card.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
