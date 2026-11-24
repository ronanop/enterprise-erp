"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getCrmSettingsEffective,
  type CrmSettingsConfig,
} from "@/services/crm-settings-service";

export function useCrmSettingsEffective() {
  const [settings, setSettings] = useState<CrmSettingsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSettings(await getCrmSettingsEffective());
    } catch (err) {
      setSettings(null);
      setError(err instanceof Error ? err.message : "Failed to load CRM settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { settings, loading, error, reload };
}
