"use client";

import Link from "next/link";
import { Boxes, Building2, LayoutDashboard, Shield } from "lucide-react";

import { FoundationStatus } from "@/components/foundation-status";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { erpModules } from "@/config/modules";

const highlights = [
  {
    title: "Foundation",
    description: "Auth, RBAC, workflows, audit",
    href: "/foundation",
    icon: Shield,
  },
  {
    title: "Organization",
    description: "Companies, branches, departments",
    href: "/organization",
    icon: Building2,
  },
  {
    title: "Master Data",
    description: "Customers, vendors, products",
    href: "/master-data",
    icon: Boxes,
  },
];

export default function DashboardPage() {
  const totalResources = erpModules.reduce((sum, m) => sum + m.resources.length, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Operations overview"
        description="Every FastAPI module is wired into the shell. Open a department hub, then a resource list for live seeded data."
        actions={
          <Link
            href="/login"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <LayoutDashboard className="size-4" />
            Account
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Backend modules", value: String(erpModules.length) },
          { label: "API resources", value: String(totalResources) },
          { label: "Architecture", value: "Baseline v1.1" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border/80 bg-card p-5 shadow-sm"
          >
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{stat.label}</p>
            <p className="mt-2 text-3xl font-medium tracking-tight text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {highlights.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-xl border border-border/80 bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
            >
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </div>
              <h3 className="text-sm font-medium tracking-tight">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <FoundationStatus />
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>All modules</CardTitle>
              <Badge variant="secondary">API-backed</Badge>
            </div>
            <CardDescription>Jump into any department hub and browse live records.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="erp-scroll grid max-h-[420px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {erpModules.map((mod) => (
                <Link
                  key={mod.key}
                  href={mod.href}
                  className="rounded-lg border border-border/70 bg-background/60 px-3 py-2.5 text-sm transition-colors hover:border-primary/20 hover:bg-accent/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium tracking-tight">{mod.title}</span>
                    <Badge variant="outline">{mod.resources.length}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
