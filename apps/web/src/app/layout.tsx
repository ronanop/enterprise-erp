import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";

import { DEV_EXTENSION_NOISE_SCRIPT } from "@/lib/dev-extension-noise";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Enterprise ERP",
  description: "Multi-Industry Enterprise ERP Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${jakartaSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {process.env.NODE_ENV === "development" ? (
          <script
            id="erp-dev-extension-noise-filter"
            dangerouslySetInnerHTML={{
              __html: DEV_EXTENSION_NOISE_SCRIPT.trim(),
            }}
          />
        ) : null}
      </head>
      {/* suppressHydrationWarning: browser extensions (e.g. QuillBot) inject attrs like data-qb-installed */}
      <body className="flex min-h-full flex-col font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
