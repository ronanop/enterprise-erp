"use client";

import { useEffect } from "react";
import Link from "next/link";

const CHUNK_RELOAD_KEY = "erp.chunk-reload";

function isChunkLoadError(error: Error): boolean {
  const message = `${error.name} ${error.message}`;
  return /chunk|dynamically imported module|loading css chunk|failed to fetch/i.test(
    message,
  );
}

export default function AppError({
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
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-foreground">This view failed to load.</p>
      <p className="max-w-md text-sm text-muted-foreground">
        After an app update, hard-refresh the browser (Ctrl+Shift+R). If it still fails, try
        again or go home.
      </p>
      {error.message ? (
        <p className="max-w-lg break-words text-xs text-destructive">{error.message}</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem(CHUNK_RELOAD_KEY);
            reset();
          }}
          className="inline-flex h-9 cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors duration-200 hover:bg-accent"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
