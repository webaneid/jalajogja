"use client";

import Link from "next/link";
import { PROFESSION_CATEGORIES } from "@/lib/professional-types";
import { Combobox } from "@/components/ui/combobox";
import { EcosystemTagFilter } from "@/components/ekosistem/ecosystem-tag-filter";

const FILTER_CLASS = "h-8 w-full sm:w-auto sm:flex-1 sm:min-w-[140px] rounded-full text-xs px-3 py-0";

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

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
        <Combobox
          options={[{ value: "", label: "Semua Kategori" }, ...PROFESSION_CATEGORIES.map(c => ({ value: c, label: c }))]}
          value={currentKategori ?? ""}
          onValueChange={v => { window.location.href = buildUrl({ kategori: v || undefined, jenis: undefined, page: "1" }); }}
          className={FILTER_CLASS}
          clearable
        />

        <Combobox
          options={[{ value: "", label: "Semua Jenis Profesi" }, ...uniqueTypes.map(t => ({ value: t, label: t }))]}
          value={currentJenis ?? ""}
          onValueChange={v => { window.location.href = buildUrl({ jenis: v || undefined, page: "1" }); }}
          className={FILTER_CLASS}
          clearable
        />

        <Combobox
          options={[{ value: "", label: "Semua Provinsi" }, ...provinsiList.map(p => ({ value: String(p.id), label: p.name }))]}
          value={currentProvinsi ?? ""}
          onValueChange={v => { window.location.href = buildUrl({ provinsi: v || undefined, page: "1" }); }}
          className={FILTER_CLASS}
          clearable
        />

        {hasFilter && (
          <Link href={`/${slug}/profesional`} className="w-full sm:w-auto text-center text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
            × Reset Filter
          </Link>
        )}
      </div>
    </div>
  );
}
