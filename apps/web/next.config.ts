import type { NextConfig } from "next";
import path from "node:path";

const apiProxyTarget =
  process.env.API_PROXY_TARGET?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";

/** App package root — stable when cwd differs from apps/web (avoids Turbopack 404 / ChunkLoadError). */
const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  logging: {
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

export default nextConfig;
