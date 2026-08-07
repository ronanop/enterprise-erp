import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { DevExtensionNoiseInit } from "@/components/dev-extension-noise-init";
import "./globals.css";

const inter = Inter({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Employee Portal",
    template: "%s · Employee Portal",
  },
  description: "Employee self-service PWA for leave, attendance, and payslips",
  applicationName: "Employee Portal",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Employee Portal",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. QuillBot) inject
    // attributes like data-qb-installed onto <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <DevExtensionNoiseInit />
      </head>
      <body
        className={`${inter.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
