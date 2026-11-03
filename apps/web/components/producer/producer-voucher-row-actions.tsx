"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setProducerVoucherActiveAction, deleteProducerVoucherAction } from "@/app/(producer)/app/[tenant]/portal-produsen/voucher/actions";

export function ProducerVoucherRowActions({ slug, voucherId, isActive, editHref }: { slug: string; voucherId: string; isActive: boolean; editHref: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => start(async () => {
    const r = await fn();
    if (!r.success) { toast.error(r.error ?? "Gagal."); setConfirming(false); return; }
    toast.success(ok); setConfirming(false); router.refresh();
  });
  if (confirming) return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-xs">Hapus?</span>
      <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(() => deleteProducerVoucherAction(slug, voucherId), "Voucher dihapus.")}>Ya</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>Batal</Button>
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5">
      <Link href={editHref} className="text-xs text-primary hover:underline">Ubah</Link>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setProducerVoucherActiveAction(slug, voucherId, !isActive), isActive ? "Voucher dinonaktifkan." : "Voucher diaktifkan.")}>{isActive ? "Nonaktifkan" : "Aktifkan"}</Button>
      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={pending} onClick={() => setConfirming(true)}>Hapus</Button>
    </span>
  );
}
