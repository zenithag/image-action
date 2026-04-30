import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@studio/contracts", "@studio/tenant-context"],
  serverExternalPackages: ["pg"],
};

export default nextConfig;
