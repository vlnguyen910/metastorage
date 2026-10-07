import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@metastorage/shared", "@metastorage/contracts", "@metastorage/api-client"],
  reactStrictMode: true,
  devIndicators: false,
};

export default nextConfig;
