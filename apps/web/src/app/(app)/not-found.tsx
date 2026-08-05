import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AppNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-lg font-medium tracking-tight">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This URL is not registered in the app. If you just saw many 404s after an update,
        restart the dev server after clearing the cache:{" "}
        <code className="text-xs">npm run dev:fresh</code> in <code className="text-xs">apps/web</code>.
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
