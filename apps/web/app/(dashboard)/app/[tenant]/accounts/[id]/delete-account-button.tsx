"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteProfileAction } from "../actions";

export function DeleteAccountButton({
  slug,
  profileId,
  profileName,
  invoiceCount,
}: {
  slug: string;
  profileId: string;
  profileName: string;
  invoiceCount: number;
}) {
  const router = useRouter();
  const [confirm, setConfirm]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteProfileAction(slug, profileId);
      if (result.success) {
        router.push(`/app/${slug}/accounts`);
      } else {
        setError(result.error);
      }
    });
  }

  if (confirm) {
    return (
      <div className="w-full rounded-lg border border-destructive/50 bg-destructive/5 p-3 space-y-2">
        <p className="text-sm font-medium text-destructive">
          Hapus akun {profileName} secara permanen?
        </p>
        <p className="text-xs text-muted-foreground">
          Ini akan menghapus login (email/password) dan data akun ini dari database —
          tidak bisa dibatalkan. Email dan nomor HP-nya akan bebas dipakai untuk
          registrasi baru (mis. sebagai anggota IKPM yang benar).
          {invoiceCount > 0 && (
            <> Ada <strong>{invoiceCount}</strong> riwayat transaksi di cabang ini —
            transaksi tidak akan terhapus, hanya kehilangan tautan ke akun ini.</>
          )}
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium
                       text-destructive-foreground hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Menghapus..." : "Ya, Hapus Permanen"}
          </button>
          <button
            onClick={() => { setConfirm(false); setError(null); }}
            disabled={isPending}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Batal
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2
                 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
    >
      <Trash2 className="h-4 w-4" /> Hapus Akun
    </button>
  );
}
