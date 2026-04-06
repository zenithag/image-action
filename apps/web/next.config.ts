import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@studio/contracts", "@studio/tenant-context"],
};

export default nextConfig;
