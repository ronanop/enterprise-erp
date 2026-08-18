import type { Metadata } from "next";

import { NextJsPortalIsolation } from "@/components/layout/next-js-portal-isolation";
import "./globals.css";

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
    <html lang="en" data-scroll-behavior="smooth" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full min-w-0 overflow-x-clip font-sans antialiased">
        <NextJsPortalIsolation />
        <div className="flex min-h-full min-w-0 flex-col">{children}</div>
      </body>
    </html>
  );
}
