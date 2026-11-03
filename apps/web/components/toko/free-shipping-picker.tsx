"use client";

// Picker "Gratis Ongkir per Produk" — 3 mode: none/all/regions. Dipakai di product-form.tsx (admin DAN produsen — satu komponen).
// Didesain untuk sidebar sempit (±288px): di sidebar hanya segmented control + RINGKASAN (jumlah + chip) + tombol "Atur Daerah";
// pemilihan sebenarnya terjadi di dialog dua panel (Provinsi | Kabupaten/Kota) dengan pencarian, "pilih semua hasil pencarian",
// dan chip terpilih di footer. Di HP kedua panel menjadi tab. docs/arsitektur-produk-produsen.md § 18 (K40).
// Provinsi & kabupaten/kota dari endpoint list bersih RajaOngkir (/api/ongkir/provinces + /api/ongkir/cities-by-province);
// dicocokkan checkout by NAMA (lib/free-shipping-match.ts) — lihat docs/arsitektur-addon-ongkir.md § "Gratis Ongkir per Produk".

import { useState, useEffect, useMemo } from "react";
import { X, MapPin, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type FreeShippingMode   = "none" | "all" | "regions";
export type FreeShippingRegion = { id: number; name: string };

type Props = {
  mode:      FreeShippingMode;
  provinces: FreeShippingRegion[];
  cities:    FreeShippingRegion[];
  onChange: (next: { mode: FreeShippingMode; provinces: FreeShippingRegion[]; cities: FreeShippingRegion[] }) => void;
};

const MODES: { value: FreeShippingMode; label: string; hint: string }[] = [
  { value: "none",    label: "Tidak",    hint: "Pembeli membayar ongkir seperti biasa." },
  { value: "all",     label: "Semua",    hint: "Gratis ongkir ke seluruh Indonesia." },
  { value: "regions", label: "Tertentu", hint: "Gratis ongkir hanya ke daerah yang dipilih." },
];

const norm = (s: string) => s.trim().toLowerCase();

export function FreeShippingPicker({ mode, provinces, cities, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const hint = MODES.find((m) => m.value === mode)?.hint;
  const chips = [...provinces.map((p) => ({ ...p, kind: "p" as const })), ...cities.map((c) => ({ ...c, kind: "c" as const }))];
  const MAX_CHIPS = 6;

  return (
    <div className="space-y-2.5">
      {/* Segmented control */}
      <div role="radiogroup" aria-label="Mode gratis ongkir" className="grid grid-cols-3 rounded-lg bg-muted p-0.5">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={mode === m.value}
            onClick={() => onChange({ mode: m.value, provinces, cities })}
            className={cn(
              "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              mode === m.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>

      {mode === "regions" && (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-2.5">
          {chips.length === 0 ? (
            <p className="text-[11px] text-amber-600">Belum ada daerah dipilih — pilih minimal 1 provinsi atau kabupaten/kota.</p>
          ) : (
            <>
              <p className="text-[11px] font-medium">
                {provinces.length > 0 && `${provinces.length} provinsi`}
                {provinces.length > 0 && cities.length > 0 && " · "}
                {cities.length > 0 && `${cities.length} kabupaten/kota`}
              </p>
              <div className="flex flex-wrap gap-1">
                {chips.slice(0, MAX_CHIPS).map((c) => (
                  <span key={`${c.kind}${c.id}`} className="inline-flex max-w-full items-center rounded-full bg-muted px-2 py-0.5 text-[10px]">
                    <span className="truncate">{c.name}</span>
                  </span>
                ))}
                {chips.length > MAX_CHIPS && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    +{chips.length - MAX_CHIPS} lainnya
                  </span>
                )}
              </div>
            </>
          )}
          <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setOpen(true)}>
            <MapPin className="h-3.5 w-3.5" />
            {chips.length === 0 ? "Pilih Daerah" : "Atur Daerah"}
          </Button>
        </div>
      )}

      {open && (
        <RegionDialog
          provinces={provinces}
          cities={cities}
          onClose={() => setOpen(false)}
          onApply={(p, c) => { onChange({ mode, provinces: p, cities: c }); setOpen(false); }}
        />
      )}
    </div>
  );
}

// ── Dialog dua panel ────────────────────────────────────────────────────────────────────────────────

function RegionDialog({ provinces, cities, onClose, onApply }: {
  provinces: FreeShippingRegion[]; cities: FreeShippingRegion[];
  onClose: () => void; onApply: (p: FreeShippingRegion[], c: FreeShippingRegion[]) => void;
}) {
  // Salinan kerja: baru berlaku saat "Simpan" (Batal membuang perubahan).
  const [selP, setSelP] = useState<FreeShippingRegion[]>(provinces);
  const [selC, setSelC] = useState<FreeShippingRegion[]>(cities);
  const [tab, setTab] = useState<"p" | "c">("p");   // hanya dipakai di HP

  const [allProvinces, setAllProvinces] = useState<FreeShippingRegion[]>([]);
  const [provLoaded, setProvLoaded] = useState(false);
  const [provError, setProvError] = useState(false);
  const [provQ, setProvQ] = useState("");

  const [browseId, setBrowseId] = useState<number | null>(null);
  const [browseCities, setBrowseCities] = useState<FreeShippingRegion[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityQ, setCityQ] = useState("");
  const [browseQ, setBrowseQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch("/api/ongkir/provinces");
        const data = await res.json() as { provinces?: FreeShippingRegion[] };
        if (!res.ok || !data.provinces) throw new Error("gagal");
        setAllProvinces(data.provinces);
      } catch { setProvError(true); } finally { setProvLoaded(true); }
    })();
  }, []);

  useEffect(() => {
    if (!browseId) { setBrowseCities([]); return; }
    let cancelled = false;
    setCityLoading(true);
    (async () => {
      try {
        const res  = await fetch(`/api/ongkir/cities-by-province?provinceId=${browseId}`);
        const data = await res.json() as { cities?: FreeShippingRegion[] };
        if (!cancelled) setBrowseCities(data.cities ?? []);
      } catch { if (!cancelled) setBrowseCities([]); } finally { if (!cancelled) setCityLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [browseId]);

  const filteredProv = useMemo(() => allProvinces.filter((p) => norm(p.name).includes(norm(provQ))), [allProvinces, provQ]);
  const filteredBrowseProv = useMemo(() => allProvinces.filter((p) => norm(p.name).includes(norm(browseQ))), [allProvinces, browseQ]);
  const filteredCities = useMemo(() => browseCities.filter((c) => norm(c.name).includes(norm(cityQ))), [browseCities, cityQ]);
  const browseProvince = allProvinces.find((p) => p.id === browseId) ?? null;
  const browseCovered = !!browseProvince && selP.some((p) => p.id === browseProvince.id);   // seluruh provinsi sudah gratis

  const toggleP = (p: FreeShippingRegion) => setSelP((cur) => cur.some((x) => x.id === p.id) ? cur.filter((x) => x.id !== p.id) : [...cur, p]);
  const toggleC = (c: FreeShippingRegion) => setSelC((cur) => cur.some((x) => x.id === c.id) ? cur.filter((x) => x.id !== c.id) : [...cur, c]);
  const addAll = <T extends FreeShippingRegion>(cur: T[], add: T[]) => [...cur, ...add.filter((a) => !cur.some((x) => x.id === a.id))];

  const total = selP.length + selC.length;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Daerah Gratis Ongkir</DialogTitle>
          <DialogDescription>
            Centang provinsi untuk menggratiskan seluruh provinsi itu, atau pilih kabupaten/kota tertentu saja.
          </DialogDescription>
        </DialogHeader>

        {/* Tab (HP) */}
        <div className="grid grid-cols-2 rounded-lg bg-muted p-0.5 md:hidden">
          {([["p", `Provinsi${selP.length ? ` (${selP.length})` : ""}`], ["c", `Kabupaten/Kota${selC.length ? ` (${selC.length})` : ""}`]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={cn("rounded-md px-2 py-1.5 text-xs font-medium", tab === k ? "bg-background shadow-sm" : "text-muted-foreground")}>
              {label}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2">
          {/* Panel Provinsi */}
          <section className={cn("flex min-h-0 flex-col gap-2", tab !== "p" && "hidden md:flex")}>
            <h3 className="hidden text-sm font-medium md:block">Provinsi {selP.length > 0 && <span className="text-muted-foreground">({selP.length})</span>}</h3>
            <Input value={provQ} onChange={(e) => setProvQ(e.target.value)} placeholder="Cari provinsi..." className="h-8 text-xs" />
            <div className="flex gap-2 text-[11px]">
              <button type="button" className="text-primary hover:underline disabled:opacity-40" disabled={filteredProv.length === 0}
                onClick={() => setSelP((cur) => addAll(cur, filteredProv))}>
                {provQ.trim() ? "Pilih semua hasil" : "Pilih semua"}
              </button>
              <span className="text-muted-foreground">·</span>
              <button type="button" className="text-muted-foreground hover:text-destructive disabled:opacity-40" disabled={selP.length === 0} onClick={() => setSelP([])}>
                Kosongkan
              </button>
            </div>
            <div className="min-h-[12rem] flex-1 overflow-y-auto rounded-lg border border-border md:max-h-[46vh]">
              {!provLoaded ? <Loading /> : provError ? <p className="p-3 text-xs text-destructive">Gagal memuat daftar provinsi. Tutup lalu coba lagi.</p> :
                filteredProv.length === 0 ? <p className="p-3 text-xs text-muted-foreground">Tidak ada hasil.</p> :
                filteredProv.map((p) => <Row key={p.id} checked={selP.some((x) => x.id === p.id)} label={p.name} onToggle={() => toggleP(p)} />)}
            </div>
          </section>

          {/* Panel Kabupaten/Kota */}
          <section className={cn("flex min-h-0 flex-col gap-2", tab !== "c" && "hidden md:flex")}>
            <h3 className="hidden text-sm font-medium md:block">Kabupaten/Kota {selC.length > 0 && <span className="text-muted-foreground">({selC.length})</span>}</h3>
            {!browseProvince ? (
              <>
                <Input value={browseQ} onChange={(e) => setBrowseQ(e.target.value)} placeholder="Pilih provinsi dulu — cari provinsi..." className="h-8 text-xs" />
                <div className="min-h-[12rem] flex-1 overflow-y-auto rounded-lg border border-border md:max-h-[46vh]">
                  {!provLoaded ? <Loading /> : filteredBrowseProv.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setBrowseId(p.id); setCityQ(""); }}
                      className="flex w-full items-center justify-between border-b border-border px-3 py-2 text-left text-xs last:border-0 hover:bg-muted/50">
                      <span>{p.name}</span>
                      <span className="text-muted-foreground">›</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <button type="button" onClick={() => { setBrowseId(null); setCityQ(""); }} className="flex items-center gap-1 text-left text-xs text-primary hover:underline">
                  ‹ {browseProvince.name} <span className="text-muted-foreground">(ganti provinsi)</span>
                </button>
                {browseCovered ? (
                  <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    Seluruh {browseProvince.name} sudah gratis ongkir (provinsi dicentang), jadi tidak perlu memilih kabupaten/kota.
                  </p>
                ) : (
                  <>
                    <Input value={cityQ} onChange={(e) => setCityQ(e.target.value)} placeholder="Cari kabupaten/kota..." className="h-8 text-xs" />
                    <div className="flex gap-2 text-[11px]">
                      <button type="button" className="text-primary hover:underline disabled:opacity-40" disabled={filteredCities.length === 0}
                        onClick={() => setSelC((cur) => addAll(cur, filteredCities))}>
                        {cityQ.trim() ? "Pilih semua hasil" : `Pilih semua di ${browseProvince.name}`}
                      </button>
                      <span className="text-muted-foreground">·</span>
                      <button type="button" className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                        disabled={!selC.some((c) => browseCities.some((b) => b.id === c.id))}
                        onClick={() => setSelC((cur) => cur.filter((c) => !browseCities.some((b) => b.id === c.id)))}>
                        Kosongkan provinsi ini
                      </button>
                    </div>
                    <div className="min-h-[12rem] flex-1 overflow-y-auto rounded-lg border border-border md:max-h-[46vh]">
                      {cityLoading ? <Loading /> : filteredCities.length === 0 ? <p className="p-3 text-xs text-muted-foreground">Tidak ada hasil.</p> :
                        filteredCities.map((c) => <Row key={c.id} checked={selC.some((x) => x.id === c.id)} label={c.name} onToggle={() => toggleC(c)} />)}
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </div>

        {/* Terpilih */}
        {total > 0 && (
          <div className="max-h-20 overflow-y-auto rounded-lg bg-muted/40 p-2">
            <div className="flex flex-wrap gap-1">
              {selP.map((p) => <Chip key={`p${p.id}`} label={p.name} bold onRemove={() => toggleP(p)} />)}
              {selC.map((c) => <Chip key={`c${c.id}`} label={c.name} onRemove={() => toggleC(c)} />)}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <p className="self-center text-[11px] text-muted-foreground">
            {total === 0 ? "Belum ada daerah dipilih." : `${selP.length} provinsi · ${selC.length} kabupaten/kota dipilih`}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="button" disabled={total === 0} onClick={() => onApply(selP, selC)}>Simpan</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onToggle}
      className={cn("flex w-full items-center gap-2.5 border-b border-border px-3 py-2 text-left text-xs last:border-0 hover:bg-muted/50", checked && "bg-primary/5")}>
      <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", checked ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

function Chip({ label, bold, onRemove }: { label: string; bold?: boolean; onRemove: () => void }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[10px] ring-1 ring-border", bold && "font-medium")}>
      {label}
      <button type="button" onClick={onRemove} aria-label={`Hapus ${label}`} className="hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
    </span>
  );
}

function Loading() {
  return <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat...</p>;
}
