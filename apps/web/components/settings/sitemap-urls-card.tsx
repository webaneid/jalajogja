"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

// Card "URL Sitemap (untuk Google Search Console)" — docs/arsitektur-seo.md § 3.3. Ditampilkan
// di /settings/seo supaya admin tidak perlu mengetik/menebak URL sitemap sendiri saat submit ke
// Google Search Console. Read-only input + tombol salin — pola sama persis link TTD di
// signature-slot-manager.tsx (select-all on click, Copy/Check icon toggle, timed feedback).
export function SitemapUrlsCard({
  nativeUrl,
  yoastUrl,
}: {
  nativeUrl: string;
  yoastUrl: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const rows = [
    { label: "Sitemap Utama (rekomendasi)", url: nativeUrl },
    { label: "Alias Yoast (kalau migrasi dari WordPress)", url: yoastUrl },
  ];

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">URL Sitemap — untuk Google Search Console</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Salin salah satu URL di bawah, lalu buka{" "}
          <span className="font-medium">Google Search Console → Sitemaps → Add a new sitemap</span>,
          tempel di sana. Cukup salah satu — keduanya berisi daftar URL yang sama.
        </p>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.url} className="space-y-1">
            <p className="text-[11px] text-muted-foreground">{row.label}</p>
            <div className="flex items-center gap-1.5">
              <input
                readOnly
                type="text"
                value={row.url}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex-1 rounded border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => copy(row.url)}
                title="Salin URL"
                className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:opacity-90"
              >
                {copied === row.url
                  ? <><Check className="h-3.5 w-3.5" /> Tersalin</>
                  : <><Copy className="h-3.5 w-3.5" /> Salin</>}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
