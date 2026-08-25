"use client";

import { useEffect, useState } from "react";

import { listScmQueue } from "@/services/procurement-service";

/** Badge count for SCM Queue in the procurement sidebar. */
export function useScmQueueUnreadCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void listScmQueue()
      .then((items) => {
        if (!cancelled) setCount(items.length);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return count;
}
