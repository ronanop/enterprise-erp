import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    root: projectRoot,
  },
  async rewrites() {
    const apiOrigin = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiOrigin}/api/v1/:path*`,
      },
      {
        source: "/procurement/scm/ovf/:ovf_id/po",
        destination: "/procurement/scm/create-po?ovfId=:ovf_id",
      },
      {
        source: "/procurement/scm/ovf/:ovf_id",
        destination: "/procurement/scm/ovf-detail?ovfId=:ovf_id",
      },
    ];
  },
};

export default nextConfig;
