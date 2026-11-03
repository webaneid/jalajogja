"use client";

// Tombol Ubah / Arsipkan-Aktifkan / Hapus untuk satu produk produsen. Aturan sesungguhnya ada di SERVER
// (hapus ditolak bila ada pesanan lunas); tombol ini hanya memanggil dan menampilkan pesan server apa adanya.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setProducerProductStatusAction, deleteProducerProductAction } from "@/app/(producer)/app/[tenant]/portal-produsen/produk/actions";

export function ProducerProductActions({ slug, productId, status, editHref, listHref }: {
  slug: string; productId: string; status: string; editHref: string; listHref: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const archived = status === "archived";

  function toggle() {
    start(async () => {
      const res = await setProducerProductStatusAction(slug, productId, archived ? "active" : "archived");
      if (!res.success) { toast.error(res.error); return; }
      toast.success(archived ? "Produk diaktifkan kembali." : "Produk diarsipkan.");
      router.refresh();
    });
  }
  function remove() {
    start(async () => {
      const res = await deleteProducerProductAction(slug, productId);
      if (!res.success) { toast.error(res.error); setConfirming(false); return; }
      toast.success("Produk dihapus.");
      router.push(listHref);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
        <span>Hapus produk ini secara permanen?</span>
        <Button size="sm" variant="destructive" disabled={pending} onClick={remove}>{pending ? "Menghapus..." : "Ya, hapus"}</Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>Batal</Button>
      </div>
    );
  }
  return (
    <>
      <Link href={editHref} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted"><Pencil className="h-4 w-4" />Ubah</Link>
      <Button size="sm" variant="outline" disabled={pending} onClick={toggle}>
        {archived ? <><ArchiveRestore className="mr-1.5 h-4 w-4" />Aktifkan</> : <><Archive className="mr-1.5 h-4 w-4" />Arsipkan</>}
      </Button>
      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={pending} onClick={() => setConfirming(true)}><Trash2 className="mr-1.5 h-4 w-4" />Hapus</Button>
    </>
  );
}
