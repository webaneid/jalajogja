"use client";

import { useState, useEffect } from "react";
import { isOwnHost } from "./is-own-host";

// Versi client dari resolveBaseUrl() (lib/resolve-base-url.ts) — untuk komponen yang "use client"
// dari awal dan tidak punya akses ke next/headers(). Default ke "/${slug}" (asumsi domain sendiri,
// kasus dominan) supaya SSR dan render klien pertama identik (tidak ada hydration mismatch),
// baru dikoreksi ke "" via useEffect kalau ternyata custom domain. Lihat
// docs/arsitektur-domain.md § 5.2/8.3 — pola ini sebelumnya diduplikasi manual di beberapa
// client component (mitra-product-form.tsx, mitra/apply/page.tsx, dst).
export function useBaseUrl(slug: string): string {
  const [baseUrl, setBaseUrl] = useState(`/${slug}`);
  useEffect(() => {
    if (!isOwnHost(window.location.host)) setBaseUrl("");
  }, []);
  return baseUrl;
}
