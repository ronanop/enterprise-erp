import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";

const MIN_SPINNER_MS = 650;
const WEB_TRIGGER_PX = 72;

type Options = {
  onRefresh: () => Promise<void>;
};

/**
 * Instagram-style pull-to-refresh.
 * Native uses RefreshControl; web uses top-edge pull distance (RN-web bounce is weak).
 */
export function useFeedPullRefresh({ onRefresh }: Options) {
  const [refreshing, setRefreshing] = useState(false);
  const [webPull, setWebPull] = useState(0);
  const atTopRef = useRef(true);
  const pullingRef = useRef(false);
  const startYRef = useRef(0);
  const busyRef = useRef(false);

  const runRefresh = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setRefreshing(true);
    const started = Date.now();
    try {
      await onRefresh();
    } finally {
      const wait = Math.max(0, MIN_SPINNER_MS - (Date.now() - started));
      if (wait) await new Promise((r) => setTimeout(r, wait));
      setRefreshing(false);
      setWebPull(0);
      busyRef.current = false;
      pullingRef.current = false;
    }
  }, [onRefresh]);

  const onScrollOffset = useCallback((y: number) => {
    atTopRef.current = y <= 2;
    if (!atTopRef.current && webPull > 0 && !refreshing) {
      setWebPull(0);
    }
  }, [refreshing, webPull]);

  const onWebTouchStart = useCallback((pageY: number) => {
    if (Platform.OS !== "web" || refreshing || !atTopRef.current) return;
    pullingRef.current = true;
    startYRef.current = pageY;
  }, [refreshing]);

  const onWebTouchMove = useCallback((pageY: number) => {
    if (Platform.OS !== "web" || !pullingRef.current || refreshing) return;
    if (!atTopRef.current) {
      setWebPull(0);
      return;
    }
    const delta = Math.max(0, pageY - startYRef.current);
    // Rubber-band: ease the pull distance
    const eased = Math.min(120, delta * 0.55);
    setWebPull(eased);
  }, [refreshing]);

  const onWebTouchEnd = useCallback(() => {
    if (Platform.OS !== "web" || !pullingRef.current) return;
    pullingRef.current = false;
    if (webPull >= WEB_TRIGGER_PX) {
      void runRefresh();
    } else {
      setWebPull(0);
    }
  }, [runRefresh, webPull]);

  return {
    refreshing,
    webPull,
    webPullProgress: Math.min(1, webPull / WEB_TRIGGER_PX),
    runRefresh,
    onScrollOffset,
    onWebTouchStart,
    onWebTouchMove,
    onWebTouchEnd,
  };
}
