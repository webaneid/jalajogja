"use client";

import { useState } from "react";
import { SeoPanel, type SeoValues } from "@/components/seo/seo-panel";

const DEFAULT_VALUES: SeoValues = {
  metaTitle:      "",
  metaDesc:       "",
  focusKeyword:   "",
  ogTitle:        "",
  ogDescription:  "",
  ogImageId:      null,
  ogImageUrl:     null,
  twitterCard:    "summary_large_image",
  canonicalUrl:   "",
  robots:         "index,follow",
  schemaType:     "Article",
  structuredData: "",
};

const DUMMY_CONTENT =
  "Dengan hormat, kami mengumumkan bahwa Rapat Tahunan IKPM Yogyakarta " +
  "akan dilaksanakan pada bulan Mei 2025. Seluruh anggota IKPM Yogyakarta " +
  "diharapkan hadir dalam rapat tahunan ini untuk membahas program kerja " +
  "dan kegiatan organisasi ke depan.";

export function SeoTestClient({ slug }: { slug: string }) {
  const [values, setValues] = useState<SeoValues>(DEFAULT_VALUES);

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Test SEO Panel</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tenant:{" "}
          <code className="bg-muted px-1 py-0.5 rounded text-xs">{slug}</code>
        </p>
      </div>

      {/* Simulasi card konten */}
      <div className="rounded-lg border border-border p-4 bg-card space-y-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          Simulasi — Judul Konten
        </p>
        <p className="font-semibold text-base">
          Pengumuman Rapat Tahunan IKPM Yogyakarta 2025
        </p>
        <p className="text-sm text-muted-foreground line-clamp-2">{DUMMY_CONTENT}</p>
      </div>

      {/* SeoPanel */}
      <SeoPanel
        slug={slug}
        contentType="post"
        title="Pengumuman Rapat Tahunan IKPM Yogyakarta 2025"
        content={DUMMY_CONTENT}
        values={values}
        onChange={setValues}
      />

      {/* Debug viewer */}
      <details className="rounded-lg border border-border text-sm">
        <summary className="px-4 py-3 font-medium cursor-pointer hover:bg-muted/40 rounded-lg select-none">
          Debug — SeoValues saat ini
        </summary>
        <pre className="px-4 pb-4 pt-2 text-xs font-mono text-muted-foreground overflow-x-auto">
          {JSON.stringify(values, null, 2)}
        </pre>
      </details>
    </div>
  );
}
