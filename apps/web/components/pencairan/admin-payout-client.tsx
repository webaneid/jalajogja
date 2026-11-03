"use client";

// Komponen interaktif Pencairan sisi ADMIN/BENDAHARA: setujui/tolak, catat transfer (bukti WAJIB), refund/tahan, pelunasan hutang, pengaturan.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Upload, Copy, Loader2, FileText, Settings2, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MediaPicker, type MediaItem } from "@/components/media/media-picker";
import {
  approvePayoutAction, rejectPayoutAction, markPayoutPaidAction, recordRefundAction, recordRepaymentAction, setHoldAction, savePayoutSettingsAction,
} from "@/app/(dashboard)/app/[tenant]/toko/pencairan/actions";
import { rupiah } from "@/lib/rupiah";

function useAction() {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const run = (fn: () => Promise<{ success: boolean; error?: string; message?: string }>, onOk?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.success) { toast.error(res.error ?? "Gagal."); return; }
      toast.success(res.message ?? "Berhasil.");
      onOk?.(); router.refresh();
    });
  return { isPending, run };
}

export function CopyButton({ value, label = "Salin" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button type="button" variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { toast.error("Tidak bisa menyalin."); } }}>
      <Copy className="mr-1.5 h-3.5 w-3.5" /> {done ? "Tersalin" : label}
    </Button>
  );
}

/** Pemilih bukti dari Media Library tenant (gambar/PDF). */
function ProofPicker({ slug, value, onChange }: { slug: string; value: MediaItem | null; onChange: (m: MediaItem | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          {value.mimeType.startsWith("image/")
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={value.variants?.square ?? value.url} alt="" className="h-14 w-14 rounded-lg object-cover" />
            : <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white"><FileText className="h-6 w-6 text-muted-foreground" /></div>}
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{value.originalName}</p><p className="text-xs text-emerald-800">Bukti terlampir</p></div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>Ganti</Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="h-auto w-full flex-col gap-1 border-dashed py-5" onClick={() => setOpen(true)}>
          <Upload className="h-5 w-5 text-muted-foreground" /><span className="text-sm">Unggah / pilih bukti transfer</span><span className="text-xs font-normal text-muted-foreground">Gambar atau PDF — wajib</span>
        </Button>
      )}
      <MediaPicker slug={slug} open={open} onClose={() => setOpen(false)} onSelect={(m) => { onChange(m); setOpen(false); }} module="general" accept={["image/", "application/pdf"]} />
    </div>
  );
}

export type SourceOption = { value: string; label: string; fee: number };

