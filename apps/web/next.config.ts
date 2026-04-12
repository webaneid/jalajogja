import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@jalagon/ui"],
  images: {
    remotePatterns: [
      {
        // MinIO development — localhost:9000
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/**",
      },
      {
        // MinIO local network — 192.168.x.x:9000
        protocol: "http",
        hostname: "192.168.*",
        port: "9000",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
