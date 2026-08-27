"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogIn } from "lucide-react";

import { CrmGlobalSearch } from "@/components/crm/crm-global-search";
import { AppTopbarNotifications } from "@/components/layout/app-topbar-notifications";
import { ProjectsGlobalSearch } from "@/components/projects/projects-global-search";
import { isAuthenticated } from "@/lib/auth";

function workspaceSubtitle(pathname: string, signedIn: boolean): string {
  if (!signedIn) return "Guest · sign in for protected APIs";
  if (pathname === "/crm" || pathname.startsWith("/crm/")) return "Sales CRM · secure session";
  if (pathname === "/projects" || pathname.startsWith("/projects/")) {
    return "Projects · secure session";
  }
  return "Signed in · secure session";
}

export function AppTopbar() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const isCrm = pathname === "/crm" || pathname.startsWith("/crm/");
  const isProjects = pathname === "/projects" || pathname.startsWith("/projects/");

  useEffect(() => {
    setSignedIn(isAuthenticated());
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-border/80 bg-card/80 px-4 backdrop-blur-md supports-backdrop-filter:bg-card/70 sm:px-6">
      <div className="min-w-0 shrink-0 sm:w-44">
        <Link
          href="/"
          className="block cursor-pointer truncate text-sm font-medium tracking-tight transition-opacity duration-200 hover:opacity-80"
        >
          Workspace
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {workspaceSubtitle(pathname, signedIn)}
        </p>
      </div>

      {isCrm ? (
        <CrmGlobalSearch className="min-w-0 flex-1" />
      ) : isProjects ? (
        <ProjectsGlobalSearch className="min-w-0 flex-1" />
      ) : (
        <div className="min-w-0 flex-1" />
      )}

      <div className="flex shrink-0 items-center gap-2">
        <AppTopbarNotifications />
        {!signedIn ? (
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
