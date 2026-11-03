"use client";

// Komponen interaktif Pencairan di Portal Produsen: kartu rekening, tombol ajukan (dengan konfirmasi rincian), batalkan.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Landmark, ShieldCheck, Send, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveBankAccountAction, requestPayoutAction, cancelPayoutAction } from "@/app/(producer)/app/[tenant]/portal-produsen/pencairan/actions";
import { fmtDateTime, rupiah } from "@/lib/rupiah";

export type BankView = { bankCode: string; bankName: string; accountLast4: string; accountHolder: string; effectiveAt: string };

export function BankAccountCard({ slug, banks, active, pending }: { slug: string; banks: { code: string; name: string }[]; active: BankView | null; pending: BankView | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!active && !pending);
  const [bankCode, setBankCode] = useState("");
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [isPending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await saveBankAccountAction(slug, { bankCode, accountNumber: number, holder });
      if (!res.success) { toast.error(res.error); return; }
      toast.success(res.message ?? "Rekening tersimpan.");
      setEditing(false); setNumber(""); setHolder(""); setBankCode("");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Landmark className="h-5 w-5" /></div>
          <div>
            <h2 className="text-sm font-semibold">Rekening tujuan pencairan</h2>
            <p className="text-xs text-muted-foreground">Dana ditransfer ke rekening ini, atas nama Anda.</p>
          </div>
        </div>
        {!editing && (active || pending) && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Ganti rekening</Button>}
      </div>

      {!editing && active && (
        <div className="mt-4 rounded-xl bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground">{active.bankName}</p>
          <p className="mt-0.5 font-mono text-lg font-semibold tracking-wider">•••• •••• {active.accountLast4}</p>
          <p className="mt-1 text-sm">a.n. {active.accountHolder}</p>
        </div>
      )}
      {!editing && pending && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Rekening baru <b>{pending.bankName} ••••{pending.accountLast4}</b> akan berlaku mulai <b>{fmtDateTime(pending.effectiveAt)}</b>. Sampai saat itu pencairan memakai rekening lama.</p>
        </div>
      )}
      {!editing && !active && !pending && <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Belum ada rekening. Isi rekening terlebih dahulu agar bisa mengajukan pencairan.</p>}

      {editing && (
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Bank</label>
            <Combobox options={banks.map((b) => ({ value: b.code, label: b.name }))} value={bankCode} onValueChange={setBankCode} placeholder="Pilih bank" searchPlaceholder="Cari bank..." />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Nomor rekening</label>
            <Input inputMode="numeric" autoComplete="off" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="mis. 0123456789" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Nama pemilik rekening</label>
            <Input autoComplete="off" value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Sesuai buku tabungan" />
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Demi keamanan, nomor rekening disimpan terenkripsi. Penggantian rekening baru berlaku 24 jam kemudian dan bendahara diberi tahu.</p>
          </div>
          <div className="flex justify-end gap-2">
            {(active || pending) && <Button variant="ghost" onClick={() => setEditing(false)} disabled={isPending}>Batal</Button>}
            <Button onClick={save} disabled={isPending || !bankCode || !number.trim() || holder.trim().length < 3}>
              {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Simpan rekening
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export function RequestPayoutButton({ slug, subtotal, disabledReason, bankLabel }: { slug: string; subtotal: number; disabledReason: string | null; bankLabel: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, start] = useTransition();

  function submit() {
    start(async () => {
      const res = await requestPayoutAction(slug);
      if (!res.success) { toast.error(res.error); return; }
      toast.success(res.message ?? "Pengajuan terkirim.");
      setOpen(false);
      router.push(res.id ? `/app/${slug}/portal-produsen/pencairan/${res.id}` : `/app/${slug}/portal-produsen/pencairan`);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="lg" className="w-full sm:w-auto" disabled={!!disabledReason} onClick={() => setOpen(true)}>
        <Send className="mr-2 h-4 w-4" /> Ajukan pencairan {rupiah(subtotal)}
      </Button>
      {disabledReason && <p className="mt-2 text-xs text-muted-foreground">{disabledReason}</p>}
      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajukan pencairan?</DialogTitle>
            <DialogDescription>Seluruh saldo yang bisa dicairkan akan diajukan ke bendahara. Saldo tersebut dikunci sampai pengajuan selesai atau Anda batalkan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-xl bg-muted/50 p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Jumlah pencairan</span><b className="tabular-nums">{rupiah(subtotal)}</b></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Rekening tujuan</span><span className="text-right">{bankLabel}</span></div>
            <p className="pt-1 text-xs text-muted-foreground">Biaya transfer (ditanggung Anda) dipotong saat dana ditransfer.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Kembali</Button>
            <Button onClick={submit} disabled={isPending}>{isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Ya, ajukan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CancelPayoutButton({ slug, payoutId }: { slug: string; payoutId: string }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={() => {
      if (!window.confirm("Batalkan pengajuan ini? Saldo Anda akan kembali utuh dan bisa diajukan lagi.")) return;
      start(async () => {
        const res = await cancelPayoutAction(slug, payoutId);
        if (!res.success) { toast.error(res.error); return; }
        toast.success(res.message ?? "Dibatalkan.");
        router.refresh();
      });
    }}>
      {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Batalkan pengajuan
    </Button>
  );
}
