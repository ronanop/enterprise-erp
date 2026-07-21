"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, LogIn, LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHealthCheck } from "@/hooks/use-health-check";
import { clearTokens, isAuthenticated } from "@/lib/auth";
import { authService } from "@/services/api-client";

export function AppTopbar() {
  const { data, loading, error } = useHealthCheck();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(isAuthenticated());
  }, []);

  const healthLabel = loading
    ? "Checking…"
    : error
      ? "API offline"
      : data?.status === "healthy"
        ? "API healthy"
        : (data?.status ?? "Unknown");

  const healthVariant = error ? "destructive" : data?.status === "healthy" ? "success" : "secondary";

  async function handleLogout() {
    try {
      await authService.logout();
    } catch {
      clearTokens();
    }
    setSignedIn(false);
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-border/80 bg-card/80 px-4 backdrop-blur-md supports-backdrop-filter:bg-card/70 sm:px-6">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium tracking-tight">Workspace</p>
        <p className="truncate text-xs text-muted-foreground">
          {signedIn ? "Signed in · secure session" : "Guest · sign in for protected APIs"}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={healthVariant} className="hidden sm:inline-flex">
          <span
            className={`mr-1.5 size-1.5 rounded-full ${
              error ? "bg-destructive" : data?.status === "healthy" ? "bg-emerald-500" : "bg-muted-foreground"
            }`}
          />
          {healthLabel}
        </Badge>
        <Button variant="ghost" size="icon-sm" aria-label="Notifications" disabled className="text-muted-foreground">
          <Bell className="size-4" />
        </Button>
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
