import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "iConnect Plus - Custom AI-powered Enterprise Apps",
  description:
    "Custom AI-powered enterprise apps for finance, CRM, GRC, HR, and operations - without trading accuracy for speed.",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/site/brand/iconnect-plus-mark.png", type: "image/png" },
    ],
    apple: "/site/brand/iconnect-plus-mark.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Full Framer mirror of https://avenna-template.framer.website/
 * (motion + scroll/parallax modules included). Served under /site/…
 */
export default function HomePage() {
  return (
    <iframe
      src="/site/avenna-template.framer.website/index.html"
      title="iConnect Plus"
      className="fixed inset-0 z-0 h-[100dvh] w-[100dvw] max-w-[100vw] border-0 bg-black"
      allow="autoplay; fullscreen"
    />
  );
}
