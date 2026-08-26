"use client";

import { useEffect } from "react";
import Link from "next/link";

const CHUNK_RELOAD_KEY = "erp.chunk-reload-global";

function isChunkLoadError(error: Error): boolean {
  const message = `${error.name} ${error.message}`;
  return /chunk|dynamically imported module|loading css chunk|failed to fetch/i.test(
    message,
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    if (!isChunkLoadError(error)) {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return;
    }
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1") {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return;
    }
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    window.location.reload();
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 font-sans text-foreground">
        <p className="text-sm font-medium">Something went wrong loading this page.</p>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Hard-refresh with Ctrl+Shift+R after an update, then try again.
        </p>
        {error.message ? (
          <p className="max-w-lg break-words text-center text-xs text-red-600">{error.message}</p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem(CHUNK_RELOAD_KEY);
              reset();
            }}
            className="inline-flex h-9 cursor-pointer items-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white transition-opacity duration-200 hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-9 cursor-pointer items-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium transition-colors duration-200 hover:bg-neutral-50"
          >
            Home
          </Link>
        </div>
      </body>
    </html>
  );
}
