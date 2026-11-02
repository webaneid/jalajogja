"use client";

// Formulir pengajuan Produsen (sisi anggota) — docs/arsitektur-pengajuan-produsen.md § 7.
// Server adalah sumber kebenaran: setiap aksi/unggah mengembalikan DraftView terbaru. Klien hanya menyimpan teks yang sedang diketik
// dan tidak pernah memegang path berkas (hanya id + URL penyaji berotorisasi).
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, FileText, ImagePlus, Loader2, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { RegencyCombobox } from "@/components/ui/regency-combobox";
import {
  saveApplicationDraftAction, submitApplicationAction, cancelApplicationAction,
  discardApplicationDraftAction, removeApplicationItemAction,
} from "./actions";
import {
  APP_DOC_KINDS, APP_FIELD_LIMITS, APP_MAX_DOCUMENTS, APP_MAX_LINKS, APP_MAX_PROCESS, APP_MAX_SAMPLES, APP_PROCESS_DAYS,
  type DraftView, type FileView,
} from "@/lib/producer-application";
import type { SourceOption } from "@/lib/producer-application.server";

type Props = {
  slug: string; baseUrl: string; enabled: boolean;
  open: DraftView | null; last: DraftView | null; sources: SourceOption[]; originRegencyName: string | null;
};

type SampleRow = { id: string | null; name: string; umum: string; anggota: string; file: FileView | null };
const SOURCE_LABEL = { usaha: "Usaha", pesantren: "Pesantren", profesional: "Profesional" } as const;
const fmtDate = (iso: string) => new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric" });
const rupiah = (n: number | null) => (n == null ? "—" : `Rp ${n.toLocaleString("id-ID")}`);

