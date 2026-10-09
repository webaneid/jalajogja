"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveWhatsappGroupUrlAction } from "@/app/(dashboard)/app/[tenant]/settings/actions";

export function WhatsappGroupForm({ slug, defaultUrl }: { slug: string; defaultUrl: string }) {
  const router = useRouter();
  const [url, setUrl]         = React.useState(defaultUrl);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await saveWhatsappGroupUrlAction(slug, url);
      if (result.error) toast.error(result.error);
      else { toast.success("Tautan grup WhatsApp disimpan."); router.refresh(); }
    } finally { setPending(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-border p-4">
      <div className="space-y-1">
        <Label htmlFor="wa-group-url">Tautan grup WhatsApp</Label>
        <Input
          id="wa-group-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://chat.whatsapp.com/xxxxxxxxxxxx"
        />
        <p className="text-xs text-muted-foreground">
          Anggota yang keanggotaannya aktif melihat tombol &quot;Gabung Grup WhatsApp&quot; di halaman
          akun mereka. Tautan ini tidak pernah dikirim lewat pesan. Kosongkan untuk menonaktifkan.
        </p>
      </div>
      <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Penting — amankan grup Anda</p>
        <p>
          Siapa pun yang memegang tautan undangan WhatsApp bisa membagikannya. Di pengaturan grup
          WhatsApp, aktifkan <strong>&quot;Setujui peserta baru&quot;</strong> agar admin grup menyetujui setiap
          permintaan gabung, dan <strong>reset tautan undangan</strong> bila merasa tautan sudah bocor
          (lalu perbarui tautan di sini).
        </p>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan"}</Button>
    </form>
  );
}
