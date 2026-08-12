"use client";

import { useEffect } from "react";

const PORTAL_STYLES: [string, string][] = [
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

function applyPortalIsolation(portal: HTMLElement) {
  for (const [key, value] of PORTAL_STYLES) {
    portal.style.setProperty(key, value, "important");
  }
}

/**
 * Dev-only: Next.js injects <nextjs-portal> as a direct child of <body>.
 * Without isolation it can affect layout/clicks; CSS alone may lose to runtime inline styles.
 */
export function NextJsPortalIsolation() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    let portalObserver: MutationObserver | null = null;

    const bindPortal = () => {
      const portal = document.querySelector("nextjs-portal");
      if (!portal || !(portal instanceof HTMLElement)) return;
      applyPortalIsolation(portal);
      portalObserver?.disconnect();
      portalObserver = new MutationObserver(() => applyPortalIsolation(portal));
      portalObserver.observe(portal, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    };

    bindPortal();

    const bodyObserver = new MutationObserver(() => bindPortal());
    bodyObserver.observe(document.body, { childList: true, subtree: false });

    const intervalId = window.setInterval(bindPortal, 500);
    window.setTimeout(() => window.clearInterval(intervalId), 5000);

    return () => {
      bodyObserver.disconnect();
      portalObserver?.disconnect();
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
