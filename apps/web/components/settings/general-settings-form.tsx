"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { saveGeneralSettingsAction } from "@/app/(dashboard)/[tenant]/settings/actions";

const TIMEZONES = [
  { value: "Asia/Jakarta",   label: "WIB — Asia/Jakarta"   },
  { value: "Asia/Makassar",  label: "WITA — Asia/Makassar" },
  { value: "Asia/Jayapura",  label: "WIT — Asia/Jayapura"  },
  { value: "UTC",            label: "UTC"                  },
];

const LANGUAGES = [
  { value: "id", label: "Indonesia" },
  { value: "en", label: "English"   },
];

const CURRENCIES = [
  { value: "IDR", label: "IDR — Rupiah Indonesia" },
  { value: "USD", label: "USD — US Dollar"        },
];

type DefaultValues = {
  siteName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  timezone: string;
  language: string;
  currency: string;
};

export function GeneralSettingsForm({
  slug,
  defaultValues,
}: {
  slug: string;
  defaultValues: DefaultValues;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [values, setValues] = React.useState<DefaultValues>(defaultValues);

  const set = (key: keyof DefaultValues) => (val: string) =>
    setValues((v) => ({ ...v, [key]: val }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await saveGeneralSettingsAction(slug, values);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Pengaturan umum disimpan.");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {/* Nama Organisasi */}
      <div className="space-y-2">
        <Label htmlFor="siteName">
          Nama Organisasi <span className="text-destructive">*</span>
        </Label>
        <Input
          id="siteName"
          value={values.siteName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("siteName")(e.target.value)}
          placeholder="IKPM Yogyakarta"
          required
        />
      </div>

      {/* Tagline */}
      <div className="space-y-2">
        <Label htmlFor="tagline">Tagline</Label>
        <Input
          id="tagline"
          value={values.tagline}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("tagline")(e.target.value)}
          placeholder="Satu Hati, Satu Langkah"
        />
      </div>

      {/* Logo URL */}
      <div className="space-y-2">
        <Label htmlFor="logoUrl">Logo URL</Label>
        <Input
          id="logoUrl"
          value={values.logoUrl}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("logoUrl")(e.target.value)}
          placeholder="https://..."
          type="url"
        />
        <p className="text-xs text-muted-foreground">
          Upload langsung (MinIO) belum tersedia — isi URL manual untuk sementara.
        </p>
      </div>

      {/* Favicon URL */}
      <div className="space-y-2">
        <Label htmlFor="faviconUrl">Favicon URL</Label>
        <Input
          id="faviconUrl"
          value={values.faviconUrl}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("faviconUrl")(e.target.value)}
          placeholder="https://..."
          type="url"
        />
      </div>

      {/* Timezone */}
      <div className="space-y-2">
        <Label>Timezone</Label>
        <Combobox
          options={TIMEZONES}
          value={values.timezone}
          onValueChange={set("timezone")}
          placeholder="Pilih timezone..."
          searchPlaceholder="Cari timezone..."
        />
      </div>

      {/* Bahasa */}
      <div className="space-y-2">
        <Label>Bahasa</Label>
        <Combobox
          options={LANGUAGES}
          value={values.language}
          onValueChange={set("language")}
          placeholder="Pilih bahasa..."
        />
      </div>

      {/* Mata Uang */}
      <div className="space-y-2">
        <Label>Mata Uang</Label>
        <Combobox
          options={CURRENCIES}
          value={values.currency}
          onValueChange={set("currency")}
          placeholder="Pilih mata uang..."
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
  );
}
