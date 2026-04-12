"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { saveGeneralSettingsAction } from "@/app/(dashboard)/[tenant]/settings/actions";
import { MediaPicker } from "@/components/media/media-picker";

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

  // State MediaPicker
  const [mediaPickerOpen, setMediaPickerOpen] = React.useState(false);
  const [pickerTarget, setPickerTarget] = React.useState<"logo" | "favicon" | null>(null);

  const set = (key: keyof DefaultValues) => (val: string) =>
    setValues((v) => ({ ...v, [key]: val }));

  function openPickerFor(target: "logo" | "favicon") {
    setPickerTarget(target);
    setMediaPickerOpen(true);
  }

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
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
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

      {/* Logo */}
      <div className="space-y-2">
        <Label>Logo</Label>
        {values.logoUrl ? (
          <div className="flex items-start gap-3">
            <img
              src={values.logoUrl}
              alt="Logo organisasi"
              className="max-h-16 rounded border object-contain bg-muted p-1"
            />
            <div className="flex flex-col gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openPickerFor("logo")}
              >
                Ganti
              </Button>
              <button
                type="button"
                onClick={() => set("logoUrl")("")}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors text-left"
              >
                Hapus
              </button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openPickerFor("logo")}
          >
            Pilih Logo
          </Button>
        )}
      </div>

      {/* Favicon */}
      <div className="space-y-2">
        <Label>Favicon</Label>
        {values.faviconUrl ? (
          <div className="flex items-start gap-3">
            <img
              src={values.faviconUrl}
              alt="Favicon"
              className="w-8 h-8 rounded border object-contain bg-muted p-0.5"
            />
            <div className="flex flex-col gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openPickerFor("favicon")}
              >
                Ganti
              </Button>
              <button
                type="button"
                onClick={() => set("faviconUrl")("")}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors text-left"
              >
                Hapus
              </button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openPickerFor("favicon")}
          >
            Pilih Favicon
          </Button>
        )}
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

    <MediaPicker
      slug={slug}
      open={mediaPickerOpen}
      onClose={() => setMediaPickerOpen(false)}
      onSelect={(media) => {
        if (pickerTarget === "logo") set("logoUrl")(media.url);
        if (pickerTarget === "favicon") set("faviconUrl")(media.url);
        setMediaPickerOpen(false);
      }}
      module="general"
      accept={["image/"]}
    />
    </>
  );
}
