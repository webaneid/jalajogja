"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimForumWithExistingPaymentAction } from "./actions";

type Props = {
  slug:                string;
  tenantName:          string;
  hasProduct:          boolean;
  hasCampaign:         boolean;
  satisfiedAfterClaim: boolean;
};

// Kartu "Gunakan pembayaran saya" — tampil di /gabung kalau member punya pembayaran LUNAS lama
// (donasi/produk yang dibayar lewat jalur biasa) yang cocok syarat iuran forum. Aksi eksplisit:
// donasi organik tidak pernah mengaktifkan keanggotaan sendiri. Server yang menentukan item mana
// yang dihitung (dari sesi), kartu ini hanya memicu. Lihat docs/arsitektur-gabung-forum.md
// § "RENCANA — Pendaftaran Forum Bertahap & Dipandu" § 4.
export function ClaimExistingPaymentCard({ slug, tenantName, hasProduct, hasCampaign, satisfiedAfterClaim }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const what = hasProduct && hasCampaign ? "donasi dan pembelian"
             : hasCampaign ? "donasi" : "pembelian";

  function handleClaim() {
    setError(null);
    startTransition(async () => {
      const res = await claimForumWithExistingPaymentAction(slug);
      if (!res.success) { setError(res.error); return; }
      setMessage(res.data.message);
      router.refresh();
    });
  }

  if (message) {
    return (
      <div className="rounded-2xl border border-border bg-primary/[0.04] p-4 text-sm">{message}</div>
    );
  }

  return (
    <div className="rounded-2xl border border-border p-4 space-y-3">
      <p className="text-sm font-semibold">Anda sudah punya pembayaran yang bisa dipakai</p>
      <p className="text-sm text-muted-foreground">
        Kami menemukan {what} Anda sebelumnya yang sudah lunas dan sesuai syarat bergabung ke{" "}
        <strong>{tenantName}</strong>.{" "}
        {satisfiedAfterClaim
          ? "Gunakan pembayaran itu agar tidak perlu membayar lagi."
          : "Pembayaran itu akan dihitung; sisa syarat dapat dipenuhi di bawah."}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button type="button" onClick={handleClaim} disabled={pending} className="btn btn-primary btn-md">
        {pending ? "Memproses..." : "Gunakan Pembayaran Saya"}
      </button>
    </div>
  );
}
