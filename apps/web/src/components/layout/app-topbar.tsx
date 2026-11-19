"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";

import { AppTopbarNotifications } from "@/components/layout/app-topbar-notifications";
import { CompanyContextBadge } from "@/components/layout/company-context-badge";
import { ShellGlobalSearch } from "@/components/layout/shell-global-search";
import { useAuthUser } from "@/hooks/use-auth-user";

export function AppTopbar() {
  const { signedIn, loading } = useAuthUser();
  const showEntitySwitcher = signedIn;

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-border/80 bg-card/80 px-4 backdrop-blur-md supports-backdrop-filter:bg-card/70 sm:px-6">
      <ShellGlobalSearch className="min-w-0 flex-1" />

      <div className="flex shrink-0 items-center gap-2">
        {showEntitySwitcher ? <CompanyContextBadge /> : null}
        <AppTopbarNotifications />
        {!signedIn && !loading ? (
          <Link
            href="/login"
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
          >
            <LogIn className="size-3.5" />
            Sign in
          </Link>
        ) : null}
      </div>
    </header>
  );
}
