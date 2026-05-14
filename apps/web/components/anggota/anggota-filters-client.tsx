"use client";

import Link from "next/link";

type Props = {
  slug:             string;
  currentQ?:        string;
  currentProvinsi?: string;
  currentAngkatan?: string;
  currentProfesi?:  string;
  currentPage:      number;
  hasFilter:        boolean;
  provinsiList:     { id: number; name: string }[];
  profesiList:      { category: string }[];
};

export function AnggotaFiltersClient({
  slug,
  currentQ,
  currentProvinsi,
  currentAngkatan,
  currentProfesi,
  currentPage,
  hasFilter,
  provinsiList,
  profesiList,
}: Props) {
  function buildUrl(overrides: Record<string, string | undefined | number>) {
    const sp = new URLSearchParams();
    const eff = {
      q:        currentQ,
      provinsi: currentProvinsi,
      angkatan: currentAngkatan,
      profesi:  currentProfesi,
      page:     String(currentPage),
      ...overrides,
    };
    if (eff.q)        sp.set("q",        String(eff.q));
    if (eff.provinsi) sp.set("provinsi", String(eff.provinsi));
    if (eff.angkatan) sp.set("angkatan", String(eff.angkatan));
    if (eff.profesi)  sp.set("profesi",  String(eff.profesi));
    if (eff.page && eff.page !== "1") sp.set("page", String(eff.page));
    const qs = sp.toString();
    return `/${slug}/anggota${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mb-6 space-y-3">
      {/* Search */}
      <form method="GET" action={`/${slug}/anggota`}>
        {currentProvinsi && <input type="hidden" name="provinsi" value={currentProvinsi} />}
        {currentAngkatan && <input type="hidden" name="angkatan" value={currentAngkatan} />}
        {currentProfesi  && <input type="hidden" name="profesi"  value={currentProfesi} />}
        <div className="flex gap-2 max-w-md">
          <input
            name="q"
            defaultValue={currentQ ?? ""}
            placeholder="Cari nama anggota..."
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Cari
          </button>
        </div>
      </form>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={currentProvinsi ?? ""}
          onChange={e => {
            const val = e.target.value;
            window.location.href = buildUrl({ provinsi: val || undefined, page: "1" });
          }}
          className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Semua Provinsi</option>
          {provinsiList.map(p => (
            <option key={p.id} value={String(p.id)}>{p.name}</option>
          ))}
        </select>

        <select
          value={currentProfesi ?? ""}
          onChange={e => {
            const val = e.target.value;
            window.location.href = buildUrl({ profesi: val || undefined, page: "1" });
          }}
          className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Semua Profesi</option>
          {profesiList.map(p => (
            <option key={p.category} value={p.category}>{p.category}</option>
          ))}
        </select>

        <select
          value={currentAngkatan ?? ""}
          onChange={e => {
            const val = e.target.value;
            window.location.href = buildUrl({ angkatan: val || undefined, page: "1" });
          }}
          className="text-xs rounded-full border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Semua Angkatan</option>
          {Array.from(
            { length: new Date().getFullYear() - 1959 },
            (_, i) => new Date().getFullYear() - i
          ).map(y => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>

        {hasFilter && (
          <Link
            href={`/${slug}/anggota`}
            className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            × Reset Filter
          </Link>
        )}
      </div>
    </div>
  );
}
