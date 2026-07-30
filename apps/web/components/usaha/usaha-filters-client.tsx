"use client";

import Link from "next/link";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { EcosystemTagFilter } from "@/components/ekosistem/ecosystem-tag-filter";

const FILTER_CLASS = "h-8 w-full sm:w-auto sm:flex-1 sm:min-w-[140px] rounded-full text-xs px-3 py-0";

const SEKTOR_OPTIONS: ComboboxOption[] = [
  { value: "", label: "Semua Sektor" },
  ...[
    "Pertanian, Peternakan & Perikanan",
    "Manufaktur & Pengolahan",
    "Perdagangan, Ritel & F&B",
    "Teknologi & Informasi",
    "Kreatif",
    "Logistik, Transportasi & Konstruksi",
    "Jasa Usaha & Keuangan",
    "Pendidikan & Pelatihan",
    "Kesehatan, Farmasi & Herbal",
    "Sumber Daya Alam & Energi",
  ].map(v => ({ value: v, label: v })),
];

const KATEGORI_OPTIONS: ComboboxOption[] = [
  { value: "", label: "Semua Kategori" },
  ...["Jasa", "Produsen", "Distributor", "Trading", "Profesional"].map(v => ({ value: v, label: v })),
];

type Props = {
  slug:             string;
  currentQ?:        string;
  currentProvinsi?: string;
  currentSektor?:   string;
  currentKategori?: string;
  currentBidang?:   string;
  currentTag?:      string;
  currentArah?:     string;
  currentPage:      number;
  hasFilter:        boolean;
  provinsiList:     { id: number; name: string }[];
  bidangOptions:    string[];
};

export function UsahaFiltersClient({
  slug,
  currentQ,
  currentProvinsi,
  currentSektor,
  currentKategori,
  currentBidang,
  currentTag,
  currentArah,
  currentPage,
  hasFilter,
  provinsiList,
  bidangOptions,
}: Props) {
  function buildUrl(overrides: Record<string, string | undefined | number>) {
    const sp = new URLSearchParams();
    const eff = {
      q:         currentQ,
      provinsi:  currentProvinsi,
      sektor:    currentSektor,
      kategori:  currentKategori,
      bidang:    currentBidang,
      tag:       currentTag,
      arah:      currentArah,
      page:      String(currentPage),
      ...overrides,
    };
    if (eff.q)         sp.set("q",         String(eff.q));
    if (eff.provinsi)  sp.set("provinsi",  String(eff.provinsi));
    if (eff.sektor)    sp.set("sektor",    String(eff.sektor));
    if (eff.kategori)  sp.set("kategori",  String(eff.kategori));
    if (eff.bidang)    sp.set("bidang",    String(eff.bidang));
    if (eff.tag)       sp.set("tag",       String(eff.tag));
    if (eff.tag && eff.arah) sp.set("arah", String(eff.arah));
    if (eff.page && eff.page !== "1") sp.set("page", String(eff.page));
    const qs = sp.toString();
    return `/${slug}/usaha${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mb-6 space-y-3">
      <form method="GET" action={`/${slug}/usaha`}>
        {currentProvinsi && <input type="hidden" name="provinsi" value={currentProvinsi} />}
        {currentSektor   && <input type="hidden" name="sektor"   value={currentSektor} />}
        {currentKategori  && <input type="hidden" name="kategori"  value={currentKategori} />}
        {currentBidang    && <input type="hidden" name="bidang"    value={currentBidang} />}
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

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
        <Combobox
          options={KATEGORI_OPTIONS}
          value={currentKategori ?? ""}
          onValueChange={v => { window.location.href = buildUrl({ kategori: v || undefined, page: "1" }); }}
          className={FILTER_CLASS}
          clearable
        />

        <Combobox
          options={SEKTOR_OPTIONS}
          value={currentSektor ?? ""}
          onValueChange={v => { window.location.href = buildUrl({ sektor: v || undefined, page: "1" }); }}
          className={FILTER_CLASS}
          clearable
        />

        <Combobox
          options={[{ value: "", label: "Semua Bidang Usaha" }, ...bidangOptions.map(b => ({ value: b, label: b }))]}
          value={currentBidang ?? ""}
          onValueChange={v => { window.location.href = buildUrl({ bidang: v || undefined, page: "1" }); }}
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
          <Link href={`/${slug}/usaha`} className="w-full sm:w-auto text-center text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
            × Reset Filter
          </Link>
        )}
      </div>

      <EcosystemTagFilter
        currentTag={currentTag}
        currentArah={currentArah}
        onApply={(tag, arah) => { window.location.href = buildUrl({ tag, arah, page: "1" }); }}
      />
    </div>
  );
}