function FileThumb({ f, onRemove, busy }: { f: FileView; onRemove?: () => void; busy?: boolean }) {
  const isPdf = f.mime === "application/pdf";
  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30">
      {isPdf ? (
        <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-primary hover:underline">
          <FileText className="h-6 w-6" /> PDF
        </a>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={f.url} alt="" className="h-full w-full object-cover" />
      )}
      {onRemove && (
        <button type="button" disabled={busy} onClick={onRemove} aria-label="Hapus"
          className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-destructive shadow hover:bg-background disabled:opacity-50">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function ProducerApplicationClient({ slug, baseUrl, enabled, open, last, sources, originRegencyName }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [view, setView] = useState<DraftView | null>(open);

  // ── Isian lokal (teks yang sedang diketik) ──
  const [sourceKey, setSourceKey] = useState(open?.sourceType && open.sourceId ? `${open.sourceType}:${open.sourceId}` : "");
  const [brand, setBrand] = useState(open?.brandName ?? "");
  const [categories, setCategories] = useState(open?.productCategories ?? "");
  const [description, setDescription] = useState(open?.description ?? "");
  const [own, setOwn] = useState(open?.ownProductDeclared ?? false);
  const [share, setShare] = useState(open?.offeredSharePercent ?? "");
  const [opsName, setOpsName] = useState(open?.opsName ?? "");
  const [opsWa, setOpsWa] = useState(open?.opsWhatsapp ?? "");
  const [team, setTeam] = useState(open?.teamSize ?? "");
  const [days, setDays] = useState<number | null>(open?.processDays ?? null);
  const [regencyId, setRegencyId] = useState<number | null>(open?.originRegencyId ?? null);
  const [regencyName, setRegencyName] = useState<string | null>(originRegencyName);
  const [links, setLinks] = useState<string[]>([...(open?.links ?? []), "", "", ""].slice(0, APP_MAX_LINKS));
  const [samples, setSamples] = useState<SampleRow[]>(
    open && open.samples.length
      ? open.samples.map((s) => ({ id: s.id, name: s.name, umum: s.estPriceUmum?.toString() ?? "", anggota: s.estPriceAnggota?.toString() ?? "", file: s.file }))
      : [{ id: null, name: "", umum: "", anggota: "", file: null }],
  );
  const [docKind, setDocKind] = useState<string>(APP_DOC_KINDS[0]);
  const [docNote, setDocNote] = useState("");
  const docInput = useRef<HTMLInputElement>(null);
  const processInput = useRef<HTMLInputElement>(null);
  const sampleInputs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Tampilan status (bukan form) ──
  if (view?.status === "pending") {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-2">
          <div className="flex items-center gap-2 font-medium"><Clock className="h-5 w-5 text-amber-600" /> Pengajuan sedang ditinjau pengurus</div>
          <p className="text-sm text-muted-foreground">Dikirim {view.submittedAt ? fmtDate(view.submittedAt) : "—"}. Anda akan diberi tahu lewat email setelah ada keputusan.</p>
        </div>
        <div className="rounded-xl border border-border divide-y divide-border text-sm">
          <div className="flex justify-between gap-3 p-3"><span className="text-muted-foreground">Brand</span><span className="font-medium">{view.brandName}</span></div>
          <div className="flex justify-between gap-3 p-3"><span className="text-muted-foreground">Bagi hasil ditawarkan</span><span className="font-medium">{view.offeredSharePercent}%</span></div>
          <div className="p-3 space-y-2">
            <span className="text-muted-foreground">Contoh produk</span>
            {view.samples.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                {s.file && <FileThumb f={s.file} />}
                <div><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">Umum {rupiah(s.estPriceUmum)} · Anggota {rupiah(s.estPriceAnggota)}</p></div>
              </div>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button variant="outline" disabled={pending} onClick={() => {
          setError("");
          start(async () => {
            const res = await cancelApplicationAction(slug);
            if (!res.success) setError(res.error); else router.refresh();
          });
        }}>{pending ? "Memproses..." : "Batalkan Pengajuan"}</Button>
      </div>
    );
  }

  // ── Form tidak tersedia ──
  if (!enabled) {
    return (
      <div className="space-y-4">
        {last?.status === "rejected" && <RejectedBanner last={last} />}
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center space-y-1">
          <p className="font-medium">Pengajuan produsen sedang ditutup</p>
          <p className="text-sm text-muted-foreground">Tenant ini belum membuka pengajuan. Cek kembali nanti.</p>
        </div>
      </div>
    );
  }

  const available = sources.filter((s) => !s.taken);

  // ── Aksi ──
  const currentInput = () => ({
    sourceType: sourceKey.split(":")[0] || null, sourceId: sourceKey.split(":")[1] || null,
    brandName: brand, productCategories: categories, description, ownProductDeclared: own,
    offeredSharePercent: share, opsName, opsWhatsapp: opsWa, teamSize: team, processDays: days, originRegencyId: regencyId,
    links: links.filter((l) => l.trim()),
    samples: samples.map((s) => ({ id: s.id, name: s.name, estPriceUmum: s.umum, estPriceAnggota: s.anggota })),
  });

  // Gabungkan keadaan server (berkas/id) ke isian lokal TANPA menimpa teks yang sedang diketik
  const adopt = (v: DraftView) => {
    setView(v);
    setSamples((cur) => v.samples.length === 0 && cur.length
      ? cur.map((c) => ({ ...c, id: null, file: null }))
      : cur.map((c, i) => ({ ...c, id: v.samples[i]?.id ?? null, file: v.samples[i]?.file ?? null })));
  };

  const saveNow = async (): Promise<DraftView | null> => {
    const res = await saveApplicationDraftAction(slug, currentInput());
    if (!res.success) { setError(res.error); return null; }
    adopt(res.view);
    return res.view;
  };

  const save = () => { setError(""); setNotice(""); start(async () => { if (await saveNow()) setNotice("Draf tersimpan."); }); };

  const submit = () => {
    setError(""); setNotice("");
    start(async () => {
      if (!(await saveNow())) return;
      const res = await submitApplicationAction(slug);
      if (!res.success) { setError(res.error); return; }
      setView(res.view);
      router.refresh();
    });
  };

  const discard = () => {
    setError(""); setNotice("");
    start(async () => {
      const res = await discardApplicationDraftAction(slug);
      if (!res.success) setError(res.error); else router.refresh();
    });
  };

  const upload = async (key: string, fields: Record<string, string>, file: File, sampleIndex?: number) => {
    setError(""); setNotice(""); setUploading(key);
    try {
      const saved = await saveNow();                        // pastikan draf + teks tersimpan sebelum berkas dilampirkan
      if (!saved) return;
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      if (sampleIndex !== undefined) {                      // contoh produk dirujuk lewat ID dari server, bukan posisi
        const sid = saved.samples[sampleIndex]?.id;
        if (!sid) { setError("Contoh produk belum tersimpan. Coba lagi."); return; }
        fd.append("sampleId", sid);
      }
      fd.append("file", file);
      const res = await fetch(`/api/produsen/pengajuan/upload?tenant=${encodeURIComponent(slug)}`, { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string; view?: DraftView };
      if (!res.ok || !data.view) { setError(data.error ?? "Gagal mengunggah berkas."); return; }
      adopt(data.view);
    } finally { setUploading(null); }
  };

  const removeItem = (type: "sample" | "process" | "document", id: string) => {
    setError(""); setNotice("");
    start(async () => {
      const res = await removeApplicationItemAction(slug, { type, id });
      if (!res.success) { setError(res.error); return; }
      setView(res.view);
      if (type === "sample") setSamples((cur) => { const next = cur.filter((c) => c.id !== id); return next.length ? next : [{ id: null, name: "", umum: "", anggota: "", file: null }]; });
    });
  };

  const setSample = (i: number, patch: Partial<SampleRow>) => setSamples((cur) => cur.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const busy = pending || uploading !== null;

  return (
    <div className="space-y-8">
      {last?.status === "rejected" && <RejectedBanner last={last} />}

      <div className="rounded-lg bg-muted/50 border border-border p-4 text-xs text-muted-foreground space-y-1">
        <p>• Pengajuan dikurasi pengurus berdasarkan: produk milik sendiri, brand sendiri, dan tim yang siap memproses pesanan.</p>
        <p>• Tawaran bagi hasil Anda menjadi salah satu bahan pertimbangan pengurus.</p>
        <p>• Berkas yang Anda unggah hanya bisa dilihat Anda dan pengurus, dan dihapus otomatis setelah ada keputusan.</p>
      </div>

      {/* 1. Sumber */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">1. Usaha yang diajukan <span className="text-destructive">*</span></h2>
        {available.length === 0 ? (
          <p className="text-sm text-destructive">
            Anda belum memiliki data usaha (atau pesantren/profesional) yang bisa diajukan. Lengkapi dulu di{" "}
            <a className="underline" href={`${baseUrl}/akun/usaha`}>data usaha</a>.
          </p>
        ) : (
          <div className="space-y-2">
            {available.map((s) => {
              const k = `${s.type}:${s.id}`;
              return (
                <label key={k} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${sourceKey === k ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                  <input type="radio" name="source" checked={sourceKey === k} onChange={() => setSourceKey(k)} className="accent-primary" />
                  <div><p className="text-sm font-medium">{s.label}</p><p className="text-xs text-muted-foreground">{SOURCE_LABEL[s.type]}</p></div>
                </label>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Brand & produk */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">2. Brand &amp; produk</h2>
        <div className="space-y-1.5">
          <Label>Nama brand <span className="text-destructive">*</span></Label>
          <Input value={brand} maxLength={APP_FIELD_LIMITS.brand.max} onChange={(e) => setBrand(e.target.value)} placeholder="Nama brand produk Anda" />
        </div>
        <div className="space-y-1.5">
          <Label>Jenis barang yang dijual</Label>
          <Input value={categories} maxLength={APP_FIELD_LIMITS.categories} onChange={(e) => setCategories(e.target.value)} placeholder="Mis. makanan ringan, fashion muslim" />
          <p className="text-xs text-muted-foreground">Saat ini hanya produk fisik (barang yang dikirim). Produk digital dan jasa menyusul.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Deskripsi usaha &amp; produk <span className="text-destructive">*</span></Label>
          <textarea rows={4} value={description} maxLength={APP_FIELD_LIMITS.description.max} onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Ceritakan usaha dan produk Anda (minimal 20 karakter)" />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
          <span>Produk ini dibuat/dimiliki sendiri, bukan jual-beli ulang produk pihak lain. <span className="text-destructive">*</span></span>
        </label>
      </section>

      {/* 3. Penawaran */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">3. Penawaran bagi hasil <span className="text-destructive">*</span></h2>
        <div className="flex items-center gap-3">
          <Input type="number" min={0.5} max={99} step={0.5} value={share} onChange={(e) => setShare(e.target.value)} className="w-28" />
          <span className="text-sm text-muted-foreground">% dari harga jual untuk tenant</span>
        </div>
        <p className="text-xs text-muted-foreground">Persentase dari harga jual produk yang Anda tawarkan kepada tenant. Pengurus menilai tawaran ini dan dapat menyesuaikannya saat menyetujui.</p>
      </section>

      {/* 4. Contoh produk */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">4. Contoh produk <span className="text-destructive">*</span> <span className="font-normal text-muted-foreground">(minimal 1, maksimal {APP_MAX_SAMPLES})</span></h2>
        {samples.map((s, i) => (
          <div key={s.id ?? `new-${i}`} className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex gap-3">
              {s.file ? <FileThumb f={s.file} /> : (
                <button type="button" disabled={busy} onClick={() => sampleInputs.current[i]?.click()}
                  className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/50 disabled:opacity-50">
                  {uploading === `sample-${i}` ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />} Foto
                </button>
              )}
              <input ref={(el) => { sampleInputs.current[i] = el; }} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(`sample-${i}`, { slot: "sample" }, f, i); }} />
              <div className="min-w-0 flex-1 space-y-2">
                <Input value={s.name} maxLength={APP_FIELD_LIMITS.sampleName} onChange={(e) => setSample(i, { name: e.target.value })} placeholder="Nama produk" />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" min={0} value={s.umum} onChange={(e) => setSample(i, { umum: e.target.value })} placeholder="Harga jual umum (Rp)" />
                  <Input type="number" min={0} value={s.anggota} onChange={(e) => setSample(i, { anggota: e.target.value })} placeholder="Harga anggota (Rp)" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              {s.file && <button type="button" disabled={busy} onClick={() => sampleInputs.current[i]?.click()} className="text-primary hover:underline">Ganti foto</button>}
              {samples.length > 1 || s.id ? (
                <button type="button" disabled={busy} className="ml-auto text-destructive hover:underline"
                  onClick={() => (s.id ? removeItem("sample", s.id) : setSamples((cur) => (cur.length > 1 ? cur.filter((_, idx) => idx !== i) : cur)))}>
                  Hapus contoh ini
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {samples.length < APP_MAX_SAMPLES && (
          <Button type="button" variant="outline" size="sm" disabled={busy}
            onClick={() => setSamples((cur) => [...cur, { id: null, name: "", umum: "", anggota: "", file: null }])}>
            + Tambah contoh produk
          </Button>
        )}
      </section>

      {/* 5. Operasional */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">5. Operasional pesanan</h2>
        <div className="space-y-1.5">
          <Label>Nama penanggung jawab pesanan <span className="text-destructive">*</span></Label>
          <Input value={opsName} maxLength={APP_FIELD_LIMITS.opsName} onChange={(e) => setOpsName(e.target.value)} />
        </div>
        <PhoneInput label="WhatsApp penanggung jawab" required value={opsWa} onChange={setOpsWa} />
        <div className="space-y-1.5">
          <Label>Jumlah orang di tim <span className="text-destructive">*</span></Label>
          <Input type="number" min={1} max={999} value={team} onChange={(e) => setTeam(e.target.value)} className="w-28" />
        </div>
        <div className="space-y-1.5">
          <Label>Kesanggupan memproses pesanan <span className="text-destructive">*</span></Label>
          <div className="flex flex-wrap gap-2">
            {APP_PROCESS_DAYS.map((d) => (
              <button key={d} type="button" onClick={() => setDays(d)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${days === d ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"}`}>
                Dalam {d}×24 jam
              </button>
            ))}
          </div>
        </div>
        <RegencyCombobox label="Kota/kabupaten asal pengiriman" required value={regencyId} displayName={regencyName}
          onChange={(id, name) => { setRegencyId(id); setRegencyName(name); }} placeholder="Ketik nama kabupaten / kota..." />
        <p className="text-xs text-muted-foreground -mt-2">Alamat gudang lengkap diisi kemudian di Profil portal produsen.</p>
      </section>

      {/* 6. Bukti tambahan */}
      <section className="space-y-5">
        <h2 className="text-sm font-semibold">6. Bukti tambahan <span className="font-normal text-muted-foreground">(opsional, memperkuat pengajuan)</span></h2>

        <div className="space-y-2">
          <Label>Tautan Instagram / marketplace / website (maks {APP_MAX_LINKS})</Label>
          {links.map((l, i) => (
            <Input key={i} value={l} maxLength={APP_FIELD_LIMITS.link} placeholder="https://..."
              onChange={(e) => setLinks((cur) => cur.map((c, idx) => (idx === i ? e.target.value : c)))} />
          ))}
        </div>

        <div className="space-y-2">
          <Label>Foto proses produksi (maks {APP_MAX_PROCESS})</Label>
          <div className="flex flex-wrap gap-2">
            {view?.processFiles.map((f) => <FileThumb key={f.id} f={f} busy={busy} onRemove={() => removeItem("process", f.id)} />)}
            {(view?.processFiles.length ?? 0) < APP_MAX_PROCESS && (
              <button type="button" disabled={busy} onClick={() => processInput.current?.click()}
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/50 disabled:opacity-50">
                {uploading === "process" ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />} Tambah
              </button>
            )}
          </div>
          <input ref={processInput} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload("process", { slot: "process" }, f); }} />
        </div>

        <div className="space-y-2">
          <Label>Dokumen legalitas (maks {APP_MAX_DOCUMENTS}) — gambar atau PDF, maks 5 MB untuk PDF</Label>
          <div className="space-y-2">
            {view?.documents.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                <FileThumb f={d.file} busy={busy} onRemove={() => removeItem("document", d.id)} />
                <div className="min-w-0 text-sm"><p className="font-medium">{d.kind}</p>{d.note && <p className="truncate text-xs text-muted-foreground">{d.note}</p>}</div>
              </div>
            ))}
          </div>
          {(view?.documents.length ?? 0) < APP_MAX_DOCUMENTS && (
            <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
              <div className="flex flex-wrap gap-2">
                {APP_DOC_KINDS.map((k) => (
                  <button key={k} type="button" onClick={() => setDocKind(k)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${docKind === k ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"}`}>{k}</button>
                ))}
              </div>
              <Input value={docNote} maxLength={APP_FIELD_LIMITS.docNote} onChange={(e) => setDocNote(e.target.value)} placeholder="Keterangan (opsional)" />
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => docInput.current?.click()}>
                {uploading === "document" ? "Mengunggah..." : "Pilih berkas dokumen"}
              </Button>
              <input ref={docInput} type="file" accept="image/*,application/pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload("document", { slot: "document", kind: docKind, note: docNote }, f).then(() => setDocNote("")); }} />
            </div>
          )}
        </div>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && <p className="text-sm text-green-700">{notice}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={save}>{pending ? "Menyimpan..." : "Simpan Draf"}</Button>
        <Button type="button" disabled={busy || available.length === 0} onClick={submit}>{pending ? "Memproses..." : "Kirim Pengajuan"}</Button>
        {view?.status === "draft" && (
          <Button type="button" variant="ghost" disabled={busy} className="text-destructive" onClick={discard}>Buang Draf</Button>
        )}
      </div>
    </div>
  );
}

function RejectedBanner({ last }: { last: DraftView }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-1">
      <div className="flex items-center gap-2 text-sm font-medium text-destructive"><XCircle className="h-4 w-4" /> Pengajuan sebelumnya ditolak</div>
      {last.rejectionReason && <p className="text-sm">{last.rejectionReason}</p>}
      <p className="text-xs text-muted-foreground">Anda boleh mengajukan kembali dengan mengisi formulir di bawah.</p>
    </div>
  );
}
