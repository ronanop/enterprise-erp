"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  Building2,
  LayoutDashboard,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { WorkspacePage, WorkspaceSection } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { isErpAdmin } from "@/lib/module-access";
import { cn } from "@/lib/utils";
import { signOutAndRedirect } from "@/lib/sign-out";

type AdminLink = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const ADMIN_LINKS: AdminLink[] = [
  {
    title: "Foundation",
    description: "Tenants, RBAC, workflows, notifications, audit, and settings.",
    href: "/foundation",
    icon: Shield,
  },
  {
    title: "Organization",
    description: "Companies, branches, departments, and org structure.",
    href: "/organization",
    icon: Building2,
  },
  {
    title: "Users",
    description: "ERP users, module assignments, and admin entitlements.",
    href: "/organization/users",
    icon: Users,
  },
  {
    title: "Master Data",
    description: "Employees, customers, vendors, products, and shared masters.",
    href: "/master-data",
    icon: Boxes,
  },
  {
    title: "Platform dashboard",
    description: "Cross-module health and activity overview.",
    href: "/home",
    icon: LayoutDashboard,
  },
];

export function AdminPanelPage() {
  const { user, loading } = useAuthUser();
  const allowed = isErpAdmin(user?.userType);

  if (loading) {
    return (
      <WorkspacePage>
        <PageHeader title="Admin panel" description="Loading…" />
      </WorkspacePage>
    );
  }

  if (!allowed) {
    return (
      <WorkspacePage>
        <PageHeader
          title="Admin panel"
          description="Platform and tenant administrators only."
        />
        <WorkspaceSection
          title="Access restricted"
          subtitle="Sign in with an admin account, or continue to the employee workspace."
          icon={Shield}
        >
          <div className="flex flex-wrap gap-2">
            <Button asChild className="cursor-pointer transition-colors duration-200">
              <Link href="/admin-login">Admin sign-in</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
            >
              <Link href="/home">Go to home</Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void signOutAndRedirect()}
            >
              Sign out
            </Button>
          </div>
        </WorkspaceSection>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage>
      <PageHeader
        title="Admin panel"
        description={`Signed in as ${user?.displayName ?? "admin"} · manage platform configuration and access.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ADMIN_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex cursor-pointer flex-col rounded-xl border border-border/70 bg-card p-4 shadow-sm",
                "transition-colors duration-200 hover:border-primary/30 hover:bg-accent/40",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="size-4" aria-hidden />
                </span>
                <ArrowUpRight
                  className="size-4 text-muted-foreground transition-colors duration-200 group-hover:text-foreground"
                  aria-hidden
                />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">{item.title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
            </Link>
          );
        })}
      </div>
    </WorkspacePage>
  );
}
