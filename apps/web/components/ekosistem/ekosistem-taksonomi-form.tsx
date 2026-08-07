"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { saveTaxonomyOverridesAction } from "@/app/(dashboard)/app/[tenant]/ekosistem/actions";
import {
  BUSINESS_CATEGORY_ENUM, BUSINESS_SECTOR_ENUM, type TaxonomyOverrides,
} from "@/lib/taxonomy-overrides";
import {
  SECTOR_COMBOBOX_OPTIONS, SECTOR_SUB_FIELDS, type BusinessSector,
} from "@/lib/business-sectors";
import { BUSINESS_FIELD_SUGGESTIONS } from "@/lib/business-fields";

// Form pengaturan label Kategori/Sektor/Bidang Usaha + toggle enable Sektor/Kategori + Bidang
// Usaha custom tenant (sektor-scoped, § 10.9) + nama field itu sendiri (§ 10.9). Prinsip kunci
// (dikonfirmasi user): hanya ubah LABEL tampilan, tidak pernah nilai tersimpan. Default kosong
// = perilaku sekarang (label kanonik). Detail arsitektur: docs/arsitektur-ekosistem.md § 10.

type FormState = {
  // Nama FIELD itu sendiri — "" = pakai nama bawaan (Kategori/Sektor/Bidang Usaha)
  fieldLabelCategory:       string;
  fieldLabelSector:         string;
  fieldLabelBusinessFields: string;

  categoryLabels:       Record<string, string>; // "" = tidak override
  categoryEnabled:      Record<string, boolean>; // default true
  sectorLabels:         Record<string, string>;
  sectorEnabled:        Record<string, boolean>; // default true
  // Sektor tambahan tenant, di luar 10 kanonik (§ 10.10) — string bebas, value=label sekaligus
  customSectors:        string[];
  businessFieldLabels:  Record<string, string>;
  // Bidang Usaha custom, dikelompokkan per Sektor (KANONIK ATAU CUSTOM, § 10.9+10.10) — mirror
  // SECTOR_SUB_FIELDS
  customBusinessFields: Partial<Record<string, string[]>>;
};

function toFormState(overrides: TaxonomyOverrides): FormState {
  const categoryLabels: Record<string, string> = {};
  const categoryEnabled: Record<string, boolean> = {};
  for (const c of BUSINESS_CATEGORY_ENUM) {
    categoryLabels[c]  = overrides.categoryLabels?.[c] ?? "";
    categoryEnabled[c] = overrides.categoryEnabled?.[c] !== false;
  }

  const sectorLabels: Record<string, string> = {};
  const sectorEnabled: Record<string, boolean> = {};
  for (const s of BUSINESS_SECTOR_ENUM) {
    sectorLabels[s]  = overrides.sectorLabels?.[s] ?? "";
    sectorEnabled[s] = overrides.sectorEnabled?.[s] !== false;
  }

  const customBusinessFields: Partial<Record<string, string[]>> = {};
  for (const [sector, items] of Object.entries(overrides.customBusinessFields ?? {})) {
    customBusinessFields[sector] = [...(items ?? [])];
  }

  return {
    fieldLabelCategory:       overrides.fieldLabels?.category ?? "",
    fieldLabelSector:         overrides.fieldLabels?.sector ?? "",
    fieldLabelBusinessFields: overrides.fieldLabels?.businessFields ?? "",
    categoryLabels,
    categoryEnabled,
    sectorLabels,
    sectorEnabled,
    customSectors: [...(overrides.customSectors ?? [])],
    businessFieldLabels: { ...(overrides.businessFieldLabels ?? {}) },
    customBusinessFields,
  };
}

// Buang string kosong sebelum kirim ke server — jangan simpan override yang isinya "" (itu
// sama saja tidak override, hemat payload + jaga default tetap bersih).
function toPayload(state: FormState): TaxonomyOverrides {
  const nonEmpty = (rec: Record<string, string>) =>
    Object.fromEntries(Object.entries(rec).filter(([, v]) => v.trim() !== ""));

  // Hanya simpan yang FALSE — hemat payload, default tetap true (item absen = aktif).
  const onlyDisabled = (rec: Record<string, boolean>) =>
    Object.fromEntries(Object.entries(rec).filter(([, v]) => v === false));

  // Bersihkan defensif sebelum kirim ke server: trim whitespace, buang string kosong (hasil
  // rename yang belum sempat diisi ulang), dan dedupe (rename bisa saja menghasilkan nilai yang
  // sekarang sama dengan item lain di sektor yang sama). Sektor yang habis jadi kosong dibuang.
  const customBusinessFields = Object.fromEntries(
    Object.entries(state.customBusinessFields)
      .map(([sec, items]) => [
        sec,
        Array.from(new Set((items ?? []).map((v) => v.trim()).filter((v) => v !== ""))),
      ] as const)
      .filter(([, items]) => items.length > 0),
  );

  const fieldLabels: TaxonomyOverrides["fieldLabels"] = {};
  if (state.fieldLabelCategory.trim())       fieldLabels.category = state.fieldLabelCategory.trim();
  if (state.fieldLabelSector.trim())         fieldLabels.sector = state.fieldLabelSector.trim();
  if (state.fieldLabelBusinessFields.trim()) fieldLabels.businessFields = state.fieldLabelBusinessFields.trim();

  return {
    fieldLabels,
    categoryLabels:       nonEmpty(state.categoryLabels),
    categoryEnabled:      onlyDisabled(state.categoryEnabled),
    sectorLabels:         nonEmpty(state.sectorLabels),
    sectorEnabled:        onlyDisabled(state.sectorEnabled),
    customSectors:        state.customSectors,
    businessFieldLabels:  nonEmpty(state.businessFieldLabels),
    customBusinessFields,
  };
}

