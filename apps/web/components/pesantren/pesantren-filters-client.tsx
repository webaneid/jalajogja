"use client";

import Link from "next/link";

const KURIKULUM_OPTIONS = ["KMI Gontor", "DIKNAS", "KEMENAG", "Salafiah", "Lainnya"] as const;
const KATEGORI_OPTIONS  = ["Putra", "Putra dan Putri", "Putri"] as const;

type Props = {
  slug:              string;
  currentQ?:         string;
  currentProvinsi?:  string;
  currentKurikulum?: string;
  currentKategori?:  string;
  currentPage:       number;
  hasFilter:         boolean;
  provinsiList:      { id: number; name: string }[];
};

export function PesantrenFiltersClient({
  slug,
  currentQ,
  currentProvinsi,
  currentKurikulum,
  currentKategori,
  currentPage,
  hasFilter,
  provinsiList,
}: Props) {
  function buildUrl(overrides: Record<string, string | undefined | number>) {
    const sp = new URLSearchParams();
    const eff = {
      q:         currentQ,
      provinsi:  currentProvinsi,
      kurikulum: currentKurikulum,
      kategori:  currentKategori,
      page:      String(currentPage),
      ...overrides,
    };
    if (eff.q)         sp.set("q",         String(eff.q));
    if (eff.provinsi)  sp.set("provinsi",  String(eff.provinsi));
    if (eff.kurikulum) sp.set("kurikulum", String(eff.kurikulum));
    if (eff.kategori)  sp.set("kategori",  String(eff.kategori));
    if (eff.page && eff.page !== "1") sp.set("page", String(eff.page));
    const qs = sp.toString();
    return `/${slug}/pesantren${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mb-6 space-y-3">
      <form method="GET" action={`/${slug}/pesantren`}>
        {currentProvinsi  && <input type="hidden" name="provinsi"  value={currentProvinsi} />}
        {currentKurikulum && <input type="hidden" name="kurikulum" value={currentKurikulum} />}
        {currentKategori  && <input type="hidden" name="kategori"  value={currentKategori} />}
        <div className="flex gap-2 max-w-md">
          <input
            name="q"
            defaultValue={currentQ ?? ""}
            placeholder="Cari nama pesantren..."
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            Cari
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={currentProvinsi ?? ""}
          onChange={e => { window.location.href = buildUrl({ provinsi: e.target.value || undefined, page: "1" }); }}
          className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Semua Provinsi</option>
          {provinsiList.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>

        <select
          value={currentKurikulum ?? ""}
          onChange={e => { window.location.href = buildUrl({ kurikulum: e.target.value || undefined, page: "1" }); }}
          className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Semua Kurikulum</option>
          {KURIKULUM_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>

        <select
          value={currentKategori ?? ""}
          onChange={e => { window.location.href = buildUrl({ kategori: e.target.value || undefined, page: "1" }); }}
          className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Semua Kategori Santri</option>
          {KATEGORI_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>

        {hasFilter && (
          <Link href={`/${slug}/pesantren`} className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
            × Reset Filter
          </Link>
        )}
      </div>
    </div>
  );
}
