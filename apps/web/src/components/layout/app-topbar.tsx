"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    setSignedIn(isAuthenticated());
  }, []);

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-border/80 bg-card/80 px-4 backdrop-blur-md supports-backdrop-filter:bg-card/70 sm:px-6">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium tracking-tight">Workspace</p>
        <p className="truncate text-xs text-muted-foreground">
          {workspaceSubtitle(pathname, signedIn)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Notifications" disabled className="text-muted-foreground">
          <Bell className="size-4" />
        </Button>
        {!signedIn ? (
          <Link
            href="/login"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <LogIn className="size-3.5" />
            Sign in
          </Link>
        ) : null}
      </div>
    </header>
  );
}
