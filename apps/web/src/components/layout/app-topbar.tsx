"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LogIn, LogOut, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHealthCheck } from "@/hooks/use-health-check";
import { CompanyContextBadge } from "@/components/layout/company-context-badge";
import { GlobalNotificationBell } from "@/components/layout/global-notification-bell";
import { hrNavGroups, isHrPath } from "@/config/hr-nav";
import { clearTokens, isAuthenticated } from "@/lib/auth";
import { authService } from "@/services/api-client";
import { cn } from "@/lib/utils";

function readProfileName(): string {
  try {
    const raw = localStorage.getItem("erp_user_profile");
    if (!raw) return "HR Manager";
    const p = JSON.parse(raw) as { email?: string; full_name?: string };
    return p.full_name || p.email || "HR Manager";
  } catch {
    return "HR Manager";
  }
}

export function AppTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const hrMode = isHrPath(pathname);
  const { data, loading, error } = useHealthCheck();
  const [signedIn, setSignedIn] = useState(false);
  const [profileName, setProfileName] = useState("HR Manager");
  const [navQuery, setNavQuery] = useState("");

  useEffect(() => {
    setSignedIn(isAuthenticated());
    setProfileName(readProfileName());
  }, []);

  const healthLabel = loading
    ? "Checking…"
    : error
      ? "API offline"
      : data?.status === "healthy"
        ? "API healthy"
        : (data?.status ?? "Unknown");

  const healthVariant = error ? "destructive" : data?.status === "healthy" ? "success" : "secondary";

  const navHits = useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    if (!q) return [];
    return hrNavGroups
      .flatMap((g) => g.items)
      .filter((item) => !item.superAdminOnly)
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [navQuery]);

  async function handleLogout() {
    try {
      await authService.logout();
    } catch {
      clearTokens();
    }
    setSignedIn(false);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-border/80 bg-card/80 px-4 backdrop-blur-md supports-backdrop-filter:bg-card/70 sm:px-6",
        hrMode && "shadow-[0_1px_0_rgb(155_91_184_/_8%)]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium tracking-tight">
            {hrMode ? "HRMS" : "Workspace"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {signedIn ? "Signed in · secure session" : "Guest · sign in for protected APIs"}
          </p>
        </div>
        {hrMode ? (
          <div className="relative hidden min-w-[200px] max-w-sm flex-1 md:block">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && navHits[0]) {
                  router.push(navHits[0].href);
                  setNavQuery("");
                }
              }}
              placeholder="Search modules…"
              className="h-9 rounded-xl pl-8"
            />
            {navHits.length > 0 ? (
              <ul className="absolute top-[calc(100%+6px)] left-0 z-50 w-full overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
                {navHits.map((item) => (
                  <li key={item.href}>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted"
                      onClick={() => {
                        router.push(item.href);
                        setNavQuery("");
                      }}
                    >
                      <span className="font-medium">{item.title}</span>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {item.description}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {signedIn ? <CompanyContextBadge /> : null}
        <Badge variant={healthVariant} className="hidden sm:inline-flex">
          <span
            className={`mr-1.5 size-1.5 rounded-full ${
              error ? "bg-destructive" : data?.status === "healthy" ? "bg-emerald-500" : "bg-muted-foreground"
            }`}
          />
          {healthLabel}
        </Badge>
        {signedIn ? <GlobalNotificationBell variant="topbar" /> : null}
        {hrMode && signedIn ? (
          <div className="hidden h-9 items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-2.5 text-xs lg:flex">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {profileName.slice(0, 1).toUpperCase()}
            </span>
            <span className="max-w-[9rem] truncate font-medium">{profileName}</span>
          </div>
        ) : null}
        {signedIn ? (
          <Button variant="outline" size="sm" className="shadow-none" onClick={() => void handleLogout()}>
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        ) : (
          <Link
            href="/login"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <LogIn className="size-3.5" />
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
