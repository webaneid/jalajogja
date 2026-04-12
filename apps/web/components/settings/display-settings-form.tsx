"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { saveDisplaySettingsAction } from "@/app/(dashboard)/[tenant]/settings/actions";

const FONT_OPTIONS = [
  { value: "Inter",             label: "Inter (default)"          },
  { value: "Plus Jakarta Sans", label: "Plus Jakarta Sans"        },
  { value: "Geist",             label: "Geist"                    },
  { value: "DM Sans",           label: "DM Sans"                  },
  { value: "Nunito",            label: "Nunito"                   },
  { value: "Poppins",           label: "Poppins"                  },
];

export function DisplaySettingsForm({
  slug,
  defaultValues,
}: {
  slug: string;
  defaultValues: { primaryColor: string; font: string; footerText: string };
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [primaryColor, setPrimaryColor] = React.useState(defaultValues.primaryColor);
  const [font,         setFont]         = React.useState(defaultValues.font);
  const [footerText,   setFooterText]   = React.useState(defaultValues.footerText);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await saveDisplaySettingsAction(slug, { primaryColor, font, footerText });
      if (result.error) toast.error(result.error);
      else { toast.success("Tampilan disimpan."); router.refresh(); }
    } finally { setPending(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Primary Color */}
      <div className="space-y-2">
        <Label htmlFor="primaryColor">Warna Utama</Label>
        <div className="flex items-center gap-3">
          <input
            id="primaryColor"
            type="color"
            value={primaryColor}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrimaryColor(e.target.value)}
            disabled={pending}
            className="h-9 w-16 cursor-pointer rounded-md border border-input bg-background p-1 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Input
            value={primaryColor}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrimaryColor(e.target.value)}
            placeholder="#2563eb"
            className="max-w-[120px] font-mono"
            disabled={pending}
          />
          <span className="text-xs text-muted-foreground">Format hex: #rrggbb</span>
        </div>
      </div>

      {/* Font */}
      <div className="space-y-2">
        <Label>Font</Label>
        <div className="max-w-xs">
          <Combobox
            options={FONT_OPTIONS}
            value={font}
            onValueChange={setFont}
            placeholder="Pilih font..."
            disabled={pending}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Berlaku untuk website publik organisasi (modul Website).
        </p>
      </div>

      {/* Footer Text */}
      <div className="space-y-2">
        <Label htmlFor="footerText">Teks Footer</Label>
        <textarea
          id="footerText"
          value={footerText}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFooterText(e.target.value)}
          placeholder={`© ${new Date().getFullYear()} Nama Organisasi. All rights reserved.`}
          rows={2}
          disabled={pending}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
  );
}
