"use client";

// Aksi keputusan Pengajuan Produsen. Server memeriksa ulang SEMUA (keanggotaan, akun, sumber, status) — daftar periksa & peringatan di sini
// hanya alat bantu penyetuju, tidak mengikat. Doc: docs/arsitektur-pengajuan-produsen.md § 10.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { approveProducerApplicationAction, rejectProducerApplicationAction } from "../actions";

const CHECKS = ["Produk milik sendiri (bukan jual-beli ulang)", "Brand jelas dan sesuai usahanya", "Ada penanggung jawab & tim yang siap memproses pesanan", "Bukti proses produksi / tautan meyakinkan", "Legalitas sesuai jenis barang (PIRT/BPOM/Halal bila perlu)", "Foto produk layak dan harga masuk akal", "Tawaran bagi hasil menarik bagi tenant"];

export function ProducerApplicationReview({ slug, id, offeredShare, blockers }: { slug: string; id: string; offeredShare: string; blockers: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [share, setShare] = useState(offeredShare);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [checked, setChecked] = useState<boolean[]>(CHECKS.map(() => false));
  const [error, setError] = useState("");

  const approve = () => {
    setError("");
    start(async () => {
      const res = await approveProducerApplicationAction(slug, id, { sharePercent: share, note });
      if (!res.success) setError(res.error); else router.refresh();
    });
  };
  const reject = () => {
    setError("");
    start(async () => {
      const res = await rejectProducerApplicationAction(slug, id, { reason, note });
      if (!res.success) setError(res.error); else router.refresh();
    });
  };

  return (
    <section className="space-y-4 rounded-xl border border-border p-4">
      <h2 className="text-sm font-semibold">Keputusan</h2>

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Daftar periksa (alat bantu, tidak mengikat)</p>
        {CHECKS.map((c, i) => (
          <label key={c} className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={checked[i]} onChange={(e) => setChecked((cur) => cur.map((x, idx) => (idx === i ? e.target.checked : x)))} />
            <span>{c}</span>
          </label>
        ))}
      </div>

      {blockers.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {blockers.map((b) => <li key={b}>• {b}</li>)}
          <li className="text-xs text-muted-foreground">Persetujuan akan ditolak server selama hal di atas belum terpenuhi.</li>
        </ul>
      )}

      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => { setMode("approve"); setError(""); }}>Setujui…</Button>
          <Button type="button" variant="outline" className="text-destructive" onClick={() => { setMode("reject"); setError(""); }}>Tolak…</Button>
        </div>
      )}

      {mode === "approve" && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="space-y-1.5">
            <Label>Bagi hasil yang disepakati (% dari harga jual untuk tenant)</Label>
            <div className="flex items-center gap-3">
              <Input type="number" min={0.5} max={99} step={0.5} value={share} onChange={(e) => setShare(e.target.value)} className="w-28" />
              <span className="text-xs text-muted-foreground">Tawaran pemohon: {offeredShare || "—"}%</span>
            </div>
            <p className="text-xs text-muted-foreground">Berlaku untuk pesanan BARU dan tercantum pada Profil produsen.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Catatan internal (opsional, tidak terlihat pemohon)</Label>
            <textarea rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <p className="text-xs">Menyetujui akan <strong>menjadikan pemohon produsen</strong> dan <strong>memberi akses login ke Portal Produsen</strong> (batas produk awal 3).</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" disabled={pending || blockers.length > 0} onClick={approve}>{pending ? "Memproses..." : "Ya, Setujui"}</Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setMode("idle")}>Batal</Button>
          </div>
        </div>
      )}

      {mode === "reject" && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="space-y-1.5">
            <Label>Alasan penolakan <span className="text-destructive">*</span> (dibaca pemohon)</Label>
            <textarea rows={3} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Jelaskan agar pemohon bisa memperbaiki pengajuan berikutnya (min. 10 karakter)" />
          </div>
          <div className="space-y-1.5">
            <Label>Catatan internal (opsional)</Label>
            <textarea rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="destructive" disabled={pending} onClick={reject}>{pending ? "Memproses..." : "Ya, Tolak"}</Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setMode("idle")}>Batal</Button>
          </div>
        </div>
      )}
    </section>
  );
}
