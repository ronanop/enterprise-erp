import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    // Production Docker image: allow build while the tree still has type debt.
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [
      {
        source: "/procurement/scm/ovf/:ovf_id/po",
        destination: "/procurement/scm/create-po?ovfId=:ovf_id",
      },
      {
        source: "/procurement/scm/ovf/:ovf_id/from-stock",
        destination: "/procurement/scm/from-stock?ovfId=:ovf_id",
      },
      {
        source: "/procurement/scm/ovf/:ovf_id/item-plan",
        destination: "/procurement/scm/item-plan?ovfId=:ovf_id",
      },
      {
        source: "/procurement/scm/ovf/:ovf_id",
        destination: "/procurement/scm/ovf-detail?ovfId=:ovf_id",
      },
    ];
  },
};

export default nextConfig;