export function EkosistemTaksonomiForm({
  slug,
  defaultOverrides,
}: {
  slug: string;
  defaultOverrides: TaxonomyOverrides;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [state, setState]     = React.useState<FormState>(() => toFormState(defaultOverrides));
  const [bidangSearch, setBidangSearch]     = React.useState("");
  const [newBidang, setNewBidang]           = React.useState("");
  const [newBidangSector, setNewBidangSector] = React.useState<string>("");
  const [newSector, setNewSector]           = React.useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await saveTaxonomyOverridesAction(slug, toPayload(state));
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Pengaturan taksonomi disimpan.");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  // Bidang Usaha baru WAJIB pilih Sektor induk — bukan kepemilikan eksklusif, murni supaya
  // item ini diprioritaskan saat Sektor itu dipilih (sama seperti Tier-3 bawaan/SECTOR_SUB_
  // FIELDS), tetap muncul (di posisi belakang) untuk sektor lain. § 10.9. Sektor induk boleh
  // kanonik ATAU custom tenant (§ 10.10) — `newBidangSector` sudah string bebas.
  //
  // Pengecekan duplikat DI-SCOPE ke Sektor yang dipilih SAJA — bukan global lintas SEMUA
  // sektor+59 item kanonik. Nama Bidang Usaha yang SAMA boleh dipakai di sektor BERBEDA (tidak
  // konflik: resolveBusinessFieldSuggestions() dedup jadi satu saran, diprioritaskan kapan pun
  // salah satu sektornya dipilih) — yang tidak boleh HANYA duplikat DI DALAM sektor yang sama.
  // Bug lama: cek global bikin nama yang kebetulan sudah kanonik di sektor LAIN (dari 59 item
  // bawaan) ditolak "sudah ada", padahal untuk sektor yang sedang ditambahkan itu genuinely baru.
  function addCustomBidang() {
    const v = newBidang.trim();
    if (!v) { toast.error("Nama Bidang Usaha tidak boleh kosong."); return; }
    if (!newBidangSector) { toast.error("Pilih Sektor untuk Bidang Usaha baru ini."); return; }

    const sector = newBidangSector;
    const canonicalForSector = SECTOR_SUB_FIELDS[sector as BusinessSector] ?? [];
    const customForSector    = state.customBusinessFields[sector] ?? [];
    if ([...canonicalForSector, ...customForSector].includes(v)) {
      toast.error(`"${v}" sudah ada di Sektor "${sector}".`);
      return;
    }

    setState((s) => ({
      ...s,
      customBusinessFields: {
        ...s.customBusinessFields,
        [sector]: [...(s.customBusinessFields[sector] ?? []), v],
      },
    }));
    setNewBidang("");
  }

  // Rename in-place (fix typo) — dikunci per index, BUKAN per value (value adalah teks yang
  // sedang diketik ulang, tidak stabil sebagai identity). Live per keystroke, tanpa validasi
  // duplikat mid-typing (biar tidak mengganggu proses ngetik) — dibersihkan defensif saat submit
  // (lihat toPayload: trim + dedupe + buang string kosong).
  function renameCustomBidang(sector: string, idx: number, value: string) {
    setState((s) => ({
      ...s,
      customBusinessFields: {
        ...s.customBusinessFields,
        [sector]: (s.customBusinessFields[sector] ?? []).map((x, i) => (i === idx ? value : x)),
      },
    }));
  }

  function removeCustomBidangAt(sector: string, idx: number) {
    setState((s) => ({
      ...s,
      customBusinessFields: {
        ...s.customBusinessFields,
        [sector]: (s.customBusinessFields[sector] ?? []).filter((_, i) => i !== idx),
      },
    }));
  }

  // Sektor baru — string bebas, langsung jadi value+label (tidak ada override label terpisah,
  // ganti dengan hapus+tambah ulang). § 10.10.
  function addCustomSector() {
    const v = newSector.trim();
    if (!v) { toast.error("Nama Sektor tidak boleh kosong."); return; }
    const allExisting = [...(BUSINESS_SECTOR_ENUM as readonly string[]), ...state.customSectors];
    if (allExisting.includes(v)) { toast.error("Sektor itu sudah ada."); return; }
    setState((s) => ({ ...s, customSectors: [...s.customSectors, v] }));
    setNewSector("");
  }

  function removeCustomSector(v: string) {
    setState((s) => ({ ...s, customSectors: s.customSectors.filter((x) => x !== v) }));
  }

  const filteredBidang = bidangSearch.trim()
    ? BUSINESS_FIELD_SUGGESTIONS.filter((b) => b.toLowerCase().includes(bidangSearch.trim().toLowerCase()))
    : BUSINESS_FIELD_SUGGESTIONS;

  const hasCustomBidang = Object.values(state.customBusinessFields).some((items) => (items?.length ?? 0) > 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <p className="text-xs text-muted-foreground -mt-2">
        Perubahan di sini HANYA mengganti teks yang ditampilkan ke anggota/pengunjung — data
        yang sudah tersimpan tidak pernah berubah. Kosongkan input untuk kembali ke label
        bawaan.
      </p>

      {/* ── Nama Field ── */}
      <section className="space-y-3">
        <div>
          <p className="text-sm font-semibold">Nama Field (Opsional)</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ganti nama field yang tampil di form Usaha — misal "Sektor" jadi "Jenis Karya", atau
            "Bidang Usaha" jadi "Spesialisasi". Ini beda dari label per-pilihan di bawah — ini
            mengganti judul field-nya sendiri. Kosongkan untuk pakai nama bawaan.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Kategori</label>
            <Input
              value={state.fieldLabelCategory}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setState((s) => ({ ...s, fieldLabelCategory: e.target.value }))
              }
              placeholder="Kategori"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Sektor</label>
            <Input
              value={state.fieldLabelSector}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setState((s) => ({ ...s, fieldLabelSector: e.target.value }))
              }
              placeholder="Sektor"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Bidang Usaha</label>
            <Input
              value={state.fieldLabelBusinessFields}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setState((s) => ({ ...s, fieldLabelBusinessFields: e.target.value }))
              }
              placeholder="Bidang Usaha"
            />
          </div>
        </div>
      </section>

      {/* ── Kategori ── */}
      <section className="space-y-3 border-t border-border pt-6">
        <div>
          <p className="text-sm font-semibold">Label & Aktivasi Kategori</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Matikan kategori yang tidak relevan (tidak akan ditawarkan lagi untuk usaha baru —
            usaha yang sudah pakai kategori itu tetap tampil normal) dan/atau ganti labelnya.
          </p>
        </div>
        <div className="space-y-2">
          {BUSINESS_CATEGORY_ENUM.map((c) => (
            <div key={c} className="grid grid-cols-[auto_1fr_1.2fr] gap-3 items-center">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.categoryEnabled[c]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setState((st) => ({ ...st, categoryEnabled: { ...st.categoryEnabled, [c]: e.target.checked } }))
                  }
                  className="h-4 w-4 rounded border-input"
                />
              </label>
              <span className={`text-sm ${state.categoryEnabled[c] ? "text-muted-foreground" : "text-muted-foreground/50 line-through"}`}>
                {c}
              </span>
              <Input
                value={state.categoryLabels[c]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setState((s) => ({ ...s, categoryLabels: { ...s.categoryLabels, [c]: e.target.value } }))
                }
                placeholder={c}
                disabled={!state.categoryEnabled[c]}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── Sektor ── */}
      <section className="space-y-3 border-t border-border pt-6">
        <div>
          <p className="text-sm font-semibold">Label & Aktivasi Sektor</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Matikan sektor yang tidak relevan (tidak akan ditawarkan lagi untuk usaha baru —
            usaha yang sudah pakai sektor itu tetap tampil normal) dan/atau ganti labelnya.
          </p>
        </div>
        <div className="space-y-2">
          {BUSINESS_SECTOR_ENUM.map((s) => (
            <div key={s} className="grid grid-cols-[auto_1fr_1.2fr] gap-3 items-center">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.sectorEnabled[s]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setState((st) => ({ ...st, sectorEnabled: { ...st.sectorEnabled, [s]: e.target.checked } }))
                  }
                  className="h-4 w-4 rounded border-input"
                />
              </label>
              <span className={`text-sm ${state.sectorEnabled[s] ? "text-muted-foreground" : "text-muted-foreground/50 line-through"}`}>
                {s}
              </span>
              <Input
                value={state.sectorLabels[s]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setState((st) => ({ ...st, sectorLabels: { ...st.sectorLabels, [s]: e.target.value } }))
                }
                placeholder={s}
                disabled={!state.sectorEnabled[s]}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── Sektor: tambah baru (§ 10.10) ── */}
      <section className="space-y-3 border-t border-border pt-6">
        <div>
          <p className="text-sm font-semibold">Tambah Sektor Baru</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sektor khusus organisasi Anda, di luar 10 sektor bawaan. Begitu ditambahkan, langsung
            bisa dipilih di form Usaha — termasuk sebagai Sektor induk untuk "Tambah Bidang Usaha
            Baru" di bawah.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={newSector}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSector(e.target.value)}
            placeholder="mis. Riset & Inovasi"
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") { e.preventDefault(); addCustomSector(); }
            }}
          />
          <Button type="button" variant="outline" onClick={addCustomSector}>Tambah</Button>
        </div>
        {state.customSectors.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {state.customSectors.map((v) => (
              <li key={v} className="flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-xs px-3 py-1">
                {v}
                <button
                  type="button"
                  onClick={() => removeCustomSector(v)}
                  className="text-primary/60 hover:text-primary"
                  aria-label={`Hapus ${v}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Bidang Usaha: tambah baru (sektor-scoped, kanonik atau custom, § 10.9+10.10) ── */}
      <section className="space-y-3 border-t border-border pt-6">
        <div>
          <p className="text-sm font-semibold">Tambah Bidang Usaha Baru</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bidang Usaha khusus organisasi Anda, dikaitkan ke Sektor tertentu — mis. Sektor
            "Kreatif" bisa ditambah "Musik", "Vokalis". Item ini akan DIDAHULUKAN sebagai
            pilihan saat anggota memilih Sektor itu (persis {BUSINESS_FIELD_SUGGESTIONS.length}
            {" "}Bidang Usaha bawaan) — tetap muncul untuk sektor lain, cuma tidak diprioritaskan.
            Sektor induk boleh kanonik atau Sektor custom yang baru ditambahkan di atas.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="sm:w-64">
            <Combobox
              options={[
                ...SECTOR_COMBOBOX_OPTIONS,
                ...state.customSectors
                  .filter((v) => !SECTOR_COMBOBOX_OPTIONS.some((o) => o.value === v))
                  .map((v) => ({ value: v, label: v })),
              ]}
              value={newBidangSector}
              onValueChange={setNewBidangSector}
              placeholder="Pilih Sektor induk..."
            />
          </div>
          <Input
            value={newBidang}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewBidang(e.target.value)}
            placeholder="mis. Musik, Vokalis..."
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") { e.preventDefault(); addCustomBidang(); }
            }}
          />
          <Button type="button" variant="outline" onClick={addCustomBidang}>Tambah</Button>
        </div>
        {hasCustomBidang && (
          <div className="space-y-4 rounded-md border border-border p-3">
            {Object.entries(state.customBusinessFields).map(([sec, items]) => {
              if (!items || items.length === 0) return null;
              return (
                <div key={sec}>
                  <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                    Sektor: {sec}
                  </p>
                  <div className="space-y-1.5">
                    {items.map((v, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={v}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            renameCustomBidang(sec, idx, e.target.value)
                          }
                          className="h-8 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeCustomBidangAt(sec, idx)}
                          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Hapus ${v || "item ini"}`}
                          title="Hapus"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Bidang Usaha: label kanonik ── */}
      <section className="space-y-3 border-t border-border pt-6">
        <div>
          <p className="text-sm font-semibold">Label Bidang Usaha Bawaan</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cari dan ganti label salah satu dari {BUSINESS_FIELD_SUGGESTIONS.length} Bidang
            Usaha bawaan. Berlaku untuk tampilan (badge/detail) — daftar pilihan saat mengisi
            form tetap memakai nama aslinya.
          </p>
        </div>
        <Input
          value={bidangSearch}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBidangSearch(e.target.value)}
          placeholder="Cari Bidang Usaha..."
        />
        <div className="max-h-96 overflow-y-auto space-y-2 rounded-md border border-border p-3">
          {filteredBidang.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Tidak ditemukan.</p>
          )}
          {filteredBidang.map((b) => (
            <div key={b} className="grid grid-cols-[1fr_1.2fr] gap-3 items-center">
              <span className="text-sm text-muted-foreground">{b}</span>
              <Input
                value={state.businessFieldLabels[b] ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setState((s) => ({ ...s, businessFieldLabels: { ...s.businessFieldLabels, [b]: e.target.value } }))
                }
                placeholder={b}
              />
            </div>
          ))}
        </div>
      </section>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan Pengaturan Taksonomi"}
      </Button>
    </form>
  );
}
