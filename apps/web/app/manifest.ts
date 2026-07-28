import type { MetadataRoute } from "next";

// Web App Manifest platform-level — docs/rencana-perbaikan-akses-404.md Fase A. Fallback
// generik SEBELUM konteks tenant diketahui browser (favicon/manifest di-fetch browser di
// background terlepas ada <link> deklarasi eksplisit atau tidak — tanpa file ini, semua
// percobaan itu 404). Root-only per konvensi Next.js (regex isMetadataRouteFile di-anchor untuk
// "manifest", sama seperti "robots" — lihat docs/arsitektur-seo.md § 6c.2a).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jalakarta",
    short_name: "Jalakarta",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
  };
}
