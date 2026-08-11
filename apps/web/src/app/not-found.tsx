import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Root 404 — shown when the URL is not in the route manifest (e.g. stale `.next` cache).
 * In-app `notFound()` uses `(app)/not-found.tsx` inside AppShell.
 */
export default function RootNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-lg font-medium tracking-tight">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This URL is not registered. If many pages suddenly 404 after an update, stop the dev
        server and run <code className="text-xs">npm run dev:fresh</code> in{" "}
        <code className="text-xs">apps/web</code> to clear the Next.js cache.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/" className={cn(buttonVariants({ size: "sm" }), "cursor-pointer")}>
          Dashboard
        </Link>
        <Link
          href="/procurement"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }), "cursor-pointer")}
        >
          Procurement
        </Link>
        <Link
          href="/login"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }), "cursor-pointer")}
        >
          Login
        </Link>
      </div>
    </div>
  );
}
