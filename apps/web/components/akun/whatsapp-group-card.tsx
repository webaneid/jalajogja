"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, CheckCircle2 } from "lucide-react";
import { openWhatsappGroupAction, markInWhatsappGroupAction } from "@/app/(public)/[tenant]/akun/group-actions";

type Props = { slug: string; tenantName: string; joined: boolean };

// Kartu "Gabung Grup WhatsApp" di /akun — tampil hanya untuk anggota AKTIF di tenant yang
// tautan grupnya sudah diisi admin. Tautan WhatsApp asli tidak ada di props/HTML: baru keluar dari
// server saat tombol ditekan (aksi memvalidasi sesi + keanggotaan aktif). Anggota boleh menekan
// ulang kapan saja; "Saya sudah di grup" untuk anggota lama yang sudah ada di grup.
// Lihat docs/arsitektur-gabung-forum.md § 9b.
export function WhatsappGroupCard({ slug, tenantName, joined }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    setError(null);
    // Buka tab SEKARANG (sinkron dengan klik) lalu arahkan setelah server menjawab — browser
    // (terutama Safari) memblokir window.open yang dipanggil setelah await.
    const win = window.open("", "_blank");
    startTransition(async () => {
      const res = await openWhatsappGroupAction(slug);
      if (!res.success) {
        win?.close();
        setError(res.error);
        return;
      }
      if (win) {
        win.opener = null;
        win.location.href = res.data.url;
      } else {
        window.location.href = res.data.url;
      }
      router.refresh();
    });
  }

  function handleMark() {
    setError(null);
    startTransition(async () => {
      const res = await markInWhatsappGroupAction(slug);
      if (!res.success) { setError(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-start gap-3">
        {joined
          ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          : <MessageCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />}
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {joined ? "Anda sudah tercatat bergabung grup WhatsApp" : "Gabung Grup WhatsApp"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {joined
              ? `Grup resmi ${tenantName}. Tautan tetap bisa dibuka kapan saja.`
              : `Bergabung ke grup resmi ${tenantName} untuk informasi dan komunikasi anggota.`}
          </p>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleOpen} disabled={pending} className="btn btn-primary btn-sm">
          {joined ? "Buka Grup" : "Gabung Grup WhatsApp"}
        </button>
        {!joined && (
          <button
            type="button" onClick={handleMark} disabled={pending}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Saya sudah di grup
          </button>
        )}
      </div>
    </div>
  );
}
