"use client";

import Link from "next/link";
import { PROFESSION_CATEGORIES } from "@/lib/professional-types";
import { EcosystemTagFilter } from "@/components/ekosistem/ecosystem-tag-filter";

type Props = {
  slug:             string;
  currentQ?:        string;
  currentProvinsi?: string;
  currentKategori?: string;
  currentJenis?:    string;
  currentTag?:      string;
  currentArah?:     string;
  currentPage:      number;
  hasFilter:        boolean;
  provinsiList:     { id: number; name: string }[];
  // Pasangan kategori+jenis dari data yang benar-benar ada (bukan daftar kurasi statis)
  typeOptions:      { category: string; type: string }[];
};

export function ProfessionalFiltersClient({
  slug,
  currentQ,
  currentProvinsi,
  currentKategori,
  currentJenis,
  currentTag,
  currentArah,
  currentPage,
  hasFilter,
  provinsiList,
  typeOptions,
}: Props) {
  function buildUrl(overrides: Record<string, string | undefined | number>) {
    const sp = new URLSearchParams();
    const eff = {
      q:         currentQ,
      provinsi:  currentProvinsi,
      kategori:  currentKategori,
      jenis:     currentJenis,
      tag:       currentTag,
      arah:      currentArah,
      page:      String(currentPage),
      ...overrides,
    };
    if (eff.q)        sp.set("q",        String(eff.q));
    if (eff.provinsi) sp.set("provinsi", String(eff.provinsi));
    if (eff.kategori) sp.set("kategori", String(eff.kategori));
    if (eff.jenis)    sp.set("jenis",    String(eff.jenis));
    if (eff.tag)       sp.set("tag",       String(eff.tag));
    if (eff.tag && eff.arah) sp.set("arah", String(eff.arah));
    if (eff.page && eff.page !== "1") sp.set("page", String(eff.page));
    const qs = sp.toString();
    return `/${slug}/profesional${qs ? `?${qs}` : ""}`;
  }

  // Jenis profesi tersedia disaring sesuai kategori terpilih (dependent dropdown)
  const availableTypes = currentKategori
    ? typeOptions.filter(t => t.category === currentKategori)
    : typeOptions;
  const uniqueTypes = [...new Set(availableTypes.map(t => t.type))].sort();

  return (
    <div className="mb-6 space-y-3">
      <form method="GET" action={`/${slug}/profesional`}>
        {currentProvinsi && <input type="hidden" name="provinsi" value={currentProvinsi} />}
        {currentKategori && <input type="hidden" name="kategori" value={currentKategori} />}
        {currentJenis    && <input type="hidden" name="jenis"    value={currentJenis} />}
        <div className="flex gap-2 max-w-md">
          <input
            name="q"
            defaultValue={currentQ ?? ""}
            placeholder="Cari nama, profesi, atau spesialisasi..."
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            Cari
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={currentKategori ?? ""}
          onChange={e => { window.location.href = buildUrl({ kategori: e.target.value || undefined, jenis: undefined, page: "1" }); }}
          className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Semua Kategori</option>
          {PROFESSION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={currentJenis ?? ""}
          onChange={e => { window.location.href = buildUrl({ jenis: e.target.value || undefined, page: "1" }); }}
          className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Semua Jenis Profesi</option>
          {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={currentProvinsi ?? ""}
          onChange={e => { window.location.href = buildUrl({ provinsi: e.target.value || undefined, page: "1" }); }}
          className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Semua Provinsi</option>
          {provinsiList.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>

        {hasFilter && (
          <Link href={`/${slug}/profesional`} className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
            × Reset Filter
          </Link>
        )}
      </div>
    </div>
  );
}
