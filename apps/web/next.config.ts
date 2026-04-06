import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@studio/contracts", "@studio/tenant-context"],
};

export default nextConfig;
