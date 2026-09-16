"use client";

import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

type SettingsOption = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const ACCESS_OPTIONS: SettingsOption[] = [
  {
    title: "User Management",
    description: "Manage ERP users, module admins, and membership assignments.",
    href: "/erp-settings/users",
    icon: Users,
  },
];

function SettingsOptionLink({ option }: { option: SettingsOption }) {
  const Icon = option.icon;
  return (
    <Link
      href={option.href}
      title={option.title}
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-lg border border-border/80 bg-card px-3.5 py-3",
        "transition-colors duration-200 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium tracking-tight text-foreground">{option.title}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{option.description}</p>
      </div>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
        aria-hidden
      />
    </Link>
  );
}

export function ErpSettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="ERP Settings"
        description="Configure platform settings for your organization."
      />

      <section className="space-y-2" aria-labelledby="erp-settings-access-heading">
        <div className="px-0.5">
          <h2
            id="erp-settings-access-heading"
            className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase"
          >
            Access &amp; identity
          </h2>
        </div>
        <ul className="space-y-2">
          {ACCESS_OPTIONS.map((option) => (
            <li key={option.href}>
              <SettingsOptionLink option={option} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
