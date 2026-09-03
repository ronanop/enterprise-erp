import type { NextConfig } from "next";

const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Use a separate distDir so OneDrive file locks on `.next` do not cause EBUSY 500s.
  distDir: ".next-local",
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
      {
        source: "/static/marketing-assets/:path*",
        destination: `${apiProxyTarget}/static/marketing-assets/:path*`,
      },
    ];
  },
};

export default nextConfig;
