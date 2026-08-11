"use client";

import { useEffect } from "react";

/**
 * Dev-only: Next.js injects <nextjs-portal> as a direct child of <body>.
 * With flex on body it becomes a flex item (0×0 at ~8px) and breaks layout/clicks.
 * CSS in globals.css may lose to runtime inline styles — reinforce after mount.
 */
export function NextJsPortalIsolation() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const apply = () => {
      const portal = document.querySelector("nextjs-portal");
      if (!portal || !(portal instanceof HTMLElement)) return;
      const props: [string, string][] = [
        ["position", "fixed"],
        ["top", "0"],
        ["left", "0"],
        ["width", "0"],
        ["height", "0"],
        ["min-width", "0"],
        ["min-height", "0"],
        ["margin", "0"],
        ["padding", "0"],
        ["border", "none"],
        ["overflow", "visible"],
        ["pointer-events", "none"],
        ["z-index", "9999"],
      ];
      for (const [key, value] of props) {
        portal.style.setProperty(key, value, "important");
      }
    };

    apply();
    const observer = new MutationObserver(() => apply());
    observer.observe(document.body, { childList: true, subtree: false });
    return () => observer.disconnect();
  }, []);

  return null;
}