export function PayoutDecisionPanel({ slug, payoutId, status, subtotal, sources, defaultFee, maxFee }: {
  slug: string; payoutId: string; status: "requested" | "approved"; subtotal: number; sources: SourceOption[]; defaultFee: number; maxFee: number;
}) {
  const { isPending, run } = useAction();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [source, setSource] = useState("");
  const [fee, setFee] = useState(String(defaultFee));
  const [proof, setProof] = useState<MediaItem | null>(null);
  const [note, setNote] = useState("");
  const feeNum = Number(fee) || 0;
  const net = Math.max(0, subtotal - feeNum);
  const feeInvalid = feeNum < 0 || feeNum > maxFee || feeNum >= subtotal;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      {status === "requested" ? (
        <>
          <div>
            <h2 className="text-sm font-semibold">Tinjau pengajuan</h2>
            <p className="text-xs text-muted-foreground">Periksa rincian dan rekening di atas. Setelah disetujui, catat transfer beserta bukti.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={isPending} onClick={() => run(() => approvePayoutAction(slug, payoutId))}>{isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />} Setujui pengajuan</Button>
            <Button variant="outline" disabled={isPending} onClick={() => setRejectOpen(true)}><XCircle className="mr-1.5 h-4 w-4" /> Tolak</Button>
          </div>
        </>
      ) : (
        <>
          <div>
            <h2 className="text-sm font-semibold">Catat transfer</h2>
            <p className="text-xs text-muted-foreground">Transfer dulu ke rekening produsen, lalu lampirkan bukti. Bukti ini juga dilihat produsen.</p>
          </div>
          {sources.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Rekening tenant yang dipakai mentransfer</label>
              <Combobox options={sources.map((s) => ({ value: s.value, label: s.label }))} value={source} onValueChange={(v) => { setSource(v); const s = sources.find((x) => x.value === v); if (s) setFee(String(s.fee)); }} placeholder="Pilih rekening sumber" searchPlaceholder="Cari rekening..." />
              <p className="text-[11px] text-muted-foreground">Sesama bank biasanya tanpa biaya transfer; beda bank mengikuti pengaturan biaya.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Biaya transfer (ditanggung produsen)</label>
            <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Rp</span><Input type="number" min={0} max={maxFee} step={500} value={fee} onChange={(e) => setFee(e.target.value)} className="max-w-[10rem]" /></div>
            {feeInvalid && <p className="text-[11px] text-rose-600">Biaya harus antara Rp0 dan {rupiah(Math.min(maxFee, subtotal - 1))}.</p>}
          </div>
          <div className="rounded-xl bg-muted/50 p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Jumlah pencairan</span><span className="tabular-nums">{rupiah(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Biaya transfer</span><span className="tabular-nums text-rose-600">−{rupiah(feeNum)}</span></div>
            <div className="mt-1.5 flex justify-between border-t border-border pt-1.5 font-semibold"><span>Transfer ke produsen</span><span className="tabular-nums">{rupiah(net)}</span></div>
          </div>
          <div className="space-y-1.5"><label className="text-xs font-medium">Bukti transfer <span className="text-rose-600">*</span></label><ProofPicker slug={slug} value={proof} onChange={setProof} /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium">Catatan (opsional)</label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. via BI-Fast, ref. 12345" maxLength={300} /></div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={isPending || !proof || feeInvalid}
              onClick={() => run(() => markPayoutPaidAction(slug, payoutId, { transferFee: feeNum, proofMediaId: proof!.id, sourceBankLabel: sources.find((s) => s.value === source)?.label, note }))}>
              {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />} Catat transfer & selesaikan
            </Button>
            <Button variant="outline" disabled={isPending} onClick={() => setRejectOpen(true)}>Batalkan & tolak</Button>
          </div>
          {!proof && <p className="text-xs text-muted-foreground">Tombol aktif setelah bukti transfer dilampirkan.</p>}
        </>
      )}

      <Dialog open={rejectOpen} onOpenChange={(o) => !isPending && setRejectOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Tolak pengajuan</DialogTitle><DialogDescription>Alasan akan dibaca produsen. Saldo produsen kembali utuh dan bisa diajukan lagi.</DialogDescription></DialogHeader>
          <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="mis. Nama pemilik rekening tidak sesuai dengan nama produsen" maxLength={300} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={isPending}>Kembali</Button>
            <Button variant="destructive" disabled={isPending || reason.trim().length < 5} onClick={() => run(() => rejectPayoutAction(slug, payoutId, reason), () => setRejectOpen(false))}>Tolak pengajuan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Baris pengiriman: tahan/lepas + refund. */
export function ShipmentRowActions({ slug, shippingLineId, held, canHold, remaining }: { slug: string; shippingLineId: string; held: boolean; canHold: boolean; remaining: number }) {
  const { isPending, run } = useAction();
  const [holdOpen, setHoldOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {held ? (
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => setHoldAction(slug, shippingLineId, ""))}><Play className="mr-1 h-3.5 w-3.5" /> Lepas tahan</Button>
      ) : canHold ? (
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => { setReason(""); setHoldOpen(true); }}><Pause className="mr-1 h-3.5 w-3.5" /> Tahan</Button>
      ) : null}
      {remaining > 0 && <Button size="sm" variant="outline" disabled={isPending} onClick={() => { setReason(""); setAmount(""); setRefundOpen(true); }}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Refund</Button>}

      <Dialog open={holdOpen} onOpenChange={setHoldOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Tahan pencairan pengiriman</DialogTitle><DialogDescription>Pengiriman ini tidak ikut diajukan sampai Anda melepas tahan. Gunakan untuk sengketa atau dugaan resi palsu.</DialogDescription></DialogHeader>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan (wajib)" maxLength={300} />
          <DialogFooter><Button variant="outline" onClick={() => setHoldOpen(false)}>Batal</Button><Button disabled={isPending || reason.trim().length < 5} onClick={() => run(() => setHoldAction(slug, shippingLineId, reason), () => setHoldOpen(false))}>Tahan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Bebankan refund ke produsen</DialogTitle><DialogDescription>Pesanan ini dikembalikan ke pembeli. Nominal yang diisi menjadi hutang produsen dan dipotong dari pencairan berikutnya. Maksimal {rupiah(remaining)} (sisa hak produsen pada pengiriman ini).</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Rp</span><Input type="number" min={1} max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Nominal yang dibebankan" /></div>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan refund (wajib)" maxLength={200} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRefundOpen(false)}>Batal</Button><Button disabled={isPending || !(Number(amount) > 0) || Number(amount) > remaining || reason.trim().length < 5} onClick={() => run(() => recordRefundAction(slug, shippingLineId, Number(amount), reason), () => setRefundOpen(false))}>Bebankan ke produsen</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function RepaymentButton({ slug, producerId, debt, producerName }: { slug: string; producerId: string; debt: number; producerName: string }) {
  const { isPending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(debt));
  const [proof, setProof] = useState<MediaItem | null>(null);
  const [note, setNote] = useState("");
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Catat pelunasan</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Pelunasan hutang — {producerName}</DialogTitle><DialogDescription>Produsen mentransfer langsung ke tenant. Hutang saat ini {rupiah(debt)}. Lampirkan bukti transfer masuk.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Rp</span><Input type="number" min={1} max={debt} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <ProofPicker slug={slug} value={proof} onChange={setProof} />
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (opsional)" maxLength={200} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button disabled={isPending || !proof || !(Number(amount) > 0) || Number(amount) > debt} onClick={() => run(() => recordRepaymentAction(slug, producerId, Number(amount), proof!.id, note), () => setOpen(false))}>Catat pelunasan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PayoutSettingsForm({ slug, initial }: { slug: string; initial: { minAmount: number; feeSameBank: number; feeOtherBank: number; slaDays: number } }) {
  const { isPending, run } = useAction();
  const [v, setV] = useState({ minAmount: String(initial.minAmount), feeSameBank: String(initial.feeSameBank), feeOtherBank: String(initial.feeOtherBank), slaDays: String(initial.slaDays) });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  const field = (k: keyof typeof v, label: string, hint: string, prefix?: string) => (
    <div className="space-y-1.5">
      <label className="text-xs font-medium">{label}</label>
      <div className="flex items-center gap-2">{prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}<Input type="number" min={0} value={v[k]} onChange={set(k)} /></div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("minAmount", "Minimum pencairan", "Saldo minimal agar produsen bisa mengajukan.", "Rp")}
        {field("slaDays", "Target proses (hari kerja)", "Ditampilkan ke produsen sebagai janji maksimal.")}
        {field("feeSameBank", "Biaya transfer sesama bank", "Dipotong dari produsen bila bank tenant = bank produsen.", "Rp")}
        {field("feeOtherBank", "Biaya transfer beda bank", "Dipotong dari produsen bila beda bank (mis. BRI → BCA).", "Rp")}
      </div>
      <Button disabled={isPending} onClick={() => run(() => savePayoutSettingsAction(slug, { minAmount: Number(v.minAmount), feeSameBank: Number(v.feeSameBank), feeOtherBank: Number(v.feeOtherBank), slaDays: Number(v.slaDays) }))}>
        {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Settings2 className="mr-1.5 h-4 w-4" />} Simpan pengaturan
      </Button>
    </div>
  );
}
