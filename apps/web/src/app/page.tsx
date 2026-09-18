import type { Metadata, Viewport } from "next";

import { ConnectPlusLanding } from "@/components/landing/connect-plus/connect-plus-landing";

export const metadata: Metadata = {
  title: "Connect Plus - Custom AI-powered Enterprise Apps",
  description:
    "Custom AI-powered enterprise apps for finance, CRM, GRC, HR, and operations - without trading accuracy for speed.",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/landing/mark.png", type: "image/png" },
    ],
    apple: "/landing/mark.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#05070f",
};

/**
 * Native Next.js landing — scroll animations owned in React (no Framer iframe).
 */
export default function HomePage() {
  return <ConnectPlusLanding />;
}
