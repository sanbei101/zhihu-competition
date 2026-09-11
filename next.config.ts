import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  experimental: {
    turbopackRustReactCompiler: true,
  },
  logging: {
    incomingRequests: false,
  },
};

export default nextConfig;
