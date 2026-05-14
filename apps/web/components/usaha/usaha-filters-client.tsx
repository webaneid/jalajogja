"use client";

import Link from "next/link";

const SEKTOR_OPTIONS = [
  "Teknologi", "Jasa Profesional", "Kreatif", "Manufaktur",
  "Kesehatan & Pendidikan", "Konsumsi & Ritel", "Sumber Daya Alam",
] as const;

const KATEGORI_OPTIONS = ["Jasa", "Produsen", "Distributor", "Trading", "Profesional"] as const;

const LEGALITAS_OPTIONS = [
  "PT Perseorangan", "PT", "CV", "Yayasan", "Perkumpulan", "Koperasi", "Belum Memiliki Legalitas",
] as const;

type Props = {
  slug:             string;
  currentQ?:        string;
  currentProvinsi?: string;
  currentSektor?:   string;
  currentKategori?: string;
  currentLegalitas?: string;
  currentPage:      number;
  hasFilter:        boolean;
  provinsiList:     { id: number; name: string }[];
};

export function UsahaFiltersClient({
  slug,
  currentQ,
  currentProvinsi,
  currentSektor,
  currentKategori,
  currentLegalitas,
  currentPage,
  hasFilter,
  provinsiList,
}: Props) {
  function buildUrl(overrides: Record<string, string | undefined | number>) {
    const sp = new URLSearchParams();
    const eff = {
      q:         currentQ,
      provinsi:  currentProvinsi,
      sektor:    currentSektor,
      kategori:  currentKategori,
      legalitas: currentLegalitas,
      page:      String(currentPage),
      ...overrides,
    };
    if (eff.q)         sp.set("q",         String(eff.q));
    if (eff.provinsi)  sp.set("provinsi",  String(eff.provinsi));
    if (eff.sektor)    sp.set("sektor",    String(eff.sektor));
    if (eff.kategori)  sp.set("kategori",  String(eff.kategori));
    if (eff.legalitas) sp.set("legalitas", String(eff.legalitas));
    if (eff.page && eff.page !== "1") sp.set("page", String(eff.page));
    const qs = sp.toString();
    return `/${slug}/usaha${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mb-6 space-y-3">
      <form method="GET" action={`/${slug}/usaha`}>
        {currentProvinsi  && <input type="hidden" name="provinsi"  value={currentProvinsi} />}
        {currentSektor    && <input type="hidden" name="sektor"    value={currentSektor} />}
        {currentKategori  && <input type="hidden" name="kategori"  value={currentKategori} />}
        {currentLegalitas && <input type="hidden" name="legalitas" value={currentLegalitas} />}
        <div className="flex gap-2 max-w-md">
          <input
            name="q"
            defaultValue={currentQ ?? ""}
            placeholder="Cari nama usaha atau brand..."
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            Cari
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={currentSektor ?? ""}
          onChange={e => { window.location.href = buildUrl({ sektor: e.target.value || undefined, page: "1" }); }}
          className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Semua Sektor</option>
          {SEKTOR_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={currentKategori ?? ""}
          onChange={e => { window.location.href = buildUrl({ kategori: e.target.value || undefined, page: "1" }); }}
          className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Semua Kategori</option>
          {KATEGORI_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>

        <select
          value={currentProvinsi ?? ""}
          onChange={e => { window.location.href = buildUrl({ provinsi: e.target.value || undefined, page: "1" }); }}
          className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Semua Provinsi</option>
          {provinsiList.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>

        <select
          value={currentLegalitas ?? ""}
          onChange={e => { window.location.href = buildUrl({ legalitas: e.target.value || undefined, page: "1" }); }}
          className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Semua Legalitas</option>
          {LEGALITAS_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        {hasFilter && (
          <Link href={`/${slug}/usaha`} className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
            × Reset Filter
          </Link>
        )}
      </div>
    </div>
  );
}
