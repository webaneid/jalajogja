"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  saveEkosistemModulesAction, saveEkosistemModuleLabelsAction,
} from "@/app/(dashboard)/app/[tenant]/ekosistem/actions";
import type { EkosistemModule } from "@/lib/ekosistem-modules";

type DefaultValues = {
  usahaEnabled:       boolean;
  pesantrenEnabled:   boolean;
  profesionalEnabled: boolean;
};

const MODULE_ROWS: { key: keyof DefaultValues; module: EkosistemModule; defaultLabel: string }[] = [
  { key: "usahaEnabled",       module: "usaha",       defaultLabel: "Usaha" },
  { key: "pesantrenEnabled",   module: "pesantren",   defaultLabel: "Pesantren" },
  { key: "profesionalEnabled", module: "profesional", defaultLabel: "Profesional" },
];

// Ekstraksi PERSIS dari blok "Modul Ekosistem" yang dulu ada di GeneralSettingsForm — pindah
// rumah ke modul Ekosistem sendiri (2026-08-07). Diperluas dengan override NAMA modul
// (2026-08-07, susulan) — checkbox aktif/nonaktif TIDAK berubah, ditambah input teks nama
// custom per modul di baris yang sama (mirror pola checkbox+label Kategori/Sektor di
// /ekosistem/taksonomi). Disimpan via 2 action terpisah (key settings beda), dipanggil
// sekuensial dari SATU tombol submit.
export function EkosistemPengaturanForm({
  slug,
  defaultValues,
  defaultLabels,
}: {
  slug: string;
  defaultValues: DefaultValues;
  defaultLabels: Partial<Record<EkosistemModule, string>>;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [values, setValues]   = React.useState<DefaultValues>(defaultValues);
  const [labels, setLabels]   = React.useState<Record<EkosistemModule, string>>(() => ({
    usaha:       defaultLabels.usaha       ?? "",
    pesantren:   defaultLabels.pesantren   ?? "",
    profesional: defaultLabels.profesional ?? "",
  }));

  const setBool = (key: keyof DefaultValues) => (val: boolean) =>
    setValues((v) => ({ ...v, [key]: val }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const labelPayload: Partial<Record<EkosistemModule, string>> = {};
      for (const { module } of MODULE_ROWS) {
        const v = labels[module].trim();
        if (v) labelPayload[module] = v;
      }
      const [modulesResult, labelsResult] = await Promise.all([
        saveEkosistemModulesAction(slug, values),
        saveEkosistemModuleLabelsAction(slug, labelPayload),
      ]);
      const error = modulesResult.error || labelsResult.error;
      if (error) {
        toast.error(error);
      } else {
        toast.success("Pengaturan modul disimpan.");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4 rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium">Modul Ekosistem Anggota</p>
          <p className="text-xs text-muted-foreground mt-1">
            Matikan modul yang tidak relevan untuk organisasi ini — data anggota yang sudah ada
            TIDAK akan dihapus, hanya disembunyikan dari form pendaftaran, direktori publik, dan
            halaman lain di tenant ini. Ganti "Nama Tampilan" untuk mengubah teks yang muncul ke
            anggota/pengunjung (mis. "Usaha" → "UMKM") — kosongkan untuk pakai nama bawaan.
          </p>
        </div>
        {MODULE_ROWS.map(({ key, module, defaultLabel }) => (
          <div key={key} className="grid grid-cols-1 sm:grid-cols-[1fr_1.2fr] gap-2 sm:items-center">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={values[key]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBool(key)(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Aktifkan Modul {defaultLabel}
            </label>
            <Input
              value={labels[module]}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLabels((l) => ({ ...l, [module]: e.target.value }))
              }
              placeholder={`Nama Tampilan (default: "${defaultLabel}")`}
              disabled={!values[key]}
            />
          </div>
        ))}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
  );
}
