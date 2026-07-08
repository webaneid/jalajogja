"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createCabangAction } from "../../actions";

export default function NewCabangPage() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await createCabangAction(fd);
      if ("error" in res) { setError(res.error); return; }
      router.push("/platform/cabang");
    });
  }

  return (
    <div className="max-w-lg space-y-6">
      <Link href="/platform/cabang" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft size={14} /> Daftar PC IKPM
      </Link>

      <div>
        <h1 className="text-xl font-semibold">Tambah PC IKPM</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Data resmi cabang IKPM dari PP IKPM</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-sm font-medium">Kode <span className="text-muted-foreground text-xs">(opsional)</span></label>
            <input name="kode" placeholder="PC-DIY" className={inp} />
          </div>
          <div className="col-span-1 space-y-1">
            <label className="block text-sm font-medium">Kota Pusat</label>
            <input name="kota" placeholder="Yogyakarta" className={inp} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">Nama Lengkap <span className="text-red-500">*</span></label>
          <input name="nama" required placeholder="PC IKPM Daerah Istimewa Yogyakarta" className={inp} />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">Nama Pendek <span className="text-muted-foreground text-xs">(opsional)</span></label>
          <input name="nama_pendek" placeholder="IKPM Yogyakarta" className={inp} />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">Provinsi</label>
          <input name="provinsi" placeholder="Daerah Istimewa Yogyakarta" className={inp} />
        </div>

        {error && (
          <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={pending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {pending ? "Menyimpan..." : "Simpan"}
          </button>
          <Link href="/platform/cabang" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition-colors">
            Batal
          </Link>
        </div>
      </form>
    </div>
  );
}
