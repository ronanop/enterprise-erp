import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";
import path from "node:path";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: {
    document: "/offline",
  },
});

const apiProxyTarget =
  process.env.API_PROXY_TARGET?.replace(/\/$/, "") ??
  process.env.API_INTERNAL_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000";

const projectRoot = path.resolve(__dirname);

const DEV_PORT = Number(process.env.PORT ?? 3001);

/** LAN / tunnel hosts for `next dev` (comma-separated in ALLOWED_DEV_ORIGINS). */
function allowedDevOriginsForPort(port: number): string[] {
  const fromEnv =
    process.env.ALLOWED_DEV_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  return [`localhost:${port}`, `127.0.0.1:${port}`, ...fromEnv];
}

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: allowedDevOriginsForPort(DEV_PORT),
  reactStrictMode: true,
  devIndicators: false,
  logging: {
    // Extension scripts flood the dev terminal; use browser DevTools instead.
    browserToTerminal: process.env.NEXT_BROWSER_LOGS === "1",
  },
  turbopack: {
    root: projectRoot,
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
    ];
  },
};

export default withPWA(nextConfig);
