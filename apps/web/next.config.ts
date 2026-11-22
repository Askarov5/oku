import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@oku/ui", "@oku/db", "@oku/shared-types"],
  // The rail's theme button lives bottom-left, where the dev badge sits by default.
  devIndicators: { position: "bottom-right" },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
