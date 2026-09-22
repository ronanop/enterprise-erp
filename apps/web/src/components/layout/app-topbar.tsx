"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn } from "lucide-react";

import { CrmGlobalSearch } from "@/components/crm/crm-global-search";
import { AppTopbarNotifications } from "@/components/layout/app-topbar-notifications";
import { ProjectsGlobalSearch } from "@/components/projects/projects-global-search";
import { useAuthUser } from "@/hooks/use-auth-user";

export function AppTopbar() {
  const pathname = usePathname();
  const { signedIn, loading } = useAuthUser();
  const isCrm = pathname === "/crm" || pathname.startsWith("/crm/");
  const isProjects = pathname === "/projects" || pathname.startsWith("/projects/");

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-border/80 bg-card/80 px-4 backdrop-blur-md supports-backdrop-filter:bg-card/70 sm:px-6">
      <div className="min-w-0 shrink-0">
        <Link
          href="/home"
          className="flex cursor-pointer items-center transition-opacity duration-200 hover:opacity-80"
          aria-label="iConnect Plus home"
        >
          <Image
            src="/brand/iconnect-plus-topbar.png"
            alt="iConnect Plus"
            width={200}
            height={80}
            priority
            unoptimized
            className="h-9 w-auto max-w-[200px] object-contain object-left sm:h-10"
          />
        </Link>
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
