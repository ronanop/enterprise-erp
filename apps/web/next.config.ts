import type { NextConfig } from "next";
import path from "node:path";
import { allowedDevOriginsForPort } from "../../scripts/next-dev-origins";

/** App package root — stable when cwd differs from apps/web (avoids Turbopack 404 / ChunkLoadError). */
const projectRoot = path.resolve(__dirname);

const DEV_PORT = Number(process.env.PORT ?? 3000);

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedDevOriginsForPort(DEV_PORT),
  devIndicators: false,
  logging: {
    browserToTerminal: process.env.NEXT_BROWSER_LOGS === "1",
  },
  turbopack: {
    root: projectRoot,
  },
  async rewrites() {
    const target = (process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000").replace(
      /\/$/,
      "",
    );
    return [
      {
        source: "/api/v1/:path*",
        destination: `${target}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
