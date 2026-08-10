"use client";

import { useCallback, useEffect, useState } from "react";

import {
  buildMarketingTeamRoleQueues,
  type MarketingTeamRoleQueue,
} from "@/lib/marketing-team-queue";
import {
  ApiClientError,
  getHeadVerificationDashboard,
  getMarketingHeadReview,
  type MarketingContentItem,
} from "@/services/marketing-service";

const POLL_MS = 30_000;

function flattenHeadReviewItems(
  groups: Awaited<ReturnType<typeof getMarketingHeadReview>>["groups"],
): MarketingContentItem[] {
  const seen = new Set<string>();
  const items: MarketingContentItem[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}

export function useMarketingHeadTeamNav(enabled: boolean) {
  const [roleQueues, setRoleQueues] = useState<MarketingTeamRoleQueue[]>([]);
  const [loading, setLoading] = useState(enabled);

  const load = useCallback(async () => {
    if (!enabled) {
      setRoleQueues([]);
      setLoading(false);
      return;
    }
    try {
      const [dashboard, headReview] = await Promise.all([
        getHeadVerificationDashboard(),
        getMarketingHeadReview(),
      ]);
      const pipelineItems = flattenHeadReviewItems(headReview.groups);
      setRoleQueues(buildMarketingTeamRoleQueues(dashboard.items, pipelineItems));
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) {
        setRoleQueues([]);
      } else {
        setRoleQueues([]);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    setLoading(enabled);
    void load();
    if (!enabled) return;
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, load]);

  return { roleQueues, loading, refresh: load };
}
