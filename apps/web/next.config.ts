import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@jalajogja/ui"],
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
      {
        // MinIO production — sesuaikan hostname dengan VPS kalian
        protocol: "https",
        hostname: "minio.jalakarta.com",
        pathname: "/**",
      },
      {
        // MinIO production via HTTP (jika belum pakai SSL di MinIO)
        protocol: "http",
        hostname: "minio.jalakarta.com",
        port: "9000",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
