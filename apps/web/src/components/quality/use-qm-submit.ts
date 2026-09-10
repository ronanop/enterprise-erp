"use client";

import { useCallback, useRef, useState } from "react";

import { ApiClientError } from "@/services/api-client";

export function useQmSubmit() {
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);

  const run = useCallback(
    async (message: string, task: () => Promise<void>): Promise<boolean> => {
      if (lockRef.current) return false;
      lockRef.current = true;
      setSaving(true);
      setStatusMessage(message);
      setError(null);
      try {
        await task();
        return true;
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Request failed");
        setStatusMessage(null);
        return false;
      } finally {
        setSaving(false);
        lockRef.current = false;
      }
    },
    [],
  );

  return { saving, statusMessage, error, setError, run };
}
