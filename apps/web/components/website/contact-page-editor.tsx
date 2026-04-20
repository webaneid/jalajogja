"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { type ContactBody, parseContactBody } from "@/lib/page-templates";

type Props = {
  value:    string | null;
  onChange: (value: string) => void;
};

export function ContactPageEditor({ value, onChange }: Props) {
  const initial = parseContactBody(value);
  const [data, setData] = useState<ContactBody>(initial);

  function update(next: ContactBody) {
    setData(next);
    onChange(JSON.stringify(next));
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Judul Halaman</Label>
        <Input
          value={data.customTitle ?? ""}
          onChange={(e) => update({ ...data, customTitle: e.target.value })}
          placeholder="Hubungi Kami"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border rounded-lg px-4 py-3">
          <div>
            <p className="text-sm font-medium">Tampilkan Form Pesan</p>
            <p className="text-xs text-muted-foreground mt-0.5">Form akan tersimpan ke inbox dashboard</p>
          </div>
          <Switch
            checked={data.showForm}
            onCheckedChange={(v: boolean) => update({ ...data, showForm: v })}
          />
        </div>

        <div className="flex items-center justify-between border rounded-lg px-4 py-3">
          <div>
            <p className="text-sm font-medium">Tampilkan Google Maps</p>
            <p className="text-xs text-muted-foreground mt-0.5">Paste URL embed dari Google Maps</p>
          </div>
          <Switch
            checked={data.showMap}
            onCheckedChange={(v: boolean) => update({ ...data, showMap: v })}
          />
        </div>
      </div>

      {data.showMap && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">URL Embed Google Maps</Label>
          <Textarea
            value={data.mapEmbedUrl ?? ""}
            onChange={(e) => update({ ...data, mapEmbedUrl: e.target.value })}
            placeholder={`https://www.google.com/maps/embed?pb=...`}
            rows={3}
            className="text-xs font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Di Google Maps → Share → Embed a map → salin src="..." dari iframe-nya
          </p>
        </div>
      )}

      {data.showForm && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Pesan setelah submit (opsional)</Label>
          <Input
            value={data.successMsg ?? ""}
            onChange={(e) => update({ ...data, successMsg: e.target.value })}
            placeholder="Terima kasih! Pesan Anda telah kami terima."
          />
        </div>
      )}

      <div className="rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground">
        <strong>Info kontak</strong> (telepon, email, alamat, sosial media) diambil otomatis dari{" "}
        <strong>Pengaturan → Kontak</strong>.
      </div>
    </div>
  );
}
